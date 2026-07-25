import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const URL = process.env.MIRA_URL || 'http://127.0.0.1:4322/';
const VERSION = 'mira-chat-v10-growing-story';
const browser = await chromium.launch({ headless: true });
const check = (value, message) => { if (!value) throw new Error(message); };
const source=readFileSync(new globalThis.URL('../src/pages/index.astro',import.meta.url),'utf8');
check(source.includes('fallbackFinding(da,db,generated)'), 'WebGPU generations without finding metadata are not preserved');
check(!source.includes('Local AI returned no reusable finding'), 'brittle WebGPU finding-metadata failure returned');
check(!source.includes('model.chat('), 'WebGPU still calls nonexistent Gemma4Mobile.chat()');
check(source.includes('model.complete('), 'WebGPU does not call the shipped Gemma4Mobile inference API');
check(source.includes("LOCAL_MIRA_GAME_VERSION+'|'+pair"), 'WebGPU pair hashing depends on an out-of-scope game version');
check(source.includes('parseLocalModelResult(res,prompt)'), 'journey interpretation parser is not in module scope');
check(source.includes('if(localAiDialog.open)localAiDialog.close()'), 'ready Local AI modal does not close automatically');
check(source.includes('localAiAction.addEventListener(\'click\', startLocalMira)'), 'model download is not gated behind the explicit dialog action');
check(source.includes("adapter.features.has('shader-f16')"), 'model download does not stop for an unsupported WebGPU adapter');
check(source.includes('chrome://flags/#enable-unsafe-webgpu') && source.includes('chrome://flags/#enable-vulkan'), 'Linux Chrome setup instructions are incomplete');
check(!source.includes("r=authored;r.source='authored-fallback'"), 'unseen pairs still have a non-AI fallback');
check(source.includes("source:'ai-required'"), 'unseen pairs do not require Local AI');

