const configuredMiraUrl = import.meta.env.PUBLIC_MIRA_URL;
const configuredCartridgesUrl = import.meta.env.PUBLIC_CARTRIDGES_URL;

export type ProjectSection = { eyebrow: string; title: string; body: string };
export type ProjectCredit = { label: string; value: string };
export type Project = {
  sequence: number;
  slug: string;
  title: string;
  year: number;
  descriptor: string;
  premise: string;
  disciplines: string[];
  role: string;
  status: 'live' | 'case-study';
  accent: string;
  cover: 'mira' | 'geometric';
  liveUrl?: string;
  credits: ProjectCredit[];
  sections: ProjectSection[];
};

export const PROJECTS: Project[] = [
  {
    sequence: 4,
    slug: 'build-telemetry',
    title: 'Hermes Builds maccrate.ai',
    year: 2026,
    descriptor: 'Hermes Agent · managed software delivery',
    premise: 'How persistent context, model routing, tools, and review loops turn Hermes Agent sessions into maccrate.ai releases.',
    disciplines: ['Agent systems', 'Data design', 'Interactive writing'],
    role: 'Agent workflow design, telemetry normalization, engineering review',
    status: 'case-study',
    accent: '#6b3fb8',
    cover: 'geometric',
    credits: [
      { label: 'Source', value: 'Local Hermes session records · all available retained history' },
      { label: 'Output', value: 'Static privacy-safe snapshot · regenerated offline' },
      { label: 'Coverage', value: 'Metadata and aggregates only · no conversation text' },
    ],
    sections: [
      { eyebrow: 'Method', title: 'The words stay private; the shape remains.', body: 'This interactive article follows the measured session, model, route, project, and tool metadata behind maccrate.ai without publishing prompts, responses, paths, or arguments.' },
    ],
  },
  {
    sequence: 3,
    slug: 'browser-lora-cartridges',
    title: 'LoRA, On Demand',
    year: 2026,
    descriptor: 'Browser-local AI · runtime LoRA switching',
    premise: 'One local model, multiple fine-tuned applications, and no inference server.',
    disciplines: ['Local AI', 'Runtime engineering', 'Fine-tuning'],
    role: 'Runtime fork, model training, product design, evaluation',
    status: configuredCartridgesUrl || import.meta.env.DEV ? 'live' : 'case-study',
    accent: '#176b4d',
    cover: 'geometric',
    liveUrl: configuredCartridgesUrl || (import.meta.env.DEV ? 'http://localhost:6342/' : undefined),
    credits: [
      { label: 'Shared model', value: 'Qwen3.5 2B · GGUF Q4_K_M · loaded once' },
      { label: 'Adapters', value: 'Two fine-tuned GGUF LoRAs · Weather Radio and Stagehand' },
      { label: 'Runtime', value: 'wllama-lora fork · llama.cpp · WebAssembly · WebGPU' },
    ],
    sections: [
      { eyebrow: 'Distribution', title: 'The base model becomes shared local infrastructure.', body: 'The browser loads one compatible Qwen3.5 2B base model and applies smaller task-specific LoRA adapters around it. A new capability can ship as an adapter instead of another complete model or hosted inference endpoint.' },
      { eyebrow: 'Runtime', title: 'The adapters run in the browser.', body: 'The wllama-lora fork carries llama.cpp LoRA support through WebAssembly and WebGPU. The app keeps the base loaded, fetches the selected release adapter from Hugging Face, and validates it before activation.' },
      { eyebrow: 'Proof', title: 'The same request runs with and without the adapter.', body: 'Compare Mode holds the request and runtime settings steady while it shows the base response beside the adapted result. The difference is visible in the model output and task behavior.' },
      { eyebrow: 'Demonstration', title: 'Two focused applications test the approach.', body: 'Weather Radio turns language into a bounded forecast request and grounds the result with Open-Meteo data. Stagehand turns language into strict actions for one authored broadcast scene. Base Console provides the no-adapter control.' },
    ],
  },
  {
    sequence: 2,
    slug: 'hello-world-ai-fine-tuning',
    title: 'Hello, Fine-Tuning',
    year: 2026,
    descriptor: 'AI field report · trained at home',
    premise: 'I went looking for the smallest fine-tuning experiment that could prove the whole pipeline worked on my home PC.',
    disciplines: ['Local AI', 'Experiment design', 'Interactive writing'],
    role: 'Research, training, evaluation, interaction design',
    status: 'case-study',
    accent: '#ff5a36',
    cover: 'geometric',
    credits: [
      { label: 'Hardware', value: 'AMD Ryzen AI Max · Strix Halo · 96 GB unified memory' },
      { label: 'Stack', value: 'Hermes Agent · Unsloth Studio · Gemma 4 E2B' },
      { label: 'Evidence', value: 'JSONL · adapter controls · reload tests · SHA-256' },
    ],
    sections: [
      { eyebrow: 'Thesis', title: 'A saved adapter is not a successful fine-tune.', body: 'The useful proof is causal: freeze a test, switch the adapter off, on, and off again, then demand that behavior follows the switch.' },
      { eyebrow: 'Interface', title: 'Treat capabilities like cartridges—but label the hardware honestly.', body: 'The portfolio prototype uses behavior presets today. A true browser LoRA cartridge requires a compatible base revision, GGUF adapter, and an experimentally verified WebGPU runtime.' },
    ],
  },
  {
    sequence: 1,
    slug: 'mira-machine',
    title: 'Mira Machine',
    year: 2026,
    descriptor: 'Interactive mystery',
    premise: 'A rover came home carrying something alive. Help Mira remember why.',
    disciplines: ['Product design', 'Frontend engineering', 'Local AI'],
    role: 'Concept, design, engineering, story system',
    status: configuredMiraUrl || import.meta.env.DEV ? 'live' : 'case-study',
    accent: '#2667ff',
    cover: 'mira',
    liveUrl: configuredMiraUrl || (import.meta.env.DEV ? 'http://localhost:4322/' : undefined),
    credits: [
      { label: 'Role', value: 'Concept, design, engineering, story system' },
      { label: 'Client runtime', value: 'Astro · JavaScript · WebGPU · Gemma 4' },
      { label: 'Shared layer', value: 'Cloudflare Worker · D1 · ECDSA signatures' },
    ],
    sections: [
      {
        eyebrow: 'Story design',
        title: 'The AI companion is also a system under investigation.',
        body: 'Mira was Percy’s navigation model, so her missing records and earlier decisions are part of the mystery. The player tests her interpretation against mission evidence instead of treating the assistant as an all-knowing narrator.'
      },
      {
        eyebrow: 'Evidence engine',
        title: 'The mystery is a deterministic evidence graph.',
        body: 'Each fragment has structured facts, provenance, subjects, events, timestamps, and story gates. Combining two nodes can produce a new reusable node, allowing discoveries to chain forward without rewriting earlier results. Authored relationships also support contradictions, chronology checks, exclusions, and missing-evidence responses rather than reducing every pair to a success or failure.'
      },
      {
        eyebrow: 'Repeatability',
        title: 'Pair resolution is deterministic before it is generative.',
        body: 'The client sorts the two evidence IDs and combines them with the game version to create one canonical pair key. Resolution follows a fixed order: authored recipe, authored relationship, signed shared discovery, then local generation. Reversing or repeating a pair therefore returns the same result, and a discovery already made is never silently regenerated.'
      },
      {
        eyebrow: 'Local inference',
        title: 'Gemma 4 runs in the browser, outside the canonical story path.',
        body: 'A custom WebGPU runtime loads Gemma 4 locally, so unknown-pair interpretation does not require a hosted chat API. The model receives bounded evidence context and can phrase a proposed finding, but it cannot change authored facts, unlock protected revelations, or overwrite an existing pair. Story mode remains complete when WebGPU is unavailable.'
      },
      {
        eyebrow: 'Shared registry',
        title: 'Cross-player discoveries pass through a signed trust boundary.',
        body: 'A Cloudflare Worker sits between browsers and D1; browsers never write canonical discoveries directly. The Worker applies origin checks, rate limits, content validation, and single-flight claims so two players cannot establish different answers for the same new pair. Approved records are signed with ECDSA, and the browser verifies the signature before accepting them.'
      },
      {
        eyebrow: 'Failure design',
        title: 'The playable mystery does not depend on the model or registry.',
        body: 'The authored investigation ships as a static Astro application and continues if WebGPU, the model, or the registry is unavailable. Browser storage restores discoveries, tried pairs, open questions, generated artifacts, and a pending first selection. Saved data is versioned and sanitized before it is allowed back into the evidence graph.'
      },
    ],
  },
];

export const featuredProject = PROJECTS.find((project) => project.slug === 'mira-machine')!;
export const projectNumber = (sequence: number) => String(sequence).padStart(2, '0');
