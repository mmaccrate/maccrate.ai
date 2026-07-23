import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const URL=process.env.QA_URL||'http://127.0.0.1:4322/';
const OLLAMA=process.env.OLLAMA_ENDPOINT||'http://127.0.0.1:11434';
const browser=await chromium.launch({headless:true});
async function ready(page){await page.waitForFunction(()=>window.__miraMachine&&!window.__miraMachine.getState().busy,null,{timeout:20000});}
async function combo(page,a,b,result){await page.evaluate(([x,y])=>window.__miraMachine.combo(x,y),[a,b]);await page.waitForFunction(expected=>{const s=window.__miraMachine.getState();return !s.busy&&(!expected||s.discovered.includes(expected));},result||null,{timeout:65000});}
async function fresh(ollama=false){const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();await page.goto(ollama?`${URL}?ollama=1&ollamaEndpoint=${encodeURIComponent(OLLAMA)}`:URL,{waitUntil:'networkidle'});await ready(page);if(ollama)await page.waitForFunction(()=>window.__miraOllamaTest&&window.__miraFrontier);return {context,page};}

// Three different early priorities must all remain readable and converge without forcing chapter order.
const orders=[
  [['last_signal','rover_tracks','ghost_trail'],['blue_sample','last_signal','sample_absent'],['blue_sample','rover_tracks','percy_carried_it']],
  [['blue_sample','last_signal','sample_absent'],['blue_sample','rover_tracks','percy_carried_it'],['last_signal','rover_tracks','ghost_trail']],
  [['blue_sample','mirror_rock','prism_sample'],['last_signal','mirror_rock','reflected_call'],['last_signal','rover_tracks','ghost_trail']]
];
for(const order of orders){const {context,page}=await fresh();for(const step of order)await combo(page,...step);const state=await page.evaluate(()=>window.__miraMachine.getState());for(const step of order)assert.ok(state.discovered.includes(step[2]));const text=await page.locator('.chat').innerText();assert.doesNotMatch(text,/\b(?:quest|chapter|objective|unlock|resolved)\b/i);await context.close();}

// Regression: a dead/redundant pair must never reset the run.
{
  const {context,page}=await fresh(true);
  await combo(page,'last_signal','rover_tracks','ghost_trail');
  await combo(page,'ghost_trail','mirror_rock','echo_beacon');
  const before=await page.evaluate(()=>window.__miraMachine.getState().discovered.slice());
  await combo(page,'echo_beacon','mirror_rock');
  const after=await page.evaluate(()=>window.__miraMachine.getState().discovered.slice());
  assert.ok(after.includes('echo_beacon'),'Echo Beacon + Mirror Rock reset the run');
  assert.ok(after.length>=before.length,'dead pair removed discoveries');
  await context.close();
}

// A complete old-discovery/new-discovery chain must use stable intermediate findings.
{
  const {context,page}=await fresh();
  const path=[['last_signal','rover_tracks','ghost_trail'],['blue_sample','rover_tracks','percy_carried_it'],['blue_sample','last_signal','sample_absent'],['blue_sample','percy_carried_it','living_glass'],['living_glass','sample_absent','listening_silence'],['ghost_trail','mirror_rock','echo_beacon'],['percy_carried_it','rover_tracks','sayegh_note'],['echo_beacon','percy_carried_it','true_mission'],['mirror_rock','true_mission','clean_signal'],['clean_signal','living_glass','percy_comes_home'],['living_glass','percy_comes_home','passenger_signal'],['passenger_signal','sayegh_note','sayegh_echo'],['listening_silence','sayegh_echo','unlearned_voice']];
  for(const step of path)await combo(page,...step);
  const lines=await page.locator('.chat-entry.mira').allTextContents();
  assert.ok(lines.some(x=>/listen without answering/i.test(x)));
  assert.ok(lines.some(x=>/had not learned a voice/i.test(x)));
  await context.close();
}

// The local frontier proposal must remain grounded; the production registry claim makes only one client generate it.
async function localReading(){const {context,page}=await fresh(true);await combo(page,'last_signal','rover_tracks','ghost_trail');await combo(page,'ghost_trail','mirror_rock','echo_beacon');await combo(page,'echo_beacon','rover_tracks');const result=await page.evaluate(()=>structuredClone(window.__miraOllamaTest.results[0]?.result));const rendered=await page.locator('.chat-entry.mira').last().textContent();await context.close();return {result,rendered};}
const local=await localReading();
assert.ok(local.result?.mira?.length>20,'local frontier produced no reading');
assert.match(local.rendered,/\b(?:no|not|nothing|without|missing|lack|cannot|can’t|need|timestamp|witness|record)\b/i,'displayed local reading exceeded its evidence support');

await browser.close();
console.log('EXPLORATION PASS: three opening orders, stable multi-step chain, no quest framing, and grounded local frontier.');
