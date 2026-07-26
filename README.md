# maccrate.ai

The source for [maccrate.ai](https://maccrate.ai), my personal website and a growing collection of projects, experiments, and field reports.

Built by **Max MacCrate**.

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

## Repository structure

```text
apps/
├── web/       # Main maccrate.ai website
└── mira/      # Mira Machine application and supporting services

projects/
└── hello-world-ai-fine-tuning/
               # Notebook, datasets, evaluations, and experiment evidence
```

Deployable applications live under `apps/`. Research materials and supporting artifacts for published work live under `projects/`.

As the site grows, this README will remain an index. Detailed setup instructions, architecture notes, testing information, and experiment results should live alongside the relevant project.

## Development

This repository uses npm workspaces and requires Node.js 20.

```bash
npm ci
npm run build
```

Individual builds and release tests can be run from the repository root:

```bash
npm run build:web
npm run build:mira

npm run test:web
npm run test:mira
```
