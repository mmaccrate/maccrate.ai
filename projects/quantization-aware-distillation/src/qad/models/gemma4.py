"""Gemma 4 adapter; trainer remains architecture agnostic."""
from __future__ import annotations

from typing import Mapping
from contextlib import contextmanager

from .base import ModelAdapter


class Gemma4Adapter(ModelAdapter):
    """Adapter for Hugging Face Gemma 4 causal-LM modules.

    Quantization is applied functionally to Linear weights for one forward, so
    tied parameters remain tied and the master's state dict is untouched.
    """
    name = "gemma-4-E2B-it"

    @classmethod
    def from_pretrained(cls, model_id="google/gemma-4-E2B-it", **kwargs):
        from transformers import AutoModelForCausalLM
        return cls(AutoModelForCausalLM.from_pretrained(model_id, **kwargs))

    def forward(self, inputs):
        return self.model(**inputs) if isinstance(inputs, Mapping) else self.model(inputs)

    def forward_quantized(self, inputs, quantizer):
        # Training with activation checkpointing must keep quantized_weights open
        # through backward; this convenience method is for a single forward.
        if self.model.training and getattr(self.model, 'is_gradient_checkpointing', False):
            raise RuntimeError('use quantized_weights context through backward with activation checkpointing')
        with self.quantized_weights(quantizer):
            return self.forward(inputs)

    @contextmanager
    def quantized_weights(self, quantizer):
        """Temporary functional quantization, including backward recomputation.

        Caller holds this context across forward AND backward. Quantize inside
        each module invocation, not at installation time (reentrant checkpoints
        run their original forward under no_grad). Do not step inside context.
        """
        import torch
        import torch.nn.functional as functional
        hooks = []
        for name, module in self.model.named_modules():
            if isinstance(module, torch.nn.Linear):
                info = {"name": f"{name}.weight", "shape": tuple(module.weight.shape)}
                if not quantizer.should_quantize(info):
                    continue
                original = module.forward
                def forward(x, bias=module.bias, weight=module.weight, info=info):
                    quantized = quantizer.fake_quantize_tensor(weight, info)
                    return functional.linear(x, quantized, bias)
                module.forward = forward
                hooks.append((module, original))
            elif isinstance(module, torch.nn.Embedding):
                info = {"name": f"{name}.weight", "shape": tuple(module.weight.shape)}
                if not quantizer.should_quantize(info):
                    continue
                original = module.forward
                def forward(input_ids, weight=module.weight, info=info, quantizer=quantizer,
                            padding_idx=module.padding_idx, max_norm=module.max_norm,
                            norm_type=module.norm_type, scale_grad_by_freq=module.scale_grad_by_freq,
                            sparse=module.sparse, embedding_scale=getattr(module, 'embed_scale', None)):
                    row_result = getattr(quantizer, "fake_quantize_embedding_rows", lambda *_: None)(weight, input_ids, info)
                    if row_result is None:
                        result=functional.embedding(input_ids, weight, padding_idx, max_norm, norm_type, scale_grad_by_freq, sparse)
                    else:
                        rows, quantized_rows = row_result
                        positions = torch.searchsorted(rows, input_ids.reshape(-1)).reshape(input_ids.shape)
                        # The quantizer already supplies identity STE. Preserve
                        # its exact forward rather than subtract/add roundoff.
                        local_padding=None
                        if padding_idx is not None:
                            padding_matches=(rows==padding_idx).nonzero().reshape(-1)
                            if padding_matches.numel():local_padding=int(padding_matches[0])
                        result=functional.embedding(positions, quantized_rows, local_padding, max_norm, norm_type, scale_grad_by_freq, sparse)
                    # Gemma4TextScaledWordEmbedding is not a plain Embedding.
                    # Preserve its actual forward scaling and BF16 cast order.
                    return result if embedding_scale is None else result*embedding_scale.to(weight.dtype)
                module.forward = forward
                hooks.append((module, original))
        try:
            yield
        finally:
            for module, original in hooks:
                module.forward = original
