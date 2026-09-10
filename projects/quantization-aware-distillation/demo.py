#!/usr/bin/env python3
"""Small CPU example of the same QAD update used by train.py."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import torch
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))

from qad.optimizer import ChunkedFP32AdamW
from qad.quantization.q4_0 import fake_quantize_q4_0


def loss_for(student: torch.Tensor, teacher: torch.Tensor, inputs: torch.Tensor) -> torch.Tensor:
    teacher_probabilities = torch.softmax(inputs @ teacher.T, dim=-1)
    student_log_probabilities = torch.log_softmax(inputs @ fake_quantize_q4_0(student).T, dim=-1)
    return F.kl_div(student_log_probabilities, teacher_probabilities, reduction="batchmean")


def main() -> None:
    torch.manual_seed(7)
    teacher = torch.randn(8, 32)
    student = torch.nn.Parameter(teacher + 0.4 * torch.randn_like(teacher))
    inputs = torch.randn(64, 32)
    optimizer = ChunkedFP32AdamW([student], lr=0.03, weight_decay=0.0, chunk=64)
    initial = float(loss_for(student, teacher, inputs).detach())
    for _ in range(80):
        optimizer.zero_grad()
        loss = loss_for(student, teacher, inputs)
        loss.backward()
        optimizer.step()
    final = float(loss_for(student, teacher, inputs).detach())
    if not final < initial:
        raise RuntimeError(f"QAD demo did not improve: {initial} -> {final}")
    print(json.dumps({"initial_kl": initial, "final_kl": final, "improved": True}))


if __name__ == "__main__":
    main()
