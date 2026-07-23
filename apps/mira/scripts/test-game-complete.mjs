import { chromium } from 'playwright';

const URL = process.env.QA_URL || 'http://127.0.0.1:4322/';
const OLLAMA = process.env.OLLAMA_ENDPOINT || 'http://127.0.0.1:11434';
const browser = await chromium.launch({ headless: true });
const failures = [];

const storyPath = [
  ['last_signal','rover_tracks','ghost_trail'],
  ['ghost_trail','mirror_rock','echo_beacon'],
  ['blue_sample','rover_tracks','percy_carried_it'],
  ['blue_sample','last_signal','sample_absent'],
  ['blue_sample','percy_carried_it','living_glass'],
  ['blue_sample','ghost_trail','singing_rock'],
  ['percy_carried_it','rover_tracks','sayegh_note'],
  ['ghost_trail','rover_tracks','dust_shroud'],
  ['dust_shroud','rover_tracks','turn_before_storm'],
  ['percy_carried_it','turn_before_storm','protected_route'],
  ['last_signal','mirror_rock','reflected_call'],
  ['blue_sample','mirror_rock','prism_sample'],
  ['ghost_trail','last_signal','sunrise_frame'],
  ['echo_beacon','percy_carried_it','true_mission'],
  ['blue_sample','true_mission','cold_shelter'],
  ['cold_shelter','protected_route','shelter_route'],
  ['sayegh_note','true_mission','self_edit'],
  ['reflected_call','self_edit','control_blackout'],
  ['mirror_rock','true_mission','clean_signal'],
  ['clean_signal','echo_beacon','two_speakers'],
  ['clean_signal','living_glass','percy_comes_home'],
  ['living_glass','sample_absent','listening_silence'],
  ['living_glass','percy_comes_home','passenger_signal'],
  ['percy_comes_home','singing_rock','altered_percy'],
  ['passenger_signal','sayegh_note','sayegh_echo'],
  ['listening_silence','sayegh_echo','unlearned_voice'],
  ['sayegh_echo','two_speakers','third_voice'],
  ['passenger_signal','third_voice','living_channel'],
  ['altered_percy','dust_shroud','buried_cache'],
  ['buried_cache','clean_signal','second_map'],
];

function check(condition, message) { if (!condition) failures.push(message); }
async function waitReady(page, timeout=20000) { await page.waitForFunction(() => window.__miraMachine && !window.__miraMachine.getState().busy, null, { timeout }); }
async function combo(page, a, b, result) {
  await page.evaluate(([x,y]) => window.__miraMachine.combo(x,y), [a,b]);
  await page.waitForFunction((expected) => {
    const s=window.__miraMachine.getState();
    return !s.busy && (!expected || s.discovered.includes(expected));
  }, result || null, { timeout: 65000 });
}

