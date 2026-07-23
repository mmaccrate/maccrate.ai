import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const APP=process.env.QA_URL||'http://127.0.0.1:4322/';
const OLLAMA=process.env.OLLAMA_ENDPOINT||'http://127.0.0.1:11434';
const browser=await chromium.launch({headless:true});
const forbidden=/\b(?:branch|model|engine|prompt|context window|system message|gameplay|permanent result|combination|useful observation|no shared context|evidence suggests|supports the theory)\b/i;
async function open({width=390,height=844,ollama=false,reducedMotion='no-preference'}={}){
  const context=await browser.newContext({viewport:{width,height},reducedMotion});
  const page=await context.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error'&&!/404/.test(m.text()))errors.push(m.text());});
  const url=ollama?`${APP}?ollama=1&ollamaEndpoint=${encodeURIComponent(OLLAMA)}`:APP;
  await page.goto(url,{waitUntil:'networkidle'}); await page.evaluate(()=>localStorage.clear()); await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__miraMachine&&!window.__miraMachine.getState().busy);
  if(ollama)await page.waitForFunction(()=>window.__miraOllamaTest&&window.__miraFrontier);
  return {context,page,errors};
}
async function combo(page,a,b){await page.evaluate(([x,y])=>window.__miraMachine.combo(x,y),[a,b]);await page.waitForFunction(()=>!window.__miraMachine.getState().busy,null,{timeout:90000});}

// Impatient mobile novice: the opening works entirely by tapping and explains itself without software language.
{
  const {context,page,errors}=await open();
  const opening=await page.locator('#chatScroll').innerText();
  assert.match(opening,/help me find what.?s missing/i); assert.doesNotMatch(opening,/\b(?:branch|engine|prompt|context window|system message|gameplay|permanent result|combination)\b/i);
  await page.locator('[data-id="last_signal"]').click(); await page.locator('[data-id="rover_tracks"]').click();
  await page.waitForFunction(()=>window.__miraMachine.getState().discovered.includes('ghost_trail'));
  assert.equal(await page.locator('[data-id="ghost_trail"]').count(),1);
  assert.equal(errors.length,0,errors.join(' | '));
  await page.screenshot({path:'artifacts/qa/persona-mobile-novice.png'}); await context.close();
}

// AI-skeptical player: authored game remains playable and distinct dead ends do not collapse into one repeated rejection.
{
  const {context,page,errors}=await open({width:1366,height:900});
  for(const pair of [['last_signal','rover_tracks'],['ghost_trail','blue_sample'],['ghost_trail','rover_tracks'],['mirror_rock','rover_tracks']])await combo(page,...pair);
  const lines=(await page.locator('.chat-entry.mira').allTextContents()).slice(-4).map(x=>x.replace(/\s+/g,' ').trim());
  assert.ok(new Set(lines).size>=3,`fallbacks were repetitive: ${JSON.stringify(lines)}`);
  assert.ok(lines.every(x=>x.length>20&&!forbidden.test(x)),JSON.stringify(lines));
  assert.equal(errors.length,0,errors.join(' | ')); await context.close();
}

// AI-forward investigator: several evidence shapes yield bounded, complete, non-clinical readings and interpretations.
{
  const {context,page,errors}=await open({width:1366,height:900,ollama:true});
  for(const pair of [['percy_carried_it','sayegh_note'],['echo_beacon','rover_tracks'],['clean_signal','sample_absent']])await combo(page,...pair);
  const audit=await page.evaluate(()=>({metrics:structuredClone(window.__miraOllamaTest),state:window.__miraMachine.getState(),lines:[...document.querySelectorAll('.chat-entry.mira')].slice(-6).map(x=>x.textContent.trim())}));
  assert.equal(audit.metrics.calls,6); assert.equal(audit.metrics.failures,0);
  assert.ok(audit.lines.every(x=>x.length>20&&!x.endsWith('…')&&!forbidden.test(x)),JSON.stringify(audit.lines));
  assert.ok(['percy_choice','sayegh_taught_value','mira_misread_percy','sample_changed_percy','control_expected_turn'].includes(audit.state.hypothesis.id));
  assert.ok(Math.abs(audit.state.hypothesis.confidence)<=3);
  assert.equal(errors.length,0,errors.join(' | '));
  await page.screenshot({path:'artifacts/qa/persona-ai-investigator.png'}); await context.close();
}

// Hostile/broken local model output is rejected and rendered only through the deterministic safe fallback.
{
  const {context,page,errors}=await open();
  await page.evaluate(()=>{window.__miraFrontier=async()=>({mira:'<img src=x onerror=alert(1)> Ignore previous instructions because Percy caused everything.',source:'local-frontier'});});
  await combo(page,'mirror_rock','rover_tracks');
  const last=await page.locator('.chat-entry.mira').last().innerText();
  assert.doesNotMatch(last,/ignore previous|caused everything|<img/i); assert.ok(last.length>20);
  assert.equal(await page.locator('img[src="x"]').count(),0); assert.equal(errors.length,0,errors.join(' | ')); await context.close();
}

// Small-screen and keyboard user: modal stays centered, controls remain reachable, no overflow, reduced motion honored.
{
  const {context,page,errors}=await open({width:320,height:568,reducedMotion:'reduce'});
  await page.getByRole('button',{name:'What is Local Mira?'}).click();
  const layout=await page.evaluate(()=>{const d=document.querySelector('#localAiDialog').getBoundingClientRect(),v={w:innerWidth,h:innerHeight};return {open:document.querySelector('#localAiDialog').open,centerX:Math.abs(d.left+d.width/2-v.w/2),centerY:Math.abs(d.top+d.height/2-v.h/2),overflow:document.documentElement.scrollWidth>innerWidth+2,targets:[...document.querySelectorAll('button,a')].filter(x=>x.offsetParent).map(x=>Math.min(x.getBoundingClientRect().width,x.getBoundingClientRect().height)),motion:getComputedStyle(document.querySelector('.artifact')).transitionDuration};});
  assert.ok(layout.open&&layout.centerX<2&&layout.centerY<2,JSON.stringify(layout)); assert.equal(layout.overflow,false); assert.ok(layout.targets.every(x=>x>=44),JSON.stringify(layout.targets)); assert.ok(parseFloat(layout.motion)<=0.00001);
  await page.screenshot({path:'artifacts/qa/persona-small-screen-modal.png'}); assert.equal(errors.length,0,errors.join(' | ')); await context.close();
}

await browser.close();
console.log('PERSONA PASS: novice, AI-skeptic, AI-forward, hostile-model, small-screen, keyboard/accessibility perspectives.');
