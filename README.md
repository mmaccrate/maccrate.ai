# maccrate.ai

The source for [maccrate.ai](https://maccrate.ai), my personal website and a growing collection of projects, experiments, and field reports.

Built by **Max MacCrate**.

## Update Build Telemetry

Run:

```bash
npm run telemetry:update
```

This reads the authoritative local Hermes SQLite history from `~/.hermes/state.db` (or `HERMES_STATE_DB`) through a read-only URI, regenerates the privacy-safe `apps/web/src/data/build-telemetry.json` snapshot, and validates it before an atomic write. Legacy JSON is not used by the current generator. Nothing is pushed or deployed automatically; review the diff before committing.

## Projects

### maccrate.ai

The main portfolio and publishing site. It brings together project pages, interactive builds, technical write-ups, and supporting material from across this repository.

[Visit maccrate.ai](https://maccrate.ai) · [Browse the source](./apps/web)

### Hello, Fine-Tuning

A reproducible experiment exploring the smallest useful “Hello World” for local AI fine-tuning. The project includes the notebook, generated datasets, evaluation results, checksums, and retained evidence behind the published field report.

[Read the field report](https://maccrate.ai/projects/hello-world-ai-fine-tuning/) · [Open the project README](./projects/hello-world-ai-fine-tuning/README.md)

### Mira Machine

An interactive mystery built around a deterministic evidence system, with optional browser-local AI powered by Gemma 4 and WebGPU.

[Play Mira Machine](https://maccrate.ai/mira/) · [Read about the project](https://maccrate.ai/projects/mira-machine/) · [Browse the source](./apps/mira)

### Model Cartridges

A browser-local AI application that keeps one Qwen3.5 2B model loaded and switches two fine-tuned LoRA adapters around it. Base Console is the no-adapter control. Weather Radio uses Open-Meteo forecast data, and Stagehand produces validated actions for one authored scene. The pinned base model and adapters are fetched from Hugging Face.

[Open Model Cartridges](https://maccrate.ai/cartridges/) · [Read the field report](https://maccrate.ai/projects/browser-lora-cartridges/) · [Download the adapters](https://huggingface.co/mmaccrate/model-cartidges) · [Browse the source](./apps/cartridges) · [Browse wllama-lora](https://github.com/mmaccrate/wllama-lora)

## Repository structure

```text
apps/
├── web/       # Main maccrate.ai website
├── mira/      # Mira Machine application and supporting services
└── cartridges/ # Browser-local Model Cartridges application

projects/
└── hello-world-ai-fine-tuning/
               # Notebook, datasets, evaluations, and experiment evidence
```

Deployable applications live under `apps/`. Research materials and supporting artifacts for published work live under `projects/`.

As the site grows, this README will remain an index. Detailed setup instructions, architecture notes, testing information, and experiment results should live alongside the relevant project.

## Development

This repository uses npm workspaces and requires Node.js 22 or newer.

```bash
npm ci
npm run build
```

Individual builds and release tests can be run from the repository root:

```bash
npm run build:web
npm run build:mira
CARTRIDGE_BASE_PATH=/cartridges/ npm run build:cartridges

npm run test:web
npm run test:mira
npm run test:cartridges
```
