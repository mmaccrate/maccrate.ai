---
license: apache-2.0
base_model:
  - Qwen/Qwen3.5-2B
library_name: llama.cpp
tags:
  - lora
  - gguf
  - qwen3.5
  - browser-local-inference
  - webgpu
  - wllama
---

# Model Cartridges

Two LoRA adapters for a small Qwen3.5 2B model running locally in the browser.

The adapters were fine-tuned for two focused applications:

- **Weather Radio** turns a weather request into the structured input used by the app’s forecast flow.
- **Stagehand** turns plain language into scene actions for one authored broadcast scene.

They share one Qwen3.5 2B base model. The base stays loaded while the application switches between the smaller adapters. Base Console is the no-adapter control.

## Files

- `weather-radio-qwen3.5-2b-lora-f16.gguf`
- `stagehand-qwen3.5-2b-lora-f16.gguf`

Both files are standalone F16 GGUF LoRA adapters. They are intended for the Qwen3.5 2B base model and work with runtimes that support GGUF LoRA loading.

## Base model

The browser application uses the Q4_K_M version of [Qwen3.5 2B from Unsloth](https://huggingface.co/unsloth/Qwen3.5-2B-GGUF). The upstream model is [Qwen/Qwen3.5-2B](https://huggingface.co/Qwen/Qwen3.5-2B).

This repository contains the two adapters. It does not contain the base model.

## Runtime

The Model Cartridges application uses `llama.cpp`, `wllama-lora`, WebAssembly, and WebGPU. Model inference runs in the browser. Weather Radio can request forecast data separately, while Stagehand applies only the scene actions supported by its application contract.

- [Model Cartridges source](https://github.com/mmaccrate/maccrate.ai)
- [wllama-lora](https://github.com/mmaccrate/wllama-lora)

## Try the project

- [Open Model Cartridges](https://maccrate.ai/cartridges/)
- [Read I Made LoRA Adapters Hot-Swappable in the Browser](https://maccrate.ai/projects/browser-lora-cartridges/)
- [Visit maccrate.ai](https://maccrate.ai/)

## License

These adapters are released under the Apache-2.0 license inherited from the Qwen3.5 base model. See [LICENSE](https://huggingface.co/Qwen/Qwen3.5-2B/blob/main/LICENSE) and the upstream model card for the original terms and attribution.