async function ready(page) {
  await page.waitForFunction(() => window.__miraMachine && !window.__miraMachine.getState().busy, null, { timeout: 15000 });
}
async function combo(page, a, b) {
  await page.evaluate(([x,y]) => window.__miraMachine.combo(x,y), [a,b]);
  await ready(page);
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await ready(page);

  await page.locator('#gpuToggle').click();
  const downloadConsent = await page.evaluate(() => ({
    dialog: document.querySelector('#localAiDialog').open,
    action: document.querySelector('#localAiAction').textContent,
    toggle: document.querySelector('#gpuToggle').textContent
  }));
  check(downloadConsent.dialog, 'Use local AI did not open its confirmation dialog');
  check(downloadConsent.action === 'Download local model', 'download confirmation action is unclear');
  check(downloadConsent.toggle === 'Use local AI', 'opening the Local AI dialog started loading without consent');
  await page.evaluate(() => document.querySelector('#localAiDialog').close());

  await combo(page, 'last_signal', 'rover_tracks');
  const before = await page.evaluate(() => window.__miraMachine.getState());
  check(before.discovered.includes('ghost_trail'), 'authored discovery was not created');
  check(before.tried['last_signal+rover_tracks'], 'tried pair was not saved');

  await combo(page, 'blue_sample', 'mirror_rock');
  await combo(page, 'last_signal', 'prism_sample');
  const noGpuGate = await page.evaluate(() => ({ state: window.__miraMachine.getState(), text: document.querySelector('#chatScroll').textContent, dialog:document.querySelector('#localAiDialog').open }));
  check(!noGpuGate.state.tried['last_signal+prism_sample'], 'unseen pair was completed without Local AI');
  check(/Turn on Local AI to discover it here/i.test(noGpuGate.text), 'no-GPU pair did not explain how discovery works');
  check(noGpuGate.dialog, 'no-GPU pair did not open the Local AI prompt');

  await page.evaluate(() => { document.querySelector('#localAiDialog').close(); window.__miraFrontier = async () => { throw new Error('simulated local model failure'); }; });
  await combo(page, 'ghost_trail', 'prism_sample');
  const failedGpuGate = await page.evaluate(() => ({ state: window.__miraMachine.getState(), text: document.querySelector('#chatScroll').textContent, dialog:document.querySelector('#localAiDialog').open }));
  check(!failedGpuGate.state.tried['ghost_trail+prism_sample'], 'failed Local AI incorrectly completed the unseen pair');
  check(/Local AI did not create a valid discovery/i.test(failedGpuGate.text), 'failed Local AI did not explain the blocked discovery');
  check(failedGpuGate.dialog, 'failed Local AI did not reopen its recovery prompt');
  await page.evaluate(() => document.querySelector('#localAiDialog').close());

  await page.evaluate(() => {
    window.__miraFrontier = async () => ({mira:'This means that Percy remembered.',question:'Why now?',source:'webgpu-gemma4'});
  });
  await combo(page, 'last_signal', 'prism_sample');
  const acceptedWebGpu = await page.evaluate(() => ({state:window.__miraMachine.getState(),text:document.querySelector('#chatScroll').textContent}));
  check(acceptedWebGpu.state.tried['last_signal+prism_sample'], 'valid WebGPU output was rejected by shared-record prose rules');
  check(/Percy remembered/i.test(acceptedWebGpu.text), 'accepted WebGPU discovery was not shown');

  await page.reload({ waitUntil: 'networkidle' });
  await ready(page);
  const resumed = await page.evaluate(() => ({ state: window.__miraMachine.getState(), text: document.querySelector('#chatScroll').textContent }));
  check(resumed.state.discovered.includes('ghost_trail'), 'partial progress was lost on reload');
  check(resumed.state.tried['last_signal+rover_tracks'], 'tried-pair history was lost on reload');
  check(/Investigation restored on this device/i.test(resumed.text), 'resume acknowledgement is missing');
  check(!/Put them together for me/i.test(resumed.text), 'opening instruction incorrectly replayed after progress');

  await page.evaluate(() => window.__miraMachine.choose('blue_sample'));
  await page.reload({ waitUntil: 'networkidle' });
  await ready(page);
  const selectedResume = await page.evaluate(() => ({ state: window.__miraMachine.getState(), title: document.querySelector('#fragmentsTitle').textContent }));
  check(selectedResume.state.selected[0] === 'blue_sample', 'partially selected pair was lost on reload');
  check(/Blue Sample.*choose one more/i.test(selectedResume.title), 'resumed selection is not explained in the tray');
  await page.evaluate(() => window.__miraMachine.choose('blue_sample'));

  const countBeforeReverse = resumed.state.discovered.filter(x => x === 'ghost_trail').length;
  await combo(page, 'rover_tracks', 'last_signal');
  const reversed = await page.evaluate(() => window.__miraMachine.getState());
  check(reversed.discovered.filter(x => x === 'ghost_trail').length === countBeforeReverse, 'reversed pair duplicated its result');
  check(reversed.pairHistory.length === resumed.state.pairHistory.length, 'reversed repeat duplicated investigation history');

  await page.evaluate(version => {
    const state = window.__miraMachine.getState();
    state.version = version;
    state.frontierArtifacts = {
      shared_probe: { id:'shared_probe', name:'Shared Probe', mira:'This record survived the handoff.', question:'What does it clarify?', prop:'survives a reload', tags:['signal'] },
      '../bad': { id:'../bad', name:'Bad', mira:'Bad' }
    };
    state.discovered.push('shared_probe','../bad');
    localStorage.setItem('miraMachineState', JSON.stringify(state));
  }, VERSION);
  await page.reload({ waitUntil: 'networkidle' });
  await ready(page);
  const frontier = await page.evaluate(() => window.__miraMachine.getState());
  check(frontier.discovered.includes('shared_probe'), 'generated frontier finding did not survive reload');
  check(!frontier.discovered.includes('../bad'), 'invalid generated finding survived sanitizer');
  check(await page.locator('[data-id="shared_probe"]').count() === 1, 'restored generated finding is missing from tray');

  let dismissed = false;
  page.once('dialog', async dialog => { dismissed = true; await dialog.dismiss(); });
  await page.getByRole('button', { name: 'restart conversation' }).click();
  check(dismissed, 'restart did not request confirmation');
  check((await page.evaluate(() => window.__miraMachine.getState())).discovered.includes('ghost_trail'), 'dismissed restart erased progress');

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'restart conversation' }).click();
  await ready(page);
  const reset = await page.evaluate(() => window.__miraMachine.getState());
  check(reset.discovered.length === 4 && reset.pairHistory.length === 0, 'confirmed restart did not clear progress');

  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    targets: [...document.querySelectorAll('button, a.privacy-link')].filter(el => el.offsetParent).map(el => ({ label: el.getAttribute('aria-label') || el.textContent.trim(), w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }))
  }));
  check(metrics.scroll <= metrics.viewport + 2, 'mobile page has horizontal overflow');
  const tooSmall = metrics.targets.filter(x => x.w < 44 || x.h < 44);
  check(!tooSmall.length, `undersized controls: ${JSON.stringify(tooSmall)}`);

  await page.goto(new globalThis.URL('privacy', URL).href, { waitUntil: 'networkidle' });
  const privacy = await page.evaluate(() => ({
    heading: document.querySelector('h1')?.textContent,
    text: document.body.textContent,
    viewport: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth
  }));
  check(/Privacy notice/i.test(privacy.heading || ''), 'Mira privacy page is missing');
  check(/Data on your device/i.test(privacy.text) && /Shared discoveries/i.test(privacy.text), 'Mira privacy page does not describe its actual data flows');
  check(privacy.scroll <= privacy.viewport + 2, 'Mira privacy page has horizontal overflow');

  await context.close();
  console.log('RELEASE CANDIDATE PASS: persistence, repeatability, restart safety, mobile bounds, and dedicated privacy notice.');
} finally {
  await browser.close();
}
