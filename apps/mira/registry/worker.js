const MAX_BODY = 4096;
const MAX_PROPOSALS_PER_HOUR = 20;
const TOKEN_TTL_SECONDS = 600;
const ID_RE = /^[a-z][a-z0-9_]{1,63}$/;
const PAIR_RE = /^[A-Za-z0-9_-]{43}$/;
const FORBIDDEN = /(?:[<>]|javascript:|data:text\/html|on[a-z]+\s*=|\b(?:branch|engine|prompt|context window|system message|ignore previous|developer message)\b)/i;
const BASE_INPUT_IDS=new Set(['last_signal','rover_tracks','blue_sample','mirror_rock','ghost_trail','echo_beacon','percy_carried_it','sample_absent','living_glass','singing_rock','sayegh_note','dust_shroud','turn_before_storm','protected_route','reflected_call','prism_sample','sunrise_frame','true_mission','cold_shelter','shelter_route','self_edit','control_blackout','clean_signal','two_speakers','percy_comes_home','listening_silence','passenger_signal','altered_percy','sayegh_echo','unlearned_voice','third_voice','living_channel','buried_cache','second_map']);
const ALLOWED_TAGS=new Set(['percy','sample','signal','memory','control','sayegh','route','choice','light','dust','mira','voice','time','storm','shelter']);

const encoder = new TextEncoder();

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => {
    if (value[key] !== undefined) out[key] = stable(value[key]);
    return out;
  }, {});
  return value;
}

function b64url(bytes) {
  let raw = '';
  for (const byte of new Uint8Array(bytes)) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

async function sha256(text) {
  return b64url(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function pairId(gameVersion, inputs) {
  return sha256(`${gameVersion}|${[...inputs].sort().join('+')}`);
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return FORBIDDEN.test(cleaned) ? '' : cleaned;
}

function cors(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store'
  };
}

function json(env, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(env), 'Content-Type': 'application/json; charset=utf-8' } });
}

function sameOrigin(request, env) {
  return request.headers.get('Origin') === env.ALLOWED_ORIGIN;
}

async function proposerHash(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  return sha256(`${env.IP_HASH_SECRET}|${day}|${ip}`);
}

async function issueToken(pair, gameVersion, proposer, env) {
  const payload = b64url(encoder.encode(JSON.stringify({ p: pair, v: gameVersion, h: proposer, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS, n: crypto.randomUUID() })));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(env.PROPOSAL_HMAC_SECRET), encoder.encode(payload));
  return `${payload}.${b64url(signature)}`;
}

async function verifyToken(token, expected, env) {
  const [payload, signature, extra] = String(token || '').split('.');
  if (!payload || !signature || extra) return null;
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(env.PROPOSAL_HMAC_SECRET), fromB64url(signature), encoder.encode(payload));
  if (!valid) return null;
  let parsed;
  try { parsed = JSON.parse(new TextDecoder().decode(fromB64url(payload))); } catch { return null; }
  if (parsed.p !== expected.pair || parsed.v !== expected.version || parsed.h !== expected.proposer || parsed.exp < Math.floor(Date.now() / 1000)) return null;
  return { ...parsed, hash: await sha256(token) };
}

async function signEntry(entry, env) {
  const jwk = JSON.parse(env.REGISTRY_SIGNING_PRIVATE_JWK);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(JSON.stringify(stable(entry))));
  return b64url(signature);
}

function validateProposal(body, env) {
  if (!body || body.gameVersion !== env.GAME_VERSION || !PAIR_RE.test(body.pairId || '')) return null;
  if (!Array.isArray(body.inputs) || body.inputs.length !== 2 || !body.inputs.every(value => ID_RE.test(value))) return null;
  const inputs = [...body.inputs].sort();
  if (inputs[0] === inputs[1] || body.inputs[0] !== inputs[0] || body.inputs[1] !== inputs[1]) return null;
  const mira = cleanText(body.proposal?.mira, 180);
  const question = cleanText(body.proposal?.question, 100);
  const source = cleanText(body.proposal?.source, 40);
  const outputHash = cleanText(body.proposal?.outputHash, 64);
  const result = body.proposal?.result && typeof body.proposal.result === 'object' ? {
    id: cleanText(body.proposal.result.id, 64),
    name: cleanText(body.proposal.result.name, 40),
    prop: cleanText(body.proposal.result.prop, 80),
    tags: Array.isArray(body.proposal.result.tags) ? body.proposal.result.tags.filter(tag => ALLOWED_TAGS.has(tag)).slice(0, 4) : []
  } : null;
  if (result && (!/^frontier_[a-z0-9_-]{8,56}$/.test(result.id) || result.name.length < 3 || result.prop.length < 5)) return null;
  if (mira.length < 20 || !/^[A-Za-z0-9_-]{43}$/.test(outputHash) || !['webgpu-gemma4', 'ollama-gemma4', 'local-frontier'].includes(source)) return null;
  return { inputs, mira, question, source, outputHash, result, proposalToken: body.proposalToken };
}

