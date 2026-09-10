#!/usr/bin/env python3
"""Run the quantization-aware distillation experiment."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import sys
import time
from pathlib import Path

os.environ.setdefault("HF_DEACTIVATE_ASYNC_LOAD", "1")

import numpy as np
import torch

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))

from qad.data.pipeline import render_gemma_chat
from qad.distillation.losses import TokenKLDistillation
from qad.models.gemma4 import Gemma4Adapter
from qad.optimizer import ChunkedFP32AdamW, restore_checkpoint, save_checkpoint, validate_checkpoint
from qad.quantization.mixed import GemmaMixedGGUFPolicy

MODEL_ID = "google/gemma-4-E2B-it"
MODEL_REVISION = "3e22461f65e89153144f8adb70e3b8c2cc9845a7"
DATA_SHA256 = "a04949ebf94de950170b8886d39bcbdee895d83d1188f967bf5b4d83b5369c51"
SEED = 20260905
LEARNING_RATE = 1e-5
EXPECTED_ROWS = 453
EXPECTED_RENDERED_TOKENS = 100_262


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def emit(event: str, **values) -> None:
    print(json.dumps({"event": event, **values}), flush=True)


def protocol(model: str, revision: str | None, data_hash: str) -> dict:
    return {
        "schema": "maccrate.qad.protocol.v1",
        "model": model,
        "revision": revision,
        "data_sha256": data_hash,
        "seed": SEED,
        "training_scope": "all language model parameters",
        "compute_dtype": "bfloat16",
        "steps": EXPECTED_ROWS,
        "optimizer": {
            "name": "chunked FP32 AdamW",
            "learning_rate": LEARNING_RATE,
            "betas": [0.9, 0.999],
            "epsilon": 1e-8,
            "weight_decay": 0.01,
            "chunk_elements": 1 << 20,
        },
        "gradient_clip": 1.0,
        "activation_checkpointing": "non-reentrant",
        "quantization": "GGUF Q4_0 with Q6_K policy exceptions during forward and backward",
        "loss": "token KL on assistant tokens",
    }


def load_rows(path: Path) -> list[dict]:
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    tokens = sum(int(row["rendered_tokens"]) for row in rows)
    if len(rows) != EXPECTED_ROWS or tokens != EXPECTED_RENDERED_TOKENS:
        raise ValueError(
            f"expected {EXPECTED_ROWS} rows and {EXPECTED_RENDERED_TOKENS} rendered tokens; "
            f"got {len(rows)} rows and {tokens} tokens"
        )
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=MODEL_ID, help="Model ID or local model directory")
    parser.add_argument("--revision", default=MODEL_REVISION, help="Pinned Hugging Face revision")
    parser.add_argument("--data", type=Path, default=ROOT / "data" / "train.jsonl")
    parser.add_argument("--output", type=Path, default=ROOT / "output")
    parser.add_argument("--resume", type=Path)
    parser.add_argument("--checkpoint-every", type=int, default=100)
    args = parser.parse_args()

    if args.checkpoint_every < 1:
        raise ValueError("--checkpoint-every must be positive")
    data_hash = sha256(args.data)
    if data_hash != DATA_SHA256:
        raise ValueError(f"training-data checksum mismatch: expected {DATA_SHA256}, got {data_hash}")
    rows = load_rows(args.data)
    revision = None if Path(args.model).expanduser().exists() else args.revision
    spec = protocol(args.model, revision, data_hash)

    state = None
    if args.resume:
        state = torch.load(args.resume, map_location="cpu", mmap=True, weights_only=True)
        validate_checkpoint(state, spec)

    from transformers import AutoModelForCausalLM, AutoTokenizer

    args.output.mkdir(parents=True, exist_ok=True)
    load_kwargs = {
        "dtype": torch.bfloat16,
        "low_cpu_mem_usage": True,
        "device_map": {"": "cuda:0"},
    }
    if revision:
        load_kwargs["revision"] = revision

    emit("loading_teacher")
    teacher_model = AutoModelForCausalLM.from_pretrained(args.model, **load_kwargs)
    emit("loading_student")
    student_model = AutoModelForCausalLM.from_pretrained(args.model, **load_kwargs)
    tokenizer = AutoTokenizer.from_pretrained(args.model, revision=revision)

    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)

    teacher = Gemma4Adapter(teacher_model)
    student = Gemma4Adapter(student_model)
    teacher.model.requires_grad_(False)
    teacher.model.eval()
    student.model.requires_grad_(False)
    student.model.train()
    language_model = student.model.model.language_model
    student.model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
    student.model.config.use_cache = False
    for parameter in language_model.parameters():
        parameter.requires_grad_(True)
    if state is not None:
        language_model.load_state_dict(state["model"], strict=True)

    parameters = [parameter for parameter in language_model.parameters() if parameter.requires_grad]
    optimizer = ChunkedFP32AdamW(parameters, lr=LEARNING_RATE)
    quantizer = GemmaMixedGGUFPolicy()
    objective = TokenKLDistillation()
    metrics: list[dict] = []
    first_row = 0
    rendered_total = 0
    supervised_total = 0
    if state is not None:
        cursor, metrics = restore_checkpoint(state, language_model, optimizer, spec)
        first_row = cursor["next_row"]
        rendered_total = cursor["rendered_tokens"]
        supervised_total = cursor["supervised_tokens"]
        del state
        torch.cuda.empty_cache()
        emit("resumed", next_row=first_row)

    emit(
        "ready",
        rows=len(rows),
        trainable_parameters=sum(parameter.numel() for parameter in parameters),
        start_step=first_row,
    )
    started = time.perf_counter()
    elapsed_before_resume = metrics[-1]["wall_time_seconds"] if metrics else 0.0
    for step, row in enumerate(rows[first_row:], first_row + 1):
        rendered = render_gemma_chat(tokenizer, row["prompt"], row["answer"])
        input_ids = torch.tensor([rendered.input_ids], device="cuda:0")
        batch = {
            "input_ids": input_ids,
            "attention_mask": torch.ones_like(input_ids),
        }
        labels = torch.tensor([rendered.labels], dtype=torch.long, device="cuda:0")

        optimizer.zero_grad(set_to_none=True)
        with torch.inference_mode():
            teacher_logits = teacher.forward(batch).logits
        with student.quantized_weights(quantizer):
            student_logits = student.forward(batch).logits
            loss = objective.loss(teacher_logits, student_logits, labels)
            if not torch.isfinite(loss):
                raise FloatingPointError("non-finite loss")
            loss_value = float(loss.detach().cpu())
            loss.backward()
        del teacher_logits, student_logits, loss, batch, labels, input_ids
        torch.cuda.empty_cache()

        gradient_norm = float(
            torch.nn.utils.clip_grad_norm_(parameters, 1.0, error_if_nonfinite=True).detach().cpu()
        )
        optimizer.step()
        torch.cuda.synchronize()
        rendered_total += len(rendered.input_ids)
        supervised_total += rendered.assistant_token_count
        record = {
            "step": step,
            "id": row["id"],
            "loss": loss_value,
            "gradient_norm": gradient_norm,
            "rendered_tokens": len(rendered.input_ids),
            "supervised_tokens": rendered.assistant_token_count,
            "cumulative_rendered_tokens": rendered_total,
            "cumulative_supervised_tokens": supervised_total,
            "wall_time_seconds": elapsed_before_resume + time.perf_counter() - started,
        }
        metrics.append(record)
        print(json.dumps(record), flush=True)

        if step % args.checkpoint_every == 0 or step == len(rows):
            checkpoint = args.output / f"checkpoint-step-{step}.pt"
            save_checkpoint(
                checkpoint,
                language_model,
                optimizer,
                step=step,
                metrics=metrics,
                protocol=spec,
                rendered_tokens=rendered_total,
                supervised_tokens=supervised_total,
            )
            emit("checkpoint_saved", path=str(checkpoint), step=step)

    model_weights = args.output / "language-model.pt"
    with model_weights.open("xb") as handle:
        torch.save(language_model.state_dict(), handle)

    summary = {
        "status": "training complete; quality requires separate evaluation",
        "steps": len(rows),
        "rendered_tokens": rendered_total,
        "supervised_tokens": supervised_total,
        "checkpoint": str(args.output / f"checkpoint-step-{len(rows)}.pt"),
        "language_model_weights": str(model_weights),
        "protocol": spec,
        "quantizer": quantizer.metadata(),
        "metrics": metrics,
    }
    (args.output / "training-summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    emit("complete", checkpoint=summary["checkpoint"])


if __name__ == "__main__":
    main()
