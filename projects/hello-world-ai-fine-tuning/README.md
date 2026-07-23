# Hello, Fine-Tuning

Supporting code and evidence for the MacCrate.ai field report **“I Went Looking for the ‘Hello World’ of AI Fine-Tuning.”**

This project asks a narrow question: can a home AMD PC teach Gemma 4 one measurable behavior, apply it to examples the model has not seen, and reproduce the result after reloading the adapter?

## Result

The final lexical-trigger experiment taught `unsloth/gemma-4-E2B-it` a small rule:

- A standalone `zorb` maps to `COPPER`.
- Otherwise the answer is `SILVER`.

| Evaluation | Exact result |
|---|---:|
| Base model, locked test | 32/64 (50.0%) |
| Fine-tuned model, training set | 61/64 (95.3%) |
| Fine-tuned model, development set | 31/32 (96.9%) |
| Fine-tuned model, locked test | 57/64 (89.1%) |
| Fine-tuned model, challenge wording | 22/32 (68.8%) |
| Locked test after adapter reload | 57/64 (89.1%) |

All 64 predictions were identical before and after adapter reload. The challenge-set result shows that the learned behavior remained brittle outside the main wording distribution.

## Repository contents

```text
projects/hello-world-ai-fine-tuning/
├── README.md
├── maccrate_finetuning_story.ipynb   # executable evidence notebook
├── generate_protocol.py              # deterministic dataset generator
├── protocol_manifest.json            # frozen protocol and original checksums
├── candidate_selection.json          # label-pair selection evidence
├── canary_train.jsonl                 # 8-row canary dataset
├── main_train.jsonl                   # 64-row training dataset
├── dev.jsonl                          # 32-row development set
├── locked_test.jsonl                  # 64-row locked test
├── challenge.jsonl                    # 32-row robustness set
├── canary_gate_report.json
├── canary_completion_nothinking_gate_report.json
├── canary_checkpoint_summary.json
├── main_evaluation_report.json
├── FINAL_REPORT.md
├── checksums.sha256
└── evidence/
    ├── codebook/                      # first experiment summary and metrics
    └── support-router/                # second experiment summary and metrics
```

## Run the notebook

From this directory:

```bash
jupyter lab maccrate_finetuning_story.ipynb
```

The notebook reads only the retained local evidence. It does not start training, call Unsloth Studio, or require credentials. Its core checks use the Python standard library; pandas and matplotlib improve the presentation when available.

To verify the retained files:

```bash
sha256sum -c checksums.sha256
```

## Recreate the datasets

```bash
python3 generate_protocol.py
```

The generator is deterministic and uses the frozen seed and protocol stored in `protocol_manifest.json`.

## Hardware and software

- AMD Ryzen AI Max / Strix Halo
- 96 GB unified memory
- Unsloth Studio with AMD/ROCm support
- Hermes Agent through Unsloth Studio MCP
- `unsloth/gemma-4-E2B-it`
- BF16 LoRA with completion-only loss for the final experiment

## Interpretation

This is a pipeline proof, not a claim that the learned rule is a useful model capability. It demonstrates that the local workflow can ingest native Gemma chat data, train an adapter, change held-out behavior, restore the base behavior when the adapter is absent, and reproduce predictions after adapter reload.

The exact reports are retained so readers can distinguish training completion, behavior change, persistence, quality, and robustness.