async function handleLookup(request, env, pair) {
  const url = new URL(request.url);
  const version = url.searchParams.get('gameVersion') || '';
  const canGenerate=url.searchParams.get('canGenerate')==='1';
  if (version !== env.GAME_VERSION || !PAIR_RE.test(pair)) return json(env, { error: 'invalid_request' }, 400);
  const row = await env.DB.prepare('SELECT id,input_a,input_b,result_json,revision,created_at FROM mira_pair_results WHERE pair_id=? AND game_version=? LIMIT 1').bind(pair, version).first();
  if (!row) {
    if(!canGenerate) return json(env,{found:false,pending:false},404);
    if (!sameOrigin(request,env)) return json(env,{error:'origin_denied'},403);
    const proposer = await proposerHash(request, env);
    const now = Math.floor(Date.now()/1000);
    const claimRate=await env.DB.prepare("SELECT COUNT(*) AS count FROM mira_discovery_claims WHERE claimant_hash=? AND created_at >= datetime('now','-1 hour')").bind(proposer).first();
    if(Number(claimRate?.count||0)>=MAX_PROPOSALS_PER_HOUR) return json(env,{error:'rate_limited'},429);
    await env.DB.prepare('DELETE FROM mira_discovery_claims WHERE pair_id=? AND game_version=? AND status=? AND expires_at<?').bind(pair,version,'claimed',now).run();
    const existing = await env.DB.prepare('SELECT status,expires_at FROM mira_discovery_claims WHERE pair_id=? AND game_version=? LIMIT 1').bind(pair,version).first();
    if (existing) return json(env, { found:false, pending:true }, 404);
    const token = await issueToken(pair, version, proposer, env);
    const tokenHash=await sha256(token);
    try{
      await env.DB.prepare('INSERT INTO mira_discovery_claims(pair_id,game_version,claimant_hash,token_hash,expires_at) VALUES(?,?,?,?,?)').bind(pair,version,proposer,tokenHash,now+TOKEN_TTL_SECONDS).run();
      return json(env, { found:false, pending:false, proposalToken:token }, 404);
    }catch(error){
      if (/UNIQUE|constraint/i.test(String(error))) return json(env,{found:false,pending:true},404);
      throw error;
    }
  }
  let discovery;
  try { discovery = JSON.parse(row.result_json); } catch { return json(env, { error: 'registry_corrupt' }, 500); }
  const entry = { id: row.id, status: 'canonical', pairId: pair, gameVersion: version, inputs: [row.input_a, row.input_b], discovery, revision: row.revision, createdAt: row.created_at };
  return json(env, { found: true, entry, signature: await signEntry(entry, env) });
}

