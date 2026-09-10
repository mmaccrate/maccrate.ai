# Quantization-Aware Distillation

A compact reproduction of the experiment behind the MacCrate field report: **Can a 4-bit language model learn from the full-precision model it came from?**

The full run keeps a frozen BF16 Gemma 4 E2B teacher beside a trainable student. During every student forward pass, weights behave like the target GGUF layout—mostly Q4_0, with the same Q6_K exceptions used by `llama.cpp`. Gradients pass through that fake-quantized forward pass, and FP32 AdamW master weights are copied back into the BF16 student after every update.

This directory contains the reusable method, exact data recipe, training entry point, GGUF export, native evaluation, tests, and a model card. It does **not** contain checkpoints, GGUF files, private logs, or machine-specific paths.

## Start with the small CPU demo

The demo uses the same Q4_0 straight-through estimator and FP32-master update as the full run, but on one small matrix:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[test]"
python demo.py
pytest -q
```

A successful demo prints `"improved": true`. It explains the optimization mechanism; it is not a model-quality result.

## Full reproduction

### Requirements

- Linux and Python 3.11+
- A PyTorch 2.9.1 build for the accelerator in use
- Enough accelerator memory for two BF16 Gemma 4 E2B models plus FP32 optimizer state; the verified run used a 96 GB unified-memory AMD system with ROCm
- Enough disk for the base model, approximately 65 GB per exact-resume checkpoint, an intermediate Hugging Face export, and GGUF files
- Hugging Face access to [`google/gemma-4-E2B-it`](https://huggingface.co/google/gemma-4-E2B-it)
- `llama.cpp` for GGUF conversion and native evaluation

The Python versions in `pyproject.toml` match the verified environment. Install the correct PyTorch wheel for the machine first if the default package index does not provide it, then run:

```bash
pip install -e ".[test]"
```

### 1. Create the exact training data

```bash
python prepare_data.py
```

`prepare_data.py` downloads a content-pinned OpenAssistant parquet file, selects the same 453 eligible English user/assistant pairs in source order, renders them with the pinned Gemma tokenizer, and refuses output unless all three checks match:

- 453 rows
- 100,262 rendered tokens
- SHA-256 `a04949ebf94de950170b8886d39bcbdee895d83d1188f967bf5b4d83b5369c51`

The resulting `data/` directory is ignored by Git.

### 2. Train the student

```bash
python train.py --data data/train.jsonl --output output
```

The run uses the same settings as the reported experiment:

- base and teacher: `google/gemma-4-E2B-it` at revision `3e22461f65e89153144f8adb70e3b8c2cc9845a7`
- seed: `20260905`
- one row per optimizer step; 453 steps total
- 100,262 rendered tokens and 83,004 assistant tokens
- all language-model parameters trainable
- BF16 model computation
- mixed GGUF fake quantization active through forward and backward
- token KL loss on assistant tokens only
- constant learning rate `1e-5`
- gradient clipping at `1.0`
- FP32 AdamW masters and moments, with weight decay `0.01`
- non-reentrant activation checkpointing

Checkpoints include model weights, optimizer state, cursor, metrics, and random-number-generator state. Resume without resetting the optimizer:

```bash
python train.py \
  --data data/train.jsonl \
  --output output \
  --resume output/checkpoint-step-300.pt
```

Completion means training finished and weights changed. It does not establish model quality; use the native evaluation below for that.

### 3. Export the evaluated GGUF layout

`train.py` writes `output/language-model.pt`, a model-only copy that avoids loading the much larger optimizer checkpoint during export. `export.py` merges those weights into the pinned base model, creates the Hugging Face directory, converts it to F16 GGUF, quantizes that file to Q4_0, and runs a native smoke test.

Use the same `llama.cpp` revision as the experiment:

```bash
git clone https://github.com/ggml-org/llama.cpp.git vendor/llama.cpp
git -C vendor/llama.cpp checkout 95ef7fc16054e63b427a3ef00188e055ef7586d8
cmake -S vendor/llama.cpp -B vendor/llama.cpp/build -DGGML_NATIVE=OFF
cmake --build vendor/llama.cpp/build --config Release -j

python export.py \
  --weights output/language-model.pt \
  --llama-cpp vendor/llama.cpp \
  --hf-output output/hf \
  --output output/gemma-4-e2b-it-qad-q4_0.gguf
```

The intermediate F16 GGUF is removed unless `--keep-f16` is supplied.

### 4. Run the matched evaluation

The committed `evaluation_manifest.json` contains the exact rendered questions and choices: all 1,172 ARC-Challenge test questions and the fixed 1,000-row HellaSwag validation sample. `evaluate.py` compiles the small CPU likelihood scorer, enforces the pinned `llama.cpp` revision by default, rejects token-boundary errors, and reports both raw and character-normalized multiple-choice accuracy.

```bash
python evaluate.py \
  --model output/gemma-4-e2b-it-qad-q4_0.gguf \
  --name qad-q4_0 \
  --task arc \
  --llama-cpp vendor/llama.cpp \
  --output output/eval-arc

python evaluate.py \
  --model output/gemma-4-e2b-it-qad-q4_0.gguf \
  --name qad-q4_0 \
  --task hellaswag \
  --llama-cpp vendor/llama.cpp \
  --output output/eval-hellaswag
```

Use `--count 2` for a quick scorer smoke test. A full matched comparison requires running the same commands against the original F16, ordinary PTQ Q4_0, and QAD Q4_0 GGUFs.

## Verified result

| Model | ARC raw | ARC normalized | HellaSwag raw | HellaSwag normalized |
|---|---:|---:|---:|---:|
| Original F16 | 48.04% | 49.74% | 44.20% | 55.60% |
| Ordinary PTQ Q4_0 | 43.00% | 45.99% | 41.80% | 53.80% |
| QAD Q4_0 | 46.84% | 48.46% | 44.40% | 57.10% |

QAD scored above ordinary PTQ on all four reported measures. It remained below F16 on ARC, was effectively tied with F16 on raw HellaSwag, and was higher on the character-normalized HellaSwag rule in this evaluation. These results are one run on two evaluation populations, not evidence that QAD always restores quantization loss or generally beats full precision.

## Files

```text
quantization-aware-distillation/
├── README.md                 # this guide
├── model/README.md           # README prepared for the Hugging Face model repository
├── pyproject.toml            # pinned Python package versions
├── demo.py                   # fast CPU explanation of the core update
├── prepare_data.py           # exact public-data recipe
├── train.py                  # full QAD training and exact resume
├── export.py                 # HF merge, GGUF quantization, and smoke test
├── evaluate.py               # matched ARC/HellaSwag evaluation
├── native_likelihood.cpp     # minimal llama.cpp likelihood scorer
├── evaluation_manifest.json # exact public evaluation population
├── src/qad/                  # quantizers, model adapter, loss, and optimizer
└── tests/                    # focused regression tests
```

## Evidence boundaries

- The source and protocol here reproduce the validated method without retaining internal run orchestration or debugging history.
- Generated artifacts are excluded from Git by default.
- The reported GGUF loaded in the native runtime and had SHA-256 `b00e692724bc85f19e75b583e5a22b9b61db6223e3f62fccfb3ed08f79f32696`.
- Exact result reproduction requires the pinned base-model revision, tokenizer, training data checksum, software versions, `llama.cpp` revision, and evaluation manifest.
- The OpenAssistant source rows are Apache-2.0. The Gemma 4 base model is Apache-2.0 with its upstream license link and usage guidance. No license is asserted here for repository code unless the repository itself supplies one.
