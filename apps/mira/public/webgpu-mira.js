// Frontier Mode — loads Gemma 4 E2B in-browser via the same custom WebGPU runtime
// used by the HuggingFace webml-community/gemma-4-webgpu-kernels example space.
// The gemma-4-e2b.js bundle is copied directly from that space (public/gemma-4-e2b.js).
// This wires the loaded model into the game's window.__miraFrontier hook.

import { Gemma4Mobile } from "/gemma-4-e2b.js";

const $ = (id) => document.getElementById(id);
const fill = $("fill"), status = $("status"), demo = $("demo"), out = $("out");

const SEED = {
  last_signal:{name:"Last Signal",prop:"repeats"},
  rover_tracks:{name:"Rover Tracks",prop:"records the path"},
  blue_sample:{name:"Blue Sample",prop:"is what he protected"},
  mirror_rock:{name:"Mirror Rock",prop:"reflects"},
  ghost_trail:{name:"Ghost Trail",prop:"loops back on itself"},
  echo_beacon:{name:"Echo Beacon",prop:"is her own voice"}
};

function fillDemoSelects(){
  const a=$("a"), b=$("b");
  Object.keys(SEED).forEach((id)=>{
    a.insertAdjacentHTML("beforeend",`<option value="${id}">${SEED[id].name}</option>`);
    b.insertAdjacentHTML("beforeend",`<option value="${id}">${SEED[id].name}</option>`);
  });
  if(b.options.length>1) b.selectedIndex=1;
}
fillDemoSelects();

let model = null;

function setStatus(t, pct){ status.textContent=t; if(pct!=null) fill.style.width=pct+"%"; }

async function wake(){
  if(!navigator.gpu){
    setStatus("WebGPU isn't available here. Try a recent Chrome or Edge. The mystery still plays fully at /.");
    status.classList.add("warn");
    return;
  }
  $("wake").disabled = true;
  setStatus("Requesting WebGPU device…", 2);
  try{
    model = await Gemma4Mobile.load(null, {
      onProgress: (e)=>{
        if(e && typeof e.fraction === "number"){
          const pct = 2 + Math.round(e.fraction * 90);
          setStatus(`Loading Mira — ${Math.round(e.fraction*100)}%`, pct);
        }
      }
    });
    setStatus("Warming up kernels…", 95);
    await model.warmup();
    setStatus("Mira is awake on your GPU. Try a combination below.", 100);
    demo.classList.add("on");
    wireFrontier();
  }catch(e){
    console.error(e);
    setStatus("Failed to load: "+(e&&e.message?e.message:e)+". The mystery still plays fully at /.");
    status.classList.add("warn");
    $("wake").disabled = false;
  }
}

async function askMira(aId, bId){
  const A = SEED[aId] || {name:aId,prop:"is unknown"};
  const B = SEED[bId] || {name:bId,prop:"is unknown"};
  const prompt =
    `You are Mira, a wounded Mars-mission AI reconstructing why rover Percy vanished. `+
    `Two fragments are combined: "${A.name}" (${A.prop}) and "${B.name}" (${B.prop}). `+
    `Reply with ONE sentence, under 90 characters, in Mira's grieving precise voice. No preamble.`;
  const messages = [{ role: "user", content: prompt }];
  let result = await model.complete(messages, { maxNewTokens: 96 });
  // Clean up: strip echoed prompt, trim, limit
  if(result.indexOf(prompt)===0) result = result.slice(prompt.length);
  result = result.replace(/\s+/g," ").trim();
  if(result.length>110) result = result.slice(0,107)+"…";
  return "Mira: " + result;
}

// The hook the game calls. Warm-cache: return cached or "thinking" placeholder.
const pending = {};
function wireFrontier(){
  window.__miraFrontier = function(aId, bId, ctx){
    const key = [aId,bId].sort().join("+");
    try{
      const c = localStorage.getItem("miraGen:"+key);
      if(c) return { result:null, mira:c, source:"webgpu-cache" };
    }catch(e){}
    if(!pending[key]){
      pending[key]=true;
      askMira(aId,bId).then((line)=>{
        try{ localStorage.setItem("miraGen:"+key,line); }catch(e){}
        pending[key]=false;
      }).catch(()=>{ pending[key]=false; });
    }
    return {
      result:null,
      mira:"Mira: (considering "+(SEED[aId]?SEED[aId].name:aId)+" and "+(SEED[bId]?SEED[bId].name:bId)+"…)",
      source:"webgpu-pending"
    };
  };
}

$("wake").addEventListener("click", wake);
$("gen").addEventListener("click", async ()=>{
  if(!model){ out.textContent="Wake Mira first."; return; }
  out.textContent="Mira is thinking…";
  try{ out.textContent = await askMira($("a").value, $("b").value); }
  catch(e){ out.textContent="Generation failed: "+(e&&e.message?e.message:e); }
});

setStatus("Click \u201cWake Mira\u201d to load Gemma 4 on your GPU.");
