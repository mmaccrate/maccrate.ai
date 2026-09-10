"""Gemma GGUF quantization policy used during training."""
from __future__ import annotations

from .q4_0 import Q4_0Scheme
from .q6_k import Q6_KScheme, fake_quantize_q6_k_rows


class GemmaMixedGGUFPolicy:
    """Q4_0 linear weights, Q6_K token embeddings, and GGUF exclusions."""

    name = "Gemma GGUF mixed Q4_0/Q6_K"

    def __init__(self) -> None:
        self.q4 = Q4_0Scheme()
        self.q6 = Q6_KScheme()

    def scheme_for(self, tensor_info):
        return self.q6 if self.q6.should_quantize(tensor_info) else self.q4

    def should_quantize(self, tensor_info) -> bool:
        return self.scheme_for(tensor_info).should_quantize(tensor_info)

    def fake_quantize_tensor(self, tensor, tensor_info):
        return self.scheme_for(tensor_info).fake_quantize_tensor(tensor, tensor_info)

    def fake_quantize_embedding_rows(self, weight, input_ids, tensor_info):
        if self.q6.should_quantize(tensor_info):
            return fake_quantize_q6_k_rows(weight, input_ids)
        return None

    def metadata(self) -> dict:
        return {
            "policy": self.name,
            "q4": self.q4.metadata(),
            "q6": self.q6.metadata(),
        }
