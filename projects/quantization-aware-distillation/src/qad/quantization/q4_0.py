"""llama.cpp-compatible Q4_0 fake quantization and parity helpers."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping
import numpy as np

QK4_0 = 32


def _numpy_q4_0(tensor: Any) -> np.ndarray:
    values = np.asarray(tensor, dtype=np.float32)
    if values.ndim == 0 or values.shape[-1] % QK4_0:
        raise ValueError("Q4_0 requires a tensor whose last dimension is divisible by 32")
    flat = values.reshape(-1, values.shape[-1])
    blocks = flat.reshape(-1, QK4_0)
    # llama.cpp selects the first signed value attaining the absolute maximum.
    indices = np.argmax(np.abs(blocks), axis=1)
    maximum = blocks[np.arange(len(blocks)), indices]
    d = (maximum / -8.0).astype(np.float32)
    half_d = d.astype(np.float16)
    d32 = half_d.astype(np.float32)
    inv = np.divide(1.0, d32, out=np.zeros_like(d32), where=d32 != 0)
    scaled = blocks * inv[:, None]
    q = np.trunc(scaled + np.float32(8.5)).clip(0, 15).astype(np.int32)
    # Dequantization intentionally uses the binary16-rounded scale.
    result = (q - 8).astype(np.float32) * d32[:, None]
    return result.reshape(values.shape)


def q4_0_dequantize(tensor: Any) -> np.ndarray:
    """Return the exact Q4_0 forward value for a NumPy-like tensor."""
    return _numpy_q4_0(tensor)


def _torch_q4_0(tensor: Any) -> Any:
    import torch
    if tensor.ndim == 0 or tensor.shape[-1] % QK4_0:
        raise ValueError("Q4_0 requires a tensor whose last dimension is divisible by 32")
    shape = tensor.shape
    blocks = tensor.reshape(-1, shape[-1]).reshape(-1, QK4_0)
    indices = torch.argmax(torch.abs(blocks), dim=1)
    maximum = blocks[torch.arange(blocks.shape[0], device=blocks.device), indices]
    d = maximum / -8.0
    d16 = d.to(torch.float16)
    d32 = d16.to(torch.float32)
    inv = torch.where(d32 != 0, 1.0 / d32, torch.zeros_like(d32))
    q = torch.trunc(blocks.to(torch.float32) * inv[:, None] + 8.5).clamp(0, 15)
    return ((q - 8.0) * d32[:, None]).reshape(shape).to(tensor.dtype)


def fake_quantize_q4_0(tensor: Any) -> Any:
    """Q4_0 fake quantization with an STE when ``tensor`` is PyTorch."""
    if type(tensor).__module__.split(".", 1)[0] == "torch":
        quantized = _torch_q4_0(tensor)
        return tensor + (quantized - tensor).detach()
    return _numpy_q4_0(tensor)


def assert_parity(reference: Any, candidate: Any, tolerances: Mapping[str, float]) -> dict[str, float]:
    """Raise ``AssertionError`` if any recorded parity tolerance is exceeded."""
    metrics = parity_metrics(reference, candidate)
    failures = {key: (metrics[key], float(limit)) for key, limit in tolerances.items()
                if metrics[key] > float(limit)}
    if failures:
        raise AssertionError(f"Q4_0 parity mismatch: {failures}")
    return metrics


@dataclass(frozen=True)
class Q4_0Scheme:
    """Reusable scheme implementing the pinned llama.cpp Q4_0 contract."""
    name: str = "GGUF Q4_0"
    llama_cpp_commit: str = "95ef7fc16054e63b427a3ef00188e055ef7586d8"

    def should_quantize(self, tensor_info: Mapping[str, Any]) -> bool:
        name = str(tensor_info.get("name", ""))
        shape = tuple(tensor_info.get("shape", ()))
        return (len(shape) >= 2 and name.endswith("weight") and
                "_norm.weight" not in name and
                not any(x in name for x in ("ffn_gate_inp.weight", "per_layer_model_proj", "altup", "laurel")) and
                shape[-1] % QK4_0 == 0)

    def fake_quantize_tensor(self, tensor: Any, tensor_info: Mapping[str, Any]) -> Any:
        if not self.should_quantize(tensor_info):
            return tensor
        return fake_quantize_q4_0(tensor)

    def metadata(self) -> Mapping[str, Any]:
        return {"scheme": self.name, "block_elements": QK4_0, "block_bytes": 18,
                "llama_cpp_commit": self.llama_cpp_commit, "scale": "fp16 signed absmax / -8"}

def parity_metrics(reference: Any, candidate: Any) -> dict[str, float]:
    """Compute deterministic error metrics, including exact mismatch rate."""
    a, b = np.asarray(reference, dtype=np.float64), np.asarray(candidate, dtype=np.float64)
    if a.shape != b.shape:
        raise ValueError(f"shape mismatch: {a.shape} != {b.shape}")
    error = np.abs(a - b)
    return {"max_error": float(error.max(initial=0.0)),
            "mean_error": float(error.mean()),
            "mse": float(np.mean((a - b) ** 2)),
            "mismatch_rate": float(np.count_nonzero(a != b) / a.size)}
