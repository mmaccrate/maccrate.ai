# Gemma 4 Fine-Tuning Field Report

## Outcome

The project produced a credible **mechanical Hello World for local fine-tuning**: data ingestion, optimization, adapter activation, causal off/on/off behavior, and unload/reload persistence all worked. The final task-quality result was a near-miss rather than a clean pass: **57/64 (89.1%)** on the locked test, one answer short of the user-revised 90% target.

No additional training was started after this result.

## System

- Hardware: AMD Ryzen AI Max / Strix Halo system with 96 GB unified memory
- Orchestration: Hermes Agent
- Training service: Unsloth Studio
- Model: `unsloth/gemma-4-E2B-it`
- Final method: BF16 LoRA, native conversational JSONL, completion-only loss

## The journey

### 1. ZORB-9 random codebook

The first experiment attempted arbitrary six-digit retrieval. Training completed twice, but corrected held-out evaluation remained **0/50 exact**. CSV had also coerced leading-zero targets before the JSONL rescue. The key lesson was that low teacher-forced loss does not prove exact generation.

### 2. Support router

A three-class natural-language router improved from **33.3% to 54.0%** with the adapter and reproduced predictions exactly after reload. It proved adapter persistence, but SUMMIT remained at 0%, so the task gate failed.

### 3. Eight-row lexical canary

A counterfactual rule was introduced:

- standalone `zorb` → `COPPER`
- absent → `SILVER`

The full-sequence objective showed no behavioral change. Native-chat completion-only training produced a causal **4/8 off → 7/8 on → 4/8 off** result. Both labels were learned, but the frozen 8/8 gate failed.

### 4. Sixty-four-row matched-pair main run

The user authorized continuation with a practical 90% success target. The same native-chat completion-only method was trained on 32 balanced counterfactual pairs.

| Evaluation | Exact | Accuracy |
|---|---:|---:|
| Training | 61/64 | 95.3% |
| Adapter off, locked test | 32/64 | 50.0% |
| Development | 31/32 | 96.9% |
| Locked test | 57/64 | 89.1% |
| Challenge wording | 22/32 | 68.8% |
| Locked test after reload | 57/64 | 89.1% |

Valid-label rate was 100% throughout. Adapter-off predictions reproduced exactly, and post-reload adapter predictions reproduced exactly.

## What was actually proved

1. Native Gemma 4 conversations were ingested correctly.
2. Finite, nonzero gradients updated a real LoRA adapter.
3. Turning the adapter on changed deterministic behavior substantially.
4. Turning it off restored baseline behavior.
5. Unloading and reloading preserved every locked-test prediction.
6. The learned lexical rule generalized well in-distribution but remained brittle under challenge phrasing.

## The important failure mode

Studio's generic Alpaca path serialized `### Instruction` / `### Response`, while native Gemma 4 uses `<|turn>user` / `<|turn>model`. A dataset-column preview did not prove token-level training/serving alignment. The repaired protocol used a native `messages` column, independently rendered the checkpoint's template, balanced label token lengths, and disabled thinking consistently during evaluation.

## What I learned

- A saved adapter is not evidence of useful learning.
- Loss curves are diagnostics, not acceptance tests.
- Exact training-row recall must precede claims about generalization.
- Adapter off/on/off is the simplest convincing causal control.
- Reload equality proves persistence, not quality.
- Frozen thresholds prevent encouraging partial results from being renamed after the fact.
- Challenge sets reveal whether a model learned the intended rule or only the training distribution.

## Portfolio artifacts

- Notebook: `maccrate_finetuning_story.ipynb`
- Machine report: `main_evaluation_report.json`
- Raw evaluations: `main_*_results.jsonl`
- MacCrate.ai article: `/projects/adapter-arcade`
- Cartridge interaction: truthful behavior-preset prototype with a documented real-LoRA WebGPU research path
- Checksums: `FINAL_CHECKSUMS.sha256`

## Final classification

- **Fine-tuning mechanics:** PASS
- **Adapter causality:** PASS
- **Persistence:** PASS
- **Original strict protocol:** FAIL
- **Revised 90% locked-test target:** NEAR MISS (89.1%, one example short)
- **Broader challenge robustness:** NOT YET (68.8%)

This is a more useful Hello World than a perfect-looking demo: it establishes exactly which parts work, which claims are causal, and where the learned capability stops.
