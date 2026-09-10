---
base_model: google/gemma-4-E2B-it
pipeline_tag: text-generation
license: apache-2.0
license_link: https://ai.google.dev/gemma/docs/gemma_4_license
language:
- en
tags:
- gguf
- q4_0
- quantization-aware-training
- knowledge-distillation
- gemma
---

# Gemma 4 E2B IT — QAD Q4_0 GGUF

A Q4_0 GGUF of [Google's Gemma 4 E2B IT](https://huggingface.co/google/gemma-4-E2B-it), trained with quantization-aware distillation (QAD).

QAD trains a quantized student against token-level distributions from a frozen full-precision teacher. This lets the student adapt to the precision loss introduced by quantization instead of applying quantization only after training is complete.

- **Model file:** `gemma-4-e2b-it-qad-q4_0.gguf`
- **Format:** GGUF, Q4_0 with Q6_K embedding/output tensors
- **Base model:** `google/gemma-4-E2B-it`
- **Runtime tested:** `llama.cpp`
- **Project article:** [QAD, Distilled](https://maccrate.ai/projects/quantization-aware-distillation/)
- **Source repository:** [mmaccrate/maccrate.ai](https://github.com/mmaccrate/maccrate.ai)

## Run with llama.cpp

Download the model:

```bash
hf download mmaccrate/gemma-4-E2B-it-QAD-GGUF \
  gemma-4-e2b-it-qad-q4_0.gguf \
  --local-dir .
```

Run a prompt:

```bash
./llama-cli \
  -m gemma-4-e2b-it-qad-q4_0.gguf \
  -p "Say hello." \
  -n 32
```

The artifact was exported and evaluated with `llama.cpp` revision `95ef7fc16054e63b427a3ef00188e055ef7586d8`. Newer revisions may work, but use the pinned revision for matched numerical comparisons.

## Training method

The frozen teacher and trainable student both began from `google/gemma-4-E2B-it` revision `3e22461f65e89153144f8adb70e3b8c2cc9845a7`.

- Frozen BF16 teacher
- All student language-model parameters trainable
- Mixed GGUF fake quantization active during the student forward and backward pass
- Q4_0 linear weights with Q6_K embedding and output weights
- Forward token-level KL divergence on assistant tokens only
- 453 optimizer steps
- 100,262 rendered tokens, including 83,004 supervised assistant tokens
- Constant learning rate of `1e-5`
- FP32 AdamW master weights and optimizer moments
- Gradient clipping at `1.0`
- Seed `20260905`

The corpus contains 453 English user/assistant pairs deterministically selected from the Apache-2.0 `OpenAssistant/oasst1` training data. Benchmark questions were not included in the training corpus. The data recipe, training implementation, export workflow, tests, and evaluation manifest are part of the [maccrate.ai source repository](https://github.com/mmaccrate/maccrate.ai).

## Evaluation

The three models were compared using the same native multiple-choice likelihood evaluator. ARC-Challenge used all 1,172 test questions available to the run. HellaSwag used a fixed 1,000-row validation sample.

| Model | ARC raw | ARC normalized | HellaSwag raw | HellaSwag normalized |
|---|---:|---:|---:|---:|
| Original F16 | 48.04% | 49.74% | 44.20% | 55.60% |
| Ordinary PTQ Q4_0 | 43.00% | 45.99% | 41.80% | 53.80% |
| **QAD Q4_0** | **46.84%** | **48.46%** | **44.40%** | **57.10%** |

QAD scored above ordinary post-training Q4_0 quantization on all four reported measures. It remained below F16 on ARC, was effectively tied with F16 on raw HellaSwag, and was higher than F16 only under the secondary normalized HellaSwag scoring rule.

“Normalized” divides each answer's log-likelihood by its character count before ranking the choices. It is a secondary scoring rule over the same questions.

## Intended use

This model is intended for:

- Local text inference with a GGUF-compatible runtime
- Quantization and distillation research
- Reproducing the reported comparison against the F16 reference and ordinary PTQ Q4_0 baseline

It is not presented as a general improvement over the full-precision base model.

## Limitations

- Results come from one training run and one seed.
- Quality evidence is limited to ARC-Challenge and a 1,000-row HellaSwag sample.
- The evaluation covers text multiple-choice likelihood, not the base model's image or audio capabilities.
- QAD did not exceed F16 on ARC.
- The model can inherit or amplify errors, biases, unsafe behavior, and hallucinations from the base model.
- Applications require task-specific safety and quality evaluation before deployment.

## License and attribution

This model is derived from [`google/gemma-4-E2B-it`](https://huggingface.co/google/gemma-4-E2B-it), released under Apache 2.0. See the upstream [Gemma 4 license](https://ai.google.dev/gemma/docs/gemma_4_license), model card, and acceptable-use guidance for applicable terms.
