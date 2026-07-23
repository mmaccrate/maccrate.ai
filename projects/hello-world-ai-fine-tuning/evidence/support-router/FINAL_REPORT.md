# Gemma 4 Support-Router Fine-Tuning Experiment

## Result: FAIL (partial behavioral improvement; pipeline mechanics verified)

Generated: 2026-07-22T16:58:42.361980+00:00

## Objective
Fine-tune `unsloth/gemma-4-E2B-it` to route billing to `HARBOR`, technical problems to `ORBIT`, and cancellations to `SUMMIT`.

## Dataset and controls
- 600 balanced JSONL training rows (200/class)
- 150 balanced held-out rows (50/class)
- 30 exact training diagnostics (10/class)
- No train/test text overlap; labels preserved as JSON strings
- Studio preview detected Alpaca columns `instruction`, `input`, `output` and 600 rows
- Deterministic greedy inference; tools and MCP disabled

## Training
- Job: `job_20260722_112904_5bd19aba`
- Model: `unsloth/gemma-4-E2B-it`
- QLoRA 4-bit, rank 16, alpha 32, dropout 0
- 3 epochs, 225/225 steps, LR 2e-4, effective batch 8
- Completion-only loss; packing disabled; seed 3407
- Completed without Studio error or NaN/Inf

## Results
| Control | Accuracy | HARBOR | ORBIT | SUMMIT | Valid labels |
|---|---:|---:|---:|---:|---:|
| Base baseline | 33.3% | 100% | 0% | 0% | 100.0% |
| Exact training diagnostics | 33.3% | 100% | 0% | 0% | 100.0% |
| Adapter disabled after training | 33.3% | 100% | 0% | 0% | 100.0% |
| Adapter enabled before reload | 54.0% | 100% | 62% | 0% | 100.0% |
| Adapter enabled after reload | 54.0% | 100% | 62% | 0% | 100.0% |

Prediction equality before/after reload: **100.0%**.

## Formal gates
- baseline_at_or_below_40pct: **PASS**
- training_diagnostic_at_or_above_98pct: **FAIL**
- heldout_after_reload_at_or_above_90pct: **FAIL**
- each_class_at_or_above_90pct: **FAIL**
- valid_label_rate_100pct: **PASS**
- adapter_improves_over_disabled: **PASS**
- persistence_match_100pct: **PASS**

## Interpretation
The pipeline is operational: data upload, Gemma 4 QLoRA training, adapter activation, adapter-off control, persistent save/reload, deterministic inference, and reporting all worked. The adapter produced a real +20.7% absolute gain and learned 31/50 ORBIT cases. However, it did not learn SUMMIT and failed exact training-row and held-out quality gates. This is not yet a successful task-quality demonstration.

A follow-up should be explicitly approved and should change one controlled factor at a time, beginning with deeper inspection of supervised token masks/logits and then additional optimization capacity (for example more epochs or rank) only if the mask is verified. No second run was started.

## Artifacts
Raw baseline, adapter-off, adapter-on pre/post reload, training diagnostics, upload/preview, config, progress, status, failures, checksums, and machine-readable evaluation are retained in this directory. Credentials are not stored.
