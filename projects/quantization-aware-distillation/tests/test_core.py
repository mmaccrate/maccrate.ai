from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from qad.optimizer import ChunkedFP32AdamW
from qad.quantization.q4_0 import fake_quantize_q4_0, q4_0_dequantize


def test_q4_0_torch_matches_numpy() -> None:
    values = np.linspace(-2.0, 2.0, 64, dtype=np.float32).reshape(2, 32)
    expected = q4_0_dequantize(values)
    actual = fake_quantize_q4_0(torch.from_numpy(values)).numpy()
    np.testing.assert_array_equal(actual, expected)


def test_fp32_master_is_copied_back_to_student() -> None:
    parameter = torch.nn.Parameter(torch.tensor([1.0], dtype=torch.bfloat16))
    optimizer = ChunkedFP32AdamW([parameter], lr=0.01, weight_decay=0.0, chunk=1)
    parameter.grad = torch.ones_like(parameter)
    optimizer.step()
    assert parameter.item() != 1.0
    assert torch.equal(parameter, optimizer.masters[0].to(parameter.dtype))
