import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const URL=process.env.MIRA_URL||'http://127.0.0.1:4322/';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage();
await page.goto(URL,{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__miraMachine&&!window.__miraMachine.getState().busy);

const notebook=async()=>page.evaluate(()=>({
  question:document.querySelector('#currentQuestion')?.textContent,
  theory:document.querySelector('#currentTheory')?.textContent,
  leads:[...document.querySelectorAll('.lead-pair')].map(button=>({text:button.textContent,a:button.dataset.a,b:button.dataset.b,height:button.getBoundingClientRect().height})),
  source:document.querySelector('#lastResponseSource')?.textContent,
  aiCount:document.querySelector('#localAiCount')?.textContent
}));
const follow=async expected=>{
  await page.locator('.lead-pair').first().click();
  await page.waitForFunction(result=>!window.__miraMachine.getState().busy&&window.__miraMachine.getState().discovered.includes(result),expected,{timeout:20000});
};

const opening=await notebook();
assert.match(opening.question,/last signal.*tracks/i);
assert.match(opening.theory,/Percy chose something over recall/i);
assert.equal(opening.leads[0]?.text,'Last Signal + Rover Tracks');
assert.ok(opening.leads.every(lead=>lead.height>=44),'lead touch target is below 44px');
assert.equal(opening.source,'Not loaded');
assert.match(opening.aiCount,/^0 discoveries created$/);

const beforeUnavailable=await page.locator('.chat-entry.mira').count();
await page.evaluate(()=>window.__miraMachine.combo('mirror_rock','rover_tracks'));
await page.waitForFunction(()=>!window.__miraMachine.getState().busy);
assert.equal(await page.locator('.chat-entry.mira').count(),beforeUnavailable,'AI-disabled unknown pair fabricated a Mira response');
assert.equal(await page.evaluate(()=>!!window.__miraMachine.getState().tried['mirror_rock+rover_tracks']),false,'AI-disabled unknown pair was incorrectly marked tried');
assert.match(await page.locator('.chat-entry.system').last().innerText(),/turn on local ai/i);

await follow('ghost_trail');
const choice=await notebook();
assert.match(choice.question,/what was Percy protecting/i);
assert.equal(choice.leads[0]?.text,'Blue Sample + Rover Tracks');

await follow('percy_carried_it');
const teacher=await notebook();
assert.match(teacher.question,/who taught Percy/i);
assert.ok(teacher.leads.length>=1,'guided investigation stopped offering leads');

assert.equal(await page.locator('.response-source').count(),0,'technical provenance labels leaked into the player transcript');
assert.equal(await page.evaluate(()=>window.__miraMachine.getResponseTrace().localAiCalls),0,'authored guided path was mislabeled as local AI');

await browser.close();
console.log('GUIDED INVESTIGATION PASS: current question, theory, 44px leads, story-aligned progression, and honest AI attribution.');
