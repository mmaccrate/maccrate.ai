import { chromium } from 'playwright';
import { webcrypto } from 'node:crypto';
import assert from 'node:assert/strict';

const APP = process.env.QA_URL || 'http://127.0.0.1:4322/';
const GAME = 'mira-chat-v10-growing-story';
const REGISTRY = 'https://registry.mira.test';
const encoder = new TextEncoder();

function b64url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out,key)=>{if(value[key]!==undefined)out[key]=stable(value[key]);return out;},{});
  return value;
}
async function pairId(inputs) {
  return b64url(await webcrypto.subtle.digest('SHA-256', encoder.encode(`${GAME}|${[...inputs].sort().join('+')}`)));
}
async function combo(page,a,b,result){
  await page.evaluate(([x,y])=>window.__miraMachine.combo(x,y),[a,b]);
  try {
    await page.waitForFunction(expected=>{const s=window.__miraMachine.getState();return !s.busy&&(!expected||s.discovered.includes(expected));},result||null,{timeout:20000});
  } catch(error) {
    console.error('COMBO TIMEOUT',a,b,result,await page.evaluate(()=>window.__miraMachine.getState()));
    throw error;
  }
}

const keys = await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const publicKeyJwk = await webcrypto.subtle.exportKey('jwk',keys.publicKey);
const canonicalInputs=['echo_beacon','rover_tracks'].sort();
const canonicalPair=await pairId(canonicalInputs);
const proposalInputs=['percy_carried_it','protected_route'].sort();
const proposalPair=await pairId(proposalInputs);
const pendingInputs=['prism_sample','rover_tracks'].sort();
const pendingPair=await pairId(pendingInputs);
const entry={
  id:'canonical-test-entry',status:'canonical',pairId:canonicalPair,gameVersion:GAME,inputs:canonicalInputs,
  discovery:{mira:'The tracks preserve Percy’s movement, but the beacon carries my voice. They do not share a speaker.',result:{id:'frontier_registry_voice_split',name:'Voice Split',prop:'separates movement from speaker',tags:['signal','motion']}},
  revision:1,createdAt:'2026-07-16T00:00:00Z'
};
const signature=b64url(await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,encoder.encode(JSON.stringify(stable(entry)))));
let frontierCalls=0;let submitted=null;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
await context.addInitScript(({endpoint,publicKeyJwk})=>{
  window.__MIRA_REGISTRY_CONFIG__={endpoint,publicKeyJwk};
  window.__miraFrontier=async()=>{window.__frontierCalls=(window.__frontierCalls||0)+1;return {mira:'Percy kept the sample while choosing the protected route. The same decision appears in the claw record and the mapped turn.',question:'What made that route worth the risk?',source:'local-frontier',result:{id:'frontier_shared_choice_bridge',name:'Protected Choice',prop:'joins the carried sample to the protected route',tags:['percy','sample']}};};
},{endpoint:REGISTRY,publicKeyJwk});
await context.route(`${REGISTRY}/**`,async route=>{
  const request=route.request();const url=new URL(request.url());
  if(request.method()==='GET'&&url.pathname.endsWith(canonicalPair)) return route.fulfill({status:200,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':new URL(APP).origin},body:JSON.stringify({found:true,entry,signature})});
  if(request.method()==='GET'&&url.pathname.endsWith(proposalPair)) return route.fulfill({status:404,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':new URL(APP).origin},body:JSON.stringify({found:false,proposalToken:'test-token'})});
  if(request.method()==='GET'&&url.pathname.endsWith(pendingPair)) return route.fulfill({status:404,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':new URL(APP).origin},body:JSON.stringify({found:false,pending:true})});
  if(request.method()==='POST'&&url.pathname==='/v1/proposals'){
    submitted=JSON.parse(request.postData());
    const written={id:'competing-first-valid-result',status:'canonical',pairId:submitted.pairId,gameVersion:GAME,inputs:submitted.inputs,discovery:{mira:'The shared archive already holds this protected choice. This signed reading is the one every investigation keeps.',question:'What made the protected route worth the risk?',source:'local-frontier',result:{id:'frontier_registry_choice_winner',name:'Shared Protected Choice',prop:'keeps the registry winner across every replay',tags:['percy','sample']}},revision:1,createdAt:'2026-07-16T00:00:01Z'};
    const writtenSignature=b64url(await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,encoder.encode(JSON.stringify(stable(written)))));
    return route.fulfill({status:409,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':new URL(APP).origin},body:JSON.stringify({duplicate:true,entry:written,signature:writtenSignature})});
  }
  return route.fulfill({status:404,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':new URL(APP).origin},body:'{}'});
});
const page=await context.newPage();
page.on('pageerror',error=>console.error('PAGE ERROR:',error.message));
page.on('console',message=>{if(message.type()==='error'||message.type()==='warning')console.error('BROWSER:',message.text());});
await page.goto(APP,{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__miraMachine&&window.__miraRegistry&&!window.__miraMachine.getState().busy);
await combo(page,'last_signal','rover_tracks','ghost_trail');
await combo(page,'ghost_trail','mirror_rock','echo_beacon');
await combo(page,'echo_beacon','rover_tracks','frontier_registry_voice_split');
assert.equal(await page.evaluate(()=>window.__frontierCalls||0),0,'canonical registry pair called local AI');
await combo(page,'blue_sample','mirror_rock','prism_sample');
await combo(page,'blue_sample','rover_tracks','percy_carried_it');
await page.evaluate(()=>window.__miraMachine.getState().discovered.push('protected_route'));
await combo(page,'percy_carried_it','protected_route');
await page.waitForTimeout(100);
assert.equal(await page.evaluate(()=>window.__frontierCalls||0),1,'unknown pair did not call local AI exactly once');
assert.ok(submitted,'unknown pair was not submitted');
assert.equal(submitted.pairId,proposalPair);
assert.deepEqual(submitted.inputs,proposalInputs);
assert.equal(submitted.proposalToken,'test-token');
assert.equal(submitted.proposal.result.id,'frontier_shared_choice_bridge','generated reusable finding was not included in the permanent write');
assert.equal(await page.locator('[data-id="frontier_shared_choice_bridge"]').count(),0,'losing local finding leaked into the tray');
assert.match(await page.locator('.chat-entry.mira').last().innerText(),/The shared archive already holds this protected choice/,'signed registry winner was not displayed');
await combo(page,'protected_route','percy_carried_it','frontier_registry_choice_winner');
assert.equal(await page.evaluate(()=>window.__frontierCalls||0),1,'repeat unknown pair called local AI again');
await combo(page,'prism_sample','rover_tracks');
assert.equal(await page.evaluate(()=>window.__frontierCalls||0),1,'pair already claimed by another user called local AI');
await browser.close();
console.log('REGISTRY CLIENT PASS: signed canonical lookup, generated finding submission, signed 409 winner replacement, and stable repeat cache.');