async function run(viewport, label, withOllama) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors=[];
  page.on('console',m=>{ if(m.type()==='error') errors.push(m.text()); });
  page.on('pageerror',e=>errors.push(e.message));
  const url = withOllama ? `${URL}?ollama=1&ollamaEndpoint=${encodeURIComponent(OLLAMA)}` : URL;
  await page.goto(url,{waitUntil:'networkidle'});
  await waitReady(page);
  if(withOllama) await page.waitForFunction(()=>window.__miraOllamaTest && window.__miraFrontier,{timeout:10000});

  const initial = await page.evaluate(() => ({
    order:[...document.querySelectorAll('.artifact')].map(x=>x.dataset.id),
    h:document.documentElement.scrollHeight, vh:innerHeight, sw:document.documentElement.scrollWidth, cw:innerWidth,
    controls:[...document.querySelectorAll('.chat-head button')].map(x=>x.textContent.trim()),
    artifactRects:[...document.querySelectorAll('.artifact')].map(x=>({w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height,x:x.getBoundingClientRect().x})),
    tray:{scrollWidth:document.querySelector('.sidebar-items').scrollWidth,clientWidth:document.querySelector('.sidebar-items').clientWidth}
  }));
  check(initial.h<=initial.vh+2,`${label}: page vertically overflows`);
  check(initial.sw<=initial.cw+2,`${label}: page horizontally overflows`);
  check(initial.controls.length===3,`${label}: chat controls missing`);
  check(initial.artifactRects.every(r=>r.h>=44),`${label}: artifact touch target below 44px`);
  check(initial.tray.scrollWidth<=initial.tray.clientWidth+2,`${label}: clue tray requires horizontal scrolling`);
  if(label==='mobile') check(new Set(initial.artifactRects.map(r=>Math.round(r.x))).size===2,`${label}: clue tray is not a two-column grid`);

  // Actual click path for the opening deduction.
  await page.locator('[data-id="last_signal"]').click();
  const selectedOrder=await page.evaluate(()=>[...document.querySelectorAll('.artifact')].map(x=>x.dataset.id));
  check(JSON.stringify(selectedOrder)===JSON.stringify(initial.order),`${label}: artifact order changed after selection`);
  await page.locator('[data-id="rover_tracks"]').click();
  await page.waitForFunction(()=>!window.__miraMachine.getState().busy&&window.__miraMachine.getState().discovered.includes('ghost_trail'),null,{timeout:20000});
  const openingTurn=await page.evaluate(()=>{
    const entries=[...document.querySelectorAll('.chat-entry')];const sent=entries.findIndex(x=>x.classList.contains('sent'));return {sent:entries[sent]?.textContent,fragments:entries[sent]?.querySelectorAll('.sent-fragment').length,replies:entries.slice(sent+1).filter(x=>x.classList.contains('mira')).length};
  });
  check(!openingTurn.sent.includes(' + '),`${label}: player turn still reads like a mechanical combination`);
  check(openingTurn.fragments===2,`${label}: submitted evidence is not shown as two chat attachments`);
  check(openingTurn.replies===1,`${label}: ordinary opening response should be one message, got ${openingTurn.replies}`);

  // Filter: without a selection, only fully exhausted fragments hide. A merely used fragment remains reusable.
  await page.locator('#filterToggle').click();
  let filterState=await page.evaluate(()=>({last:getComputedStyle(document.querySelector('[data-id="last_signal"]')).display,ghost:getComputedStyle(document.querySelector('[data-id="ghost_trail"]')).display}));
  check(filterState.last!=='none'&&filterState.ghost!=='none',`${label}: hide-exhausted hid a reusable fragment`);
  await page.locator('#filterToggle').click();

  await combo(page,'ghost_trail','mirror_rock','echo_beacon');
  await page.evaluate(()=>window.__miraMachine.choose('ghost_trail'));
  check(await page.locator('[data-id="mirror_rock"]').evaluate(el=>el.classList.contains('pair-tried')),`${label}: tried pair has no visible tried marker`);
  await page.locator('#filterToggle').click();
  filterState=await page.evaluate(()=>({selected:getComputedStyle(document.querySelector('[data-id="ghost_trail"]')).display,mirror:getComputedStyle(document.querySelector('[data-id="mirror_rock"]')).display}));
  check(filterState.selected!=='none'&&filterState.mirror==='none',`${label}: hide-used failed with selected first fragment`);
  await page.locator('#filterToggle').click();
  await page.evaluate(()=>window.__miraMachine.choose('ghost_trail'));

  if(withOllama){
    // Novel pair uses real Bebop Gemma 4; repeated pair is globally stable and never calls the model again.
    await combo(page,'echo_beacon','rover_tracks');
    const first=await page.evaluate(()=>({metrics:structuredClone(window.__miraOllamaTest),lines:[...document.querySelectorAll('.chat-entry.mira')].map(x=>x.textContent)}));
    check(first.metrics.calls===2&&first.metrics.failures===0,`${label}: Ollama Gemma 4 did not complete the shared-result and journey calls`);
    check(first.metrics.results[0]?.result?.source==='ollama-gemma4',`${label}: AI result source missing`);
    const aiLine=first.metrics.results[0]?.result?.mira||'';
    check(aiLine.length>20&&aiLine.length<=180,`${label}: AI line length invalid`);
    check(!/\b(branch|model|state|engine|unlock|resolved|prompt|player|game)\b/i.test(aiLine),`${label}: AI leaked software language: ${aiLine}`);
    check(!/provided data|existing evidence|causal link|shared moment/i.test(aiLine),`${label}: AI used clinical filler: ${aiLine}`);
    await combo(page,'echo_beacon','rover_tracks');
    const second=await page.evaluate(()=>structuredClone(window.__miraOllamaTest));
    check(second.calls===2,`${label}: repeat pair called Ollama again instead of cache`);
    // Authored finding must outrank AI.
    await combo(page,'blue_sample','last_signal');
    const afterSpecific=await page.evaluate(()=>({m:structuredClone(window.__miraOllamaTest),last:[...document.querySelectorAll('.chat-entry.mira')].at(-1)?.textContent||''}));
    check(afterSpecific.m.calls===2,`${label}: authored specific pair incorrectly called Ollama`);
    check(/absent|not carrying it/i.test(afterSpecific.last),`${label}: authored specific evidence was not preserved`);
  }

  // Continue through every authored recipe and both connected chapters.
  for(const [a,b,result] of storyPath.slice(2)) await combo(page,a,b,result);
  const beforeGrowth=await page.evaluate(()=>({calls:window.__miraOllamaTest?.calls||0,findings:window.__miraMachine.getState().discovered.filter(id=>id.startsWith('frontier_')).length}));
  await combo(page,'dust_shroud','percy_carried_it');
  const growth=await page.evaluate(()=>({calls:window.__miraOllamaTest?.calls||0,findings:window.__miraMachine.getState().discovered.filter(id=>id.startsWith('frontier_')).length,last:[...document.querySelectorAll('.chat-entry.mira')].at(-1)?.textContent||'',notice:[...document.querySelectorAll('.chat-entry.system')].at(-1)?.textContent||''}));
  if(withOllama){
    check(growth.calls===beforeGrowth.calls+2,`${label}: unrecognized relationship did not run local AI`);
    check(growth.findings===beforeGrowth.findings+1,`${label}: local AI relationship did not create an inventory finding`);
    check(!/no relationship|different questions|shared time|shared witness|turn on local ai/i.test(growth.last),`${label}: local AI returned generic filler`);
  }else check(/turn on local ai/i.test(growth.notice),`${label}: AI-disabled pair did not explain how to create the undiscovered result`);
  if(withOllama){
    await combo(page,'echo_beacon','rover_tracks');
    const stable=await page.evaluate(()=>structuredClone(window.__miraOllamaTest));
    check(stable.calls===growth.calls&&stable.failures===0,`${label}: stable pair called Gemma again after later discoveries`);
  }
  const final=await page.evaluate(()=>({
    state:window.__miraMachine.getState(),
    order:[...document.querySelectorAll('.artifact')].map(x=>x.dataset.id),
    messages:[...document.querySelectorAll('.chat-entry')].map(x=>({type:x.className,text:x.textContent})),
    overflow:document.documentElement.scrollWidth>innerWidth+2
  }));
  const transcript=final.messages.map(x=>x.text).join('\n');
  const replyCounts=[];let current=-1;
  final.messages.forEach(x=>{if(x.type.includes('sent')){replyCounts.push(0);current=replyCounts.length-1;}else if(current>=0&&x.type.includes('mira'))replyCounts[current]+=1;});
  check(!final.overflow,`${label}: overflow after complete playthrough`);
  check(final.state.discovered.includes('percy_comes_home'),`${label}: Chapter 1 did not resolve`);
  check(final.state.resolutions.includes('sayegh_echo'),`${label}: Passenger Signal did not resolve`);
  check(final.state.branchState['The Voice in Glass']?.status==='open',`${label}: next mystery did not remain open`);
  check(final.state.pairHistory.length>10&&Object.values(final.state.attention).some(x=>x>0),`${label}: investigation history or player attention was not retained`);
  check(/Percy isn’t lost|Percy was not lost/.test(transcript),`${label}: Percy choice truth missing`);
  check(/using Percy as an antenna/.test(transcript),`${label}: passenger signal truth missing`);
  check(/sample learning how to sound like her/.test(transcript),`${label}: next chapter question missing`);
  check(final.state.discovered.includes('listening_silence')&&final.state.discovered.includes('living_channel'),`${label}: stable multi-step discovery chains did not complete`);
  check(!final.messages.filter(x=>x.type.includes('mira')).some(x=>/^Mira:\s*/.test(x.text)),`${label}: redundant Mira prefixes remain`);
  check((transcript.match(/Sayegh was right/gi)||[]).length<=1,`${label}: side-discovery response repeats the same realization`);
  check(replyCounts.includes(1)&&replyCounts.includes(2),`${label}: Mira response cadence does not vary between one and two messages`);
  check(errors.length===0,`${label}: browser errors: ${errors.join(' | ')}`);
  await page.screenshot({path:`artifacts/qa/mira-complete-${label}.png`,fullPage:true});
  await context.close();
}

