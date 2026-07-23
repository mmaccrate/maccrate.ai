import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const APP=process.env.QA_URL||'http://localhost:4322/?ollama=1';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
await page.goto(APP,{waitUntil:'networkidle'});
await page.evaluate(()=>{localStorage.clear();location.reload();});
await page.waitForFunction(()=>window.__miraMachine&&window.__miraFrontier&&window.__miraInterpret&&!window.__miraMachine.getState().busy,{timeout:20000});

async function combo(a,b){
  await page.evaluate(([x,y])=>window.__miraMachine.combo(x,y),[a,b]);
  await page.waitForFunction(()=>!window.__miraMachine.getState().busy,{timeout:120000});
}

await page.evaluate(()=>window.__miraMachine.state.discovered.push('percy_carried_it','sayegh_note'));
await combo('percy_carried_it','sayegh_note');
const first=await page.evaluate(()=>({state:window.__miraMachine.getState(),metrics:window.__miraOllamaTest,chat:document.querySelector('#chatScroll').innerText}));
assert.equal(first.metrics.failures,0,'local Gemma call failed');
assert.equal(first.metrics.calls,2,'unknown pair must run one permanent-result call and one journey-interpretation call');
assert.ok(first.metrics.results.some(item=>item.kind==='interpretation'),'journey interpretation was not exercised');
assert.ok(first.state.interpretations['percy_carried_it+sayegh_note']?.mira,'journey interpretation was not saved in player state');
assert.ok(first.state.hypothesis?.statement,'active hypothesis is missing');
const generatedId=first.metrics.results[0].result.result?.id;
assert.ok(generatedId?.startsWith('frontier_'),'local AI did not create a reusable finding');
assert.ok(first.state.discovered.includes(generatedId),'AI finding did not enter the inventory');
console.log('AI JOURNEY SAMPLE',JSON.stringify({results:first.metrics.results,chat:first.chat,hypothesis:first.state.hypothesis}));
assert.ok(first.chat.includes(first.metrics.results[0].result.mira),'permanent global result was not shown in conversation');

await combo('sayegh_note','percy_carried_it');
const repeated=await page.evaluate(()=>({state:window.__miraMachine.getState(),metrics:window.__miraOllamaTest}));
assert.equal(repeated.metrics.calls,2,'repeating the pair reran local AI instead of replaying stable results');
assert.equal(repeated.state.interpretations['percy_carried_it+sayegh_note'].mira,first.state.interpretations['percy_carried_it+sayegh_note'].mira,'local journey interpretation changed on repeat');

await page.evaluate(id=>{if(!window.__miraMachine.state.discovered.includes('blue_sample'))window.__miraMachine.state.discovered.push('blue_sample');},generatedId);
await combo(generatedId,'blue_sample');
const chained=await page.evaluate(()=>({state:window.__miraMachine.getState(),metrics:window.__miraOllamaTest}));
const generatedFindings=chained.state.discovered.filter(id=>id.startsWith('frontier_'));
assert.ok(generatedFindings.length>=2,'AI-created finding could not create another finding');
assert.equal(chained.metrics.failures,0,'AI growth chain failed');
assert.deepEqual(errors,[],'browser errors occurred');
await browser.close();
console.log(`AI JOURNEY PASS: generated finding entered inventory, generated another finding, and replay stayed exact (${chained.metrics.calls} model calls).`);
