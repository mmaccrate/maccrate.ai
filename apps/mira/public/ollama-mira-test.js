export function installOllamaMira(options = {}) {
  const endpoint = String(options.endpoint || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const model = options.model || 'gemma4:latest';
  const metrics = { model, endpoint, calls: 0, cacheHits: 0, failures: 0, results: [] };
  window.__miraOllamaTest = metrics;

  function clean(value, max) {
    if (typeof value !== 'string') return '';
    const text=value.replace(/^Mira:\s*/i, '').replace(/\s+/g, ' ').trim();
    if(text.length<=max) return text;
    const cut=text.slice(0,max+1);
    const sentence=Math.max(cut.lastIndexOf('.'),cut.lastIndexOf('?'),cut.lastIndexOf('!'),cut.lastIndexOf(';'));
    if(sentence>=Math.floor(max*.55)) return cut.slice(0,sentence+1).replace(/;$/,'.');
    const boundary=cut.lastIndexOf(' ');
    return `${cut.slice(0,boundary>max*.65?boundary:max).replace(/[,:;\s]+$/,'')}.`;
  }
  async function frontierId(pair,stateVersion){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${stateVersion}|${pair}`)));return `frontier_${Array.from(bytes.slice(0,12)).map(byte=>byte.toString(16).padStart(2,'0')).join('')}`;}

  window.__miraFrontier = async function ollamaFrontier(a, b, context = {}) {
    const defs = window.__miraMachineDefs || {};
    const da = defs[a] || { name: a, prop: 'unknown' };
    const db = defs[b] || { name: b, prop: 'unknown' };
    const state = window.__miraMachine?.getState?.() || {};
    const grounding = context.grounding || { facts: [], support: 'gap', sharedSubjects: [], sharedEvents: [], witnesses: [] };
    const cacheKey = `miraOllama:v10:${[a, b].sort().join('+')}:${state.version || 'unknown'}`;

    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached?.mira) {
        metrics.cacheHits += 1;
        return cached;
      }
    } catch {}

    const system = [
      'You create what two discoveries become in Mira Machine. This result is permanent for this pair and must be worth discovering.',
      'Use only ALLOWED FACTS. Never invent mission events, people, objects, intent, proximity, or evidence.',
      'Create one specific surprise: a contrast, anomaly, character implication, remembered pattern, or concrete new question.',
      'A gap is creative material, not a rejection. Name what the mismatch reveals about Mira, Percy, the sample, or the investigation without inventing an event.',
      'Never answer with no relationship, no shared context, different questions, lacking evidence, or a generic request for a timestamp.',
      'Speak in first person as Mira. Never refer to Mira as she or her.',
      'Never say branch, model, state, engine, unlock, resolved, game, player, prompt, context window, provided data, fragments, combination, or AI.',
      'Always return one reusable finding with a vivid two-to-four-word name, an active property, and 1-4 ALLOWED TAGS.',
      'Voice: precise, curious, dry, emotionally honest.',
      'Return JSON only: {"mira":"engaging complete message under 170 chars","question":"optional compelling question under 90 chars","finding":{"name":"required","prop":"required","tags":["required"]}}.',
      'No markdown. No beliefDelta.'
    ].join(' ');
    const allowedTags=[...(da.tags||[]),...(db.tags||[])].filter((tag,index,list)=>list.indexOf(tag)===index);
    const user = `Pair: ${da.name} (${da.prop}) with ${db.name} (${db.prop}). ALLOWED FACTS: ${JSON.stringify(grounding.facts || [])}. SUPPORT: ${grounding.support}. SHARED SUBJECTS: ${JSON.stringify(grounding.sharedSubjects || [])}. SHARED EVENTS: ${JSON.stringify(grounding.sharedEvents || [])}. WITNESSES: ${JSON.stringify(grounding.witnesses || [])}. ALLOWED TAGS: ${JSON.stringify(allowedTags)}.`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    const started = performance.now();

    try {
      metrics.calls += 1;
      const response = await fetch(`${endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          stream: false,
          format: 'json',
          think: false,
          options: { temperature: 0.25, num_predict: 220, seed: 4096 },
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
        })
      });
      if (!response.ok) throw new Error(`Ollama ${response.status}`);
      const payload = await response.json();
      const parsed = JSON.parse(payload?.message?.content || '{}');
      if(!parsed.finding?.name||!parsed.finding?.prop) throw new Error('Gemma 4 returned no reusable finding');
      const pair=[a,b].sort().join('+');
      const result = { mira: clean(parsed.mira, 180), question: clean(parsed.question, 90), source: 'ollama-gemma4', result:{id:await frontierId(pair,state.version||'unknown'),name:clean(parsed.finding.name,40),prop:clean(parsed.finding.prop,80),tags:Array.isArray(parsed.finding.tags)?parsed.finding.tags.filter(tag=>allowedTags.includes(tag)).slice(0,4):[]} };
      if (!result.mira) throw new Error('Gemma 4 returned no Mira line');
      if (!result.question) delete result.question;
      localStorage.setItem(cacheKey, JSON.stringify(result));
      metrics.results.push({ pair: [a, b], ms: Math.round(performance.now() - started), result });
      return result;
    } catch (error) {
      metrics.failures += 1;
      metrics.results.push({ pair: [a, b], error: String(error) });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  window.__miraInterpret = async function ollamaInterpret(a, b, shared, journey = {}) {
    const hypothesis = journey.hypothesis || { statement: 'Percy chose something over recall', confidence: 0 };
    const recent = Array.isArray(journey.recent) ? journey.recent.slice(-6) : [];
    const system = 'You are Mira reasoning with one player across a continuing Mars investigation. Explain what the fixed pair reading does to the current hypothesis using only the supplied reading and journey. Do not imply that the inputs interacted unless the reading says so. In Mira dialogue never say permanent result, combination, items, useful observation, no shared context, evidence suggests, supports the theory, software, state, prompts, or gameplay. Do not repeat the fixed reading. Speak in first person and say what I now suspect or what exact bridge I need. Use support or weaken only for the current hypothesis id; use replace when selecting a different allowed hypothesis id. Return JSON only: {"mira":"one complete sentence under 170 chars","question":"optional under 90 chars","hypothesis":{"id":"allowed id","effect":"support|weaken|replace|none","reason":"short reason"}}.';
    const user = `Pair: ${a} + ${b}. Fixed reading: ${JSON.stringify(shared)}. Current hypothesis: ${JSON.stringify(hypothesis)}. ALLOWED HYPOTHESES: ${JSON.stringify(journey.hypotheses||{})}. Recent discoveries: ${JSON.stringify(recent)}.`;
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),45000);
    const started=performance.now();
    try{
      metrics.calls+=1;
      const response=await fetch(`${endpoint}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({model,stream:false,format:'json',think:false,options:{temperature:0.2,num_predict:220,seed:4096},messages:[{role:'system',content:system},{role:'user',content:user}]})});
      if(!response.ok)throw new Error(`Ollama ${response.status}`);
      const payload=await response.json(); const parsed=JSON.parse(payload?.message?.content||'{}');
      const result={mira:clean(parsed.mira,180),question:clean(parsed.question,90),hypothesis:parsed.hypothesis,source:'ollama-interpretation'};
      if(!result.mira)throw new Error('Gemma 4 returned no journey interpretation'); if(!result.question)delete result.question;
      metrics.results.push({pair:[a,b],kind:'interpretation',ms:Math.round(performance.now()-started),result});return result;
    }catch(error){metrics.failures+=1;metrics.results.push({pair:[a,b],kind:'interpretation',error:String(error)});throw error;}finally{clearTimeout(timer);}
  };

  return metrics;
}