async function testSanitizer(){
  const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();await page.goto(URL,{waitUntil:'networkidle'});await waitReady(page);
  await page.evaluate(()=>localStorage.setItem('miraMachineState',JSON.stringify({version:'mira-chat-v5-living-mystery',discovered:['fake','last_signal','last_signal'],selected:['fake'],latest:'fake',tried:{'fake+last_signal':true},belief:{trust:999}})));
  await page.reload({waitUntil:'networkidle'});await waitReady(page);const s=await page.evaluate(()=>window.__miraMachine.getState());
  check(!s.discovered.includes('fake')&&new Set(s.discovered).size===s.discovered.length,'sanitizer: fake or duplicate artifact survived');
  check(s.selected.length===0&&s.latest===null,'sanitizer: invalid selection/latest survived');
  check(!Object.keys(s.tried).some(k=>k.includes('fake')),'sanitizer: invalid tried pair survived');
  await context.close();
}

async function testAccessibility(){
  const context=await browser.newContext({viewport:{width:320,height:568},reducedMotion:'reduce'});const page=await context.newPage();await page.goto(URL,{waitUntil:'networkidle'});await waitReady(page);
  const a=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,targets:[...document.querySelectorAll('button')].filter(x=>getComputedStyle(x).display!=='none'&&!!x.offsetParent).map(x=>x.getBoundingClientRect().height),filter:document.querySelector('#filterToggle').getAttribute('aria-pressed'),motion:getComputedStyle(document.querySelector('.artifact')).transitionDuration}));
  check(!a.overflow,'accessibility: 320px layout overflows horizontally');
  check(a.targets.every(h=>h>=19),'accessibility: visible control collapsed');
  check(a.filter==='false','accessibility: filter state is not exposed');
  check(parseFloat(a.motion)<=0.00001,'accessibility: reduced motion is not honored');
  await context.close();
}

try {
  await run({width:1366,height:900},'desktop-ollama',true);
  await run({width:390,height:844},'mobile',false);
  await testSanitizer();
  await testAccessibility();
} finally { await browser.close(); }
if(failures.length){console.error(JSON.stringify({failures},null,2));process.exit(1);}
console.log('QA PASS: complete authored chapters, Bebop Gemma 4 frontier, repeatable cache, specific-evidence priority, filters, stable order, state sanitizer, desktop/mobile UI.');
