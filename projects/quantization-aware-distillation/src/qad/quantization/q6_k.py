"""Torch fake quantization for the GGUF Q6_K embedding policy.

This implements the deployment block layout's 16-value group structure with
straight-through gradients. Exact llama.cpp parity is separately tested against
the pinned C reference; this module must not be treated as parity evidence until
that test passes.
"""
from __future__ import annotations
from typing import Any

QK_K = 256
GROUP = 16


def fake_quantize_q6_k(tensor: Any) -> Any:
    import torch
    if tensor.ndim == 0 or tensor.shape[-1] % QK_K:
        raise ValueError("Q6_K requires the last dimension to be divisible by 256")
    shape = tensor.shape
    # Match make_qx_quants(..., rmse_type=1) and quantize_row_q6_K_ref.
    # Detached arithmetic: the autograd contract is identity STE, not a
    # derivative through scale selection. Sequential FP32 sums match C order.
    with torch.no_grad():
        x = tensor.detach().float().reshape(-1, 16, 16)
        if not torch.isfinite(x).all():
            raise ValueError("Q6_K requires finite weights")
        peak = x.gather(-1, x.abs().argmax(-1, keepdim=True)).squeeze(-1)
        active = peak.abs() >= 1e-15
        safe_peak = torch.where(active, peak, torch.ones_like(peak))
        w = x * x
        def fit(inv):
            levels = torch.round(inv.unsqueeze(-1) * x).clamp(-32, 31)
            sx = torch.zeros_like(peak); s2 = torch.zeros_like(peak)
            for i in range(16):
                sx = sx + (w[..., i] * x[..., i]) * levels[..., i]
                s2 = s2 + (w[..., i] * levels[..., i]) * levels[..., i]
            return sx, s2
        sx, s2 = fit(-32.0 / safe_peak)
        scale = torch.where(s2 > 0, sx / s2, torch.zeros_like(sx))
        best = scale * sx
        for trial in range(-9, 10):
            if trial == 0:
                continue
            # C evaluates 32 + 0.1f * trial in float32.
            numerator = torch.tensor(32., device=x.device) + torch.tensor(.1, device=x.device) * trial
            sx, s2 = fit(-numerator / safe_peak)
            improve = (s2 > 0) & (sx * sx > best * s2)
            candidate = sx / s2
            scale = torch.where(improve, candidate, scale)
            best = torch.where(improve, candidate * sx, best)
        scale = torch.where(active, scale, torch.zeros_like(scale))
        maximum = scale.gather(-1, scale.abs().argmax(-1, keepdim=True))
        block_active = maximum.abs() >= 1e-15
        inv = -128.0 / torch.where(block_active, maximum, torch.ones_like(maximum))
        d = (1.0 / inv).half().float()
        d = torch.where(block_active, d, torch.zeros_like(d))
        subscale = torch.round(inv * scale).clamp(max=127)
        effective = d * subscale
        safe_d = torch.where(effective != 0, effective, torch.ones_like(effective))
        levels = torch.round(x / safe_d.unsqueeze(-1)).clamp(-32, 31)
        quantized = (effective.unsqueeze(-1) * levels).reshape(shape).to(tensor.dtype)
    # Unlike x + (q-x).detach(), this preserves q exactly in forward even
    # when subtraction/addition would introduce cancellation roundoff.
    return quantized + (tensor - tensor.detach())


def fake_quantize_q6_k_rows(weight: Any, input_ids: Any) -> Any:
    import torch
    rows = torch.unique(input_ids.reshape(-1))
    selected = weight.index_select(0, rows)
    quantized = fake_quantize_q6_k(selected)
    return rows, quantized

class Q6_KScheme:
    name = "GGUF Q6_K"

    def should_quantize(self, tensor_info):
        name = str(tensor_info.get("name", ""))
        shape = tuple(tensor_info.get("shape", ()))
        # Pinned default Q4_0 export promotes output weights to Q6_K too.
        # Gemma's absent output.weight reuses token_embd.weight natively;
        # its HF lm_head Linear must therefore use the same Q6 forward.
        is_output = name in ("lm_head.weight", "output.weight") or name.endswith(".lm_head.weight")
        return ("token_embd" in name or "embed_tokens" in name or is_output) and len(shape) >= 2 and shape[-1] % QK_K == 0

    def fake_quantize_tensor(self, tensor, tensor_info):
        return fake_quantize_q6_k(tensor) if self.should_quantize(tensor_info) else tensor

    def metadata(self):
        return {"scheme": self.name, "block_elements": QK_K, "group_elements": GROUP,
                "status": "CPU synthetic and fixed real-row/export parity verified; full-device execution and performance unverified",
                "reference_commit": "95ef7fc16054e63b427a3ef00188e055ef7586d8"}
