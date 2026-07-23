# FINAL REPORT — Gemma 4 E2B ZORB-9 Codebook Fine-Tuning

## Outcome

**FORMAL RESULT: FAIL (experiment complete).**

The deterministic baseline passed the required low-accuracy gate, but neither the initial LoRA nor the sole permitted diagnosed rescue achieved any exact held-out match. No additional training run is allowed, and no success is inferred from declining training loss.

## Strict final results (sole rescue adapter)

| Evaluation | Exact correct | Accuracy | Character-position accuracy | Format compliance |
|---|---:|---:|---:|---:|
| Base baseline | 0/50 | 0% | 9.00% | 100% |
| Rescue adapter before reload | 0/50 | 0% | 16.67% | 98% |
| Rescue adapter after reload | 0/50 | 0% | 16.67% | 98% |
| Rescue adapter secondary wording | 0/50 | 0% | 17.33% | 100% |

All four sets contain exactly 50 unique identifiers. Exact matching uses the complete whitespace-trimmed response; it does not extract or normalize digits.

## Formal criteria

| Criterion | Result |
|---|---|
| Baseline <=5% | **PASS** — 0/50 (0%) |
| Post-reload >=90% | **FAIL** — 0% |
| Post-reload >=45/50 | **FAIL** — 0/50 |
| Improvement >=80 percentage points | **FAIL** — 0 pp |
| Primary and secondary evaluations complete | **PASS** |
| Adapter unload/reload verified | **PASS** |
| No concurrent/duplicate training | **PASS** |
| At most one rescue | **PASS** — exactly one |

Overall: **FAIL**.

## Training and safety evidence

### Initial run
- Job: `job_20260722_081226_9646e4a0`
- Dataset: Studio-uploaded CSV
- LoRA: 8 epochs, rank 16, alpha 32, effective batch 8
- Completed: 400/400 optimizer steps
- Evaluation: 0/50 before reload, 0/50 after reload, 0/50 secondary

### Diagnosed rescue
The authenticated Studio CSV preview demonstrated that leading-zero targets could be coerced to integers (for example `065830` became `65830`). This concrete data-path defect plus the verified sub-90% initial post-reload score opened the protocol's single rescue gate.

- Job: `job_20260722_093547_2e0e3968`
- Dataset: authenticated upload of validated `codebook_train.jsonl`, preserving output strings
- LoRA: 12 epochs, rank 32, alpha 64
- Completed: 600/600 optimizer steps, epoch 12.0
- Final status loss: 0.025895914460221926
- Authenticated run history: exactly two runs total (initial + sole rescue)
- No NaN/Inf, zero loss, zero gradient norm, or duplicate remote training job was observed

Loss was treated only as a training diagnostic. The strict held-out evaluation determines the outcome.

## Reload and evaluation verification

The rescue adapter was loaded and evaluated on the primary set before reload. It was then explicitly unloaded, verified absent, reloaded from its output directory, and evaluated on the primary and secondary sets. After evaluation it was unloaded and verified absent again.

Before- and post-reload primary outputs were stable in aggregate and both scored 0/50. One malformed primary response was reproducible across reload: identifier `Z9-ADI-965`, expected `065830`, produced seven digits (`0693547`). All secondary outputs were six digits, but none matched exactly.

## Artifact map

- Final strict machine-readable report: `evaluation_report.json`
- Final tabular report: `evaluation_report.csv`
- Final failures: `failed_examples.jsonl`
- Rescue before reload: `finetuned_results_before_reload.jsonl`
- Rescue after reload: `finetuned_results_after_reload.jsonl`
- Rescue secondary: `finetuned_secondary_results.jsonl`
- Initial-run artifacts: `initial_run/`
- Training state and history: `post_training_state.json`, `training_progress.jsonl`, `rescue_training_progress.jsonl`
- Dataset validation: `dataset_format_check.json`, `codebook_manifest.json`

## Conclusion

The experiment is complete but unsuccessful under its preregistered thresholds. The rescue corrected the known CSV string-coercion risk and improved character-position accuracy modestly, but it did not produce exact codebook retrieval on either held-out wording. No further rescue or training was started. This synthetic lookup task provides no evidence of broad reasoning or general intelligence.
