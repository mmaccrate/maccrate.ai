import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const url = process.env.MIRA_URL || 'http://localhost:4322/';
const profile = new URL('../.webgpu-test-profile/', import.meta.url).pathname;
await mkdir(profile, { recursive: true });

const context = await chromium.launchPersistentContext(profile, {
  headless: process.env.HEADED !== '1',
  viewport: { width: 1280, height: 720 },
  args: ['--enable-unsafe-webgpu'],
});
const page = context.pages()[0] || await context.newPage();
const problems = [];
page.on('console', m => {
  if (['warning', 'error'].includes(m.type())) problems.push(`${m.type()}: ${m.text()}`);
  if (/Loading \d+%|Local Mira|WebGPU/i.test(m.text())) console.log(m.text());
});
page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));

await page.goto(url);
const probe = await page.evaluate(async () => {
  const adapter = await navigator.gpu?.requestAdapter();
  return { secure: isSecureContext, webgpu: !!navigator.gpu, adapter: !!adapter, features: adapter ? [...adapter.features] : [] };
});
console.log('WebGPU probe:', JSON.stringify(probe));
if (!probe.adapter) throw new Error('No WebGPU adapter. Use a GPU-backed Chrome/device or keep --enable-unsafe-webgpu for software lifecycle tests.');

await page.locator('#gpuToggle').click();
if (!await page.locator('#localAiDialog').evaluate(dialog => dialog.open)) {
  throw new Error('Use local AI did not open the download confirmation dialog');
}
if ((await page.locator('#gpuToggle').textContent()) !== 'Use local AI') {
  throw new Error('Opening the Local Mira dialog started the model without explicit confirmation');
}
await page.getByRole('button', { name: 'Download local model' }).click();
let previous = '';
const deadline = Date.now() + Number(process.env.MIRA_WEBGPU_TIMEOUT_MS || 600000);
while (Date.now() < deadline) {
  const status = (await page.locator('#gpuToggle').textContent()) || '';
  if (status !== previous) { console.log(status); previous = status; }
  if (/Local (?:Mira|AI) ready|Story Mira active|Story mode/i.test(status)) break;
  await page.waitForTimeout(1000);
}

const status = await page.locator('#gpuToggle').textContent();
const ready=/Local (?:Mira|AI) ready/i.test(status||'');
if (ready && process.env.MIRA_REQUIRE_WEBGPU === '1') {
  const result = await page.evaluate(async () => {
    localStorage.removeItem('miraGen:v7:percy_comes_home+reflected_call');
    const state=window.__miraMachine.state;
    ['percy_comes_home','reflected_call'].forEach(id=>{if(!state.discovered.includes(id))state.discovered.push(id);});
    delete state.tried['percy_comes_home+reflected_call'];
    window.__miraMachine.combo('percy_comes_home','reflected_call');
    const deadline=Date.now()+180000;
    while(window.__miraMachine.getState().busy&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,250));
    return {
      state:window.__miraMachine.getState(),
      chat:document.querySelector('#chatScroll').innerText,
      generated:JSON.parse(localStorage.getItem('miraGen:v7:percy_comes_home+reflected_call')||'null')
    };
  });
  console.log('WebGPU pair result:', JSON.stringify(result));
  if (!result.state.tried['percy_comes_home+reflected_call']) throw new Error('WebGPU loaded but its generated pair was rejected');
}
if(!page.isClosed())await page.screenshot({ path: new URL('../webgpu-test-result.png', import.meta.url).pathname });
console.log('Final status:', status);
if (problems.length) console.log('Diagnostics:\n' + problems.slice(-20).join('\n'));
await context.close();
const requireInference=process.env.MIRA_REQUIRE_WEBGPU==='1';
const gracefulFallback=/Story mode|Story Mira active/i.test(status||'');
process.exitCode = ready || (!requireInference&&gracefulFallback) ? 0 : 2;
