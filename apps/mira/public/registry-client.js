const MAX_RESPONSE_BYTES = 16_384;
const MAX_PROPOSAL_BYTES = 4_096;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      if (value[key] !== undefined) out[key] = stable(value[key]);
      return out;
    }, {});
  }
  return value;
}

function bytesToBase64Url(bytes) {
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return bytesToBase64Url(new Uint8Array(digest));
}

function safeText(value, max) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function validateEntry(entry, inputs, gameVersion) {
  if (!entry || entry.status !== 'canonical' || entry.gameVersion !== gameVersion) throw new Error('Registry entry has invalid status or version');
  const sorted = [...inputs].sort();
  if (!Array.isArray(entry.inputs) || entry.inputs.length !== 2 || entry.inputs[0] !== sorted[0] || entry.inputs[1] !== sorted[1]) throw new Error('Registry entry inputs do not match request');
  const mira = safeText(entry.discovery?.mira, 180);
  const question = safeText(entry.discovery?.question, 100);
  if (mira.length < 20) throw new Error('Registry entry has no usable Mira response');
  const output = { mira, source: 'registry-canonical', registryId: safeText(entry.id, 100) };
  if (question) output.question = question;
  const finding = entry.discovery?.result;
  if (finding) {
    const id = safeText(finding.id, 64);
    const name = safeText(finding.name, 40);
    const prop = safeText(finding.prop, 80);
    const tags = Array.isArray(finding.tags) ? finding.tags.filter(tag => /^[a-z-]{2,20}$/.test(tag)).slice(0, 4) : [];
    if (!/^frontier_[a-z0-9_-]{8,56}$/.test(id) || name.length < 3 || prop.length < 5) throw new Error('Registry finding is malformed');
    output.result = { id, name, prop, tags, canonical: true, mira };
  }
  return output;
}

export class RegistryClient {
  constructor(options = {}) {
    this.endpoint = String(options.endpoint || '').replace(/\/$/, '');
    this.gameVersion = safeText(options.gameVersion, 80);
    this.publicKeyJwk = options.publicKeyJwk || null;
    this.key = null;
    if (!this.endpoint || !this.gameVersion || !this.publicKeyJwk) throw new Error('Registry requires endpoint, gameVersion, and public signing key');
  }

  async pairId(inputs) {
    return sha256(`${this.gameVersion}|${[...inputs].sort().join('+')}`);
  }

  async signingKey() {
    if (!this.key) {
      this.key = await crypto.subtle.importKey('jwk', this.publicKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    }
    return this.key;
  }

  async verify(entry, signature) {
    const key = await this.signingKey();
    const payload = new TextEncoder().encode(JSON.stringify(stable(entry)));
    return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, base64UrlToBytes(signature), payload);
  }

  async lookup(inputs, options = {}) {
    const sorted = [...inputs].sort();
    const pairId = await this.pairId(sorted);
    const response = await fetch(`${this.endpoint}/v1/discoveries/${encodeURIComponent(pairId)}?gameVersion=${encodeURIComponent(this.gameVersion)}&canGenerate=${options.canGenerate === true ? '1' : '0'}`, {
      method: 'GET', credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' }
    });
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_RESPONSE_BYTES) throw new Error('Registry response too large');
    if (response.status === 404) {
      const body = await response.json().catch(() => ({}));
      return { found: false, pairId, pending: body.pending === true, proposalToken: safeText(body.proposalToken, 512) };
    }
    if (!response.ok) throw new Error(`Registry lookup failed (${response.status})`);
    const body = await response.json();
    if (!body.entry || !body.signature || !(await this.verify(body.entry, body.signature))) throw new Error('Registry signature verification failed');
    return { found: true, pairId, discovery: validateEntry(body.entry, sorted, this.gameVersion) };
  }

  async submit(inputs, proposal, proposalToken) {
    if (!proposalToken) return { submitted: false };
    const sorted = [...inputs].sort();
    const pairId = await this.pairId(sorted);
    const normalizedResult=proposal?.result ? {
      id:safeText(proposal.result.id,64), name:safeText(proposal.result.name,40),
      prop:safeText(proposal.result.prop,80),
      tags:Array.isArray(proposal.result.tags)?proposal.result.tags.slice(0,4):[]
    } : undefined;
    const hashPayload={mira:safeText(proposal?.mira,180),question:safeText(proposal?.question,100),source:safeText(proposal?.source,40),result:normalizedResult};
    const body = {
      pairId,
      inputs: sorted,
      gameVersion: this.gameVersion,
      proposalToken,
      proposal: {
        mira: hashPayload.mira,
        question: hashPayload.question,
        source: hashPayload.source,
        result: normalizedResult,
        outputHash: await sha256(JSON.stringify(stable(hashPayload)))
      }
    };
    const serialized = JSON.stringify(body);
    if (serialized.length > MAX_PROPOSAL_BYTES || body.proposal.mira.length < 20) return { submitted: false };
    const response = await fetch(`${this.endpoint}/v1/proposals`, {
      method: 'POST', credentials: 'omit', redirect: 'error',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: serialized
    });
    if (!response.ok && response.status !== 201 && response.status !== 409) throw new Error(`Registry proposal failed (${response.status})`);
    const responseBody=await response.json().catch(()=>({}));
    if(!responseBody.entry || !responseBody.signature || !(await this.verify(responseBody.entry,responseBody.signature))) throw new Error('Registry write confirmation signature failed');
    return { submitted: response.status === 201, duplicate: response.status === 409, discovery:validateEntry(responseBody.entry,sorted,this.gameVersion) };
  }
}

export async function installMiraRegistry(options = {}) {
  const client = new RegistryClient(options);
  window.__miraRegistry = client;
  return client;
}
