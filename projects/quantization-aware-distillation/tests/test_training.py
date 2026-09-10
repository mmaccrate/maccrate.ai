from __future__ import annotations

import random
import sys
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from qad.distillation.losses import TokenKLDistillation
from qad.optimizer import ChunkedFP32AdamW, restore_checkpoint, save_checkpoint


def test_chunked_kl_matches_direct_kl() -> None:
    torch.manual_seed(3)
    teacher = torch.randn(2, 4, 13)
    student = torch.randn(2, 4, 13, requires_grad=True)
    labels = torch.tensor([[-100, 1, 2, 3], [-100, -100, 4, 5]])
    direct = TokenKLDistillation(vocab_chunk=32).loss(teacher, student, labels)
    chunked = TokenKLDistillation(vocab_chunk=4).loss(teacher, student, labels)
    torch.testing.assert_close(chunked, direct, atol=1e-6, rtol=1e-6)


def test_checkpoint_restores_model_optimizer_and_rng(tmp_path: Path) -> None:
    random.seed(11)
    np.random.seed(11)
    torch.manual_seed(11)
    model = torch.nn.Linear(4, 2, bias=False).to(torch.bfloat16)
    optimizer = ChunkedFP32AdamW(model.parameters(), lr=0.01, chunk=4)
    inputs = torch.ones(1, 4, dtype=torch.bfloat16)
    model(inputs).sum().backward()
    optimizer.step()
    protocol = {"name": "unit-test"}
    metrics = [{"step": 1}]
    path = tmp_path / "checkpoint.pt"
    save_checkpoint(
        path,
        model,
        optimizer,
        step=1,
        metrics=metrics,
        protocol=protocol,
        rendered_tokens=8,
        supervised_tokens=3,
    )

    saved_weights = {name: value.detach().clone() for name, value in model.state_dict().items()}
    saved_masters = [value.detach().clone() for value in optimizer.masters]
    with torch.no_grad():
        model.weight.zero_()
    state = torch.load(path, map_location="cpu", weights_only=True)
    cursor, restored_metrics = restore_checkpoint(state, model, optimizer, protocol)

    assert cursor["next_row"] == 1
    assert restored_metrics == metrics
    for name, value in model.state_dict().items():
        assert torch.equal(value, saved_weights[name])
    for value, expected in zip(optimizer.masters, saved_masters):
        assert torch.equal(value, expected)