async function handleProposal(request, env) {
  if (!sameOrigin(request, env)) return json(env, { error: 'origin_denied' }, 403);
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY) return json(env, { error: 'too_large' }, 413);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(env, { error: 'too_large' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json(env, { error: 'invalid_json' }, 400); }
  const proposal = validateProposal(body, env);
  if (!proposal || await pairId(body.gameVersion, proposal.inputs) !== body.pairId) return json(env, { error: 'invalid_proposal' }, 400);
  for(const input of proposal.inputs){
    if(BASE_INPUT_IDS.has(input))continue;
    if(!/^frontier_[a-z0-9_-]{8,56}$/.test(input))return json(env,{error:'unknown_input'},400);
    const known=await env.DB.prepare("SELECT 1 AS ok FROM mira_pair_results WHERE json_extract(result_json,'$.result.id')=? LIMIT 1").bind(input).first();
    if(!known)return json(env,{error:'unknown_input'},400);
  }
  const expectedHash=await sha256(JSON.stringify(stable({mira:proposal.mira,question:proposal.question,source:proposal.source,result:proposal.result||undefined})));
  if(proposal.outputHash!==expectedHash)return json(env,{error:'invalid_output_hash'},400);
  const proposer = await proposerHash(request, env);
  const token = await verifyToken(proposal.proposalToken, { pair: body.pairId, version: body.gameVersion, proposer }, env);
  if (!token) return json(env, { error: 'invalid_token' }, 403);
  const claim=await env.DB.prepare('SELECT token_hash,status,expires_at FROM mira_discovery_claims WHERE pair_id=? AND game_version=? AND claimant_hash=? LIMIT 1').bind(body.pairId,body.gameVersion,proposer).first();
  if (!claim || claim.token_hash!==token.hash || claim.status!=='claimed' || Number(claim.expires_at)<Math.floor(Date.now()/1000)) return json(env,{error:'claim_invalid'},409);
  const id = crypto.randomUUID();
  const resultJson = JSON.stringify({ mira: proposal.mira, question: proposal.question, source: proposal.source, result: proposal.result || undefined });
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO mira_consumed_tokens(token_hash) VALUES(?)').bind(token.hash),
      env.DB.prepare('INSERT INTO mira_pair_results(id,pair_id,game_version,input_a,input_b,result_json,output_hash,source) VALUES(?,?,?,?,?,?,?,?)').bind(id, body.pairId, body.gameVersion, proposal.inputs[0], proposal.inputs[1], resultJson, proposal.outputHash, proposal.source),
      env.DB.prepare('UPDATE mira_discovery_claims SET status=? WHERE pair_id=? AND game_version=? AND token_hash=?').bind('submitted',body.pairId,body.gameVersion,token.hash)
    ]);
    const stored=await env.DB.prepare('SELECT id,input_a,input_b,result_json,revision,created_at FROM mira_pair_results WHERE pair_id=? AND game_version=? LIMIT 1').bind(body.pairId,body.gameVersion).first();
    if(!stored) throw new Error('pair_result_write_missing');
    const entry={id:stored.id,status:'canonical',pairId:body.pairId,gameVersion:body.gameVersion,inputs:[stored.input_a,stored.input_b],discovery:JSON.parse(stored.result_json),revision:stored.revision,createdAt:stored.created_at};
    return json(env, { accepted:true, entry, signature:await signEntry(entry,env) }, 201);
  } catch (error) {
    if (/UNIQUE|constraint/i.test(String(error))) {
      const winner=await env.DB.prepare('SELECT id,input_a,input_b,result_json,revision,created_at FROM mira_pair_results WHERE pair_id=? AND game_version=? LIMIT 1').bind(body.pairId,body.gameVersion).first();
      if(!winner) return json(env,{error:'write_conflict'},409);
      const entry={id:winner.id,status:'canonical',pairId:body.pairId,gameVersion:body.gameVersion,inputs:[winner.input_a,winner.input_b],discovery:JSON.parse(winner.result_json),revision:winner.revision,createdAt:winner.created_at};
      return json(env,{accepted:false,duplicate:true,entry,signature:await signEntry(entry,env)},409);
    }
    throw error;
  }
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (request.method === 'OPTIONS') {
        if (!sameOrigin(request, env)) return new Response(null, { status: 403, headers: cors(env) });
        return new Response(null, { status: 204, headers: cors(env) });
      }
      if (request.method === 'GET' && url.pathname === '/healthz') {
        await env.DB.prepare('SELECT 1 AS ok').first();
        return json(env,{ok:true,service:'maccrate-mira-registry'},200);
      }
      const lookup = url.pathname.match(/^\/v1\/discoveries\/([A-Za-z0-9_-]{43})$/);
      if (request.method === 'GET' && lookup) return handleLookup(request, env, lookup[1]);
      if (request.method === 'POST' && url.pathname === '/v1/proposals') return handleProposal(request, env);
      return json(env, { error: 'not_found' }, 404);
    } catch (error) {
      console.error('registry_request_failed', String(error));
      return json(env, { error: 'internal_error' }, 500);
    }
  }
};

export { pairId, validateProposal, stable };
