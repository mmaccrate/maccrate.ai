import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const APP=process.env.MIRA_URL || 'http://127.0.0.1:4322/';
const PAIR=['percy_comes_home','reflected_call'];
const KEY=[...PAIR].sort().join('+');
const browser=await chromium.launch({headless:true});

async function openWithLocalStub(){
  const context=await browser.newContext({ignoreHTTPSErrors:true});
  await context.addInitScript(()=>{
    window.__localRegistryTestCalls=0;
    window.__miraFrontier=async()=>{
      window.__localRegistryTestCalls+=1;
      return {mira:'Percy came home carrying the timing of my reflected call. The return and the echo now share one cadence.',question:'Which arrival recorded it first?',source:'local-frontier',result:{id:'frontier_dev_home_echo',name:'Home Echo',prop:'joins Percy’s return to Mira’s reflected cadence',tags:['percy','signal','mira']}};
    };
  });
  const page=await context.newPage();
  await page.goto(APP,{waitUntil:'networkidle'});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__miraMachine&&window.__miraRegistry&&!window.__miraMachine.getState().busy);
  return {context,page};
}

async function runPair(page){
  await page.evaluate(pair=>{
    const state=window.__miraMachine.state;
    pair.forEach(id=>{if(!state.discovered.includes(id))state.discovered.push(id);});
    window.__miraMachine.combo(pair[0],pair[1]);
  },PAIR);
  await page.waitForFunction(key=>!window.__miraMachine.getState().busy&&window.__miraMachine.getState().tried[key],KEY,{timeout:30000});
  return page.evaluate(()=>({calls:window.__localRegistryTestCalls,state:window.__miraMachine.getState(),chat:document.querySelector('#chatScroll').innerText}));
}

try{
  const first=await openWithLocalStub();
  const written=await runPair(first.page);
  assert.equal(written.calls,1,'first unseen pair did not invoke Local AI exactly once');
  assert.ok(written.state.discovered.includes('frontier_dev_home_echo'),'local D1 write did not return the canonical finding');
  assert.doesNotMatch(written.chat,/Saved on this device|Sharing will retry/i,'successful local D1 write was reported as device-only');
  await first.context.close();

  const second=await openWithLocalStub();
  const read=await runPair(second.page);
  assert.equal(read.calls,0,'fresh browser regenerated a pair already stored in local D1');
  assert.ok(read.state.discovered.includes('frontier_dev_home_echo'),'fresh browser did not receive the canonical local D1 finding');
  await second.context.close();
  console.log('LOCAL REGISTRY PASS: unseen pair generated once, persisted to Wrangler local D1, and replayed canonically in a fresh browser.');
}finally{
  await browser.close();
}
