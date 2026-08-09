# Model Cartridges

Model Cartridges is a browser-local AI application built around one Qwen3.5 2B model and two fine-tuned GGUF LoRA adapters.

The app has three experiences:

- **Base Console** uses the shared model without an adapter.
- **Weather Radio** uses a task-specific adapter to produce a bounded forecast request. The browser retrieves forecast data from Open-Meteo and renders the grounded result.
- **Stagehand** uses a task-specific adapter to produce actions for one authored broadcast scene. The scene controller accepts only actions in its finite contract.

The base model stays loaded while the app activates the selected adapter. The release adapters are fetched from [`mmaccrate/model-cartidges`](https://huggingface.co/mmaccrate/model-cartidges).

## Runtime

- Qwen3.5 2B Q4_K_M base model
- `llama.cpp` through the [`wllama-lora`](https://github.com/mmaccrate/wllama-lora) fork
- WebAssembly and WebGPU
- TypeScript and Vite
- Hash-pinned adapter and base-model manifests
- Separate workspace state for each cartridge

The base model runs locally in the browser. Weather Radio makes a separate request for forecast data. Stagehand is limited to its authored scene and supported actions.

The base model and adapter binaries are intentionally excluded from Git because of their size. A deployment or local review environment must provision the base model at `public/models/base/Qwen3.5-2B-Q4_K_M.gguf`; the production manifests fetch the two adapters from their immutable Hugging Face URLs. The checked-in model-card README is the source for the public adapter repository.

## Development

From the monorepo root:

```bash
npm ci
```

From this directory:

```bash
npm test
npm run dev
```

The local development server uses port `6342`.

## Production build

The app is mounted under `/cartridges/` in the MacCrate portfolio. Build with that base path so JavaScript, CSS, WebAssembly, and model URLs resolve correctly:

```bash
CARTRIDGE_BASE_PATH=/cartridges/ npm run build
```

The output is written to `dist/`.

## Adapter sources

The active release manifests live in `src/config.ts`. They point to immutable Hugging Face resolve URLs for:

- `weather-radio-qwen3.5-2b-lora-f16.gguf`
- `stagehand-qwen3.5-2b-lora-f16.gguf`

The production manifests use the Hugging Face files. Local adapter copies, when needed for artifact inspection, belong in the ignored model directory rather than in Git.

## Product boundaries

The application owns the boundaries around the model:

- Adapter files must match their manifest hash and base model.
- Weather Radio must receive normalized forecast data before it describes current conditions.
- Stagehand rejects unsupported or malformed actions without changing the scene.
- Compare Mode keeps the base result visible and does not use the comparison to mutate the live workspace.

## Links

- [Model Cartridges](https://maccrate.ai/cartridges/)
- [MacCrate.ai source](https://github.com/mmaccrate/maccrate.ai)
- [Hugging Face adapters](https://huggingface.co/mmaccrate/model-cartidges)
- [wllama-lora](https://github.com/mmaccrate/wllama-lora)
