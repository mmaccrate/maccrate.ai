"""Stable model adapter boundaries."""
from __future__ import annotations
from typing import Any, Mapping, Protocol

class Model(Protocol):
    name: str
    def forward(self, inputs: Any) -> Any: ...
    def parameters(self): ...
    def state_dict(self): ...

class ModelAdapter:
    name = "model"
    def __init__(self, model): self.model = model
    def forward(self, inputs): return self.model(**inputs) if isinstance(inputs, Mapping) else self.model(inputs)
    def forward_quantized(self, inputs, quantizer):
        method = getattr(self.model, "forward_quantized", None)
        if method is None:
            raise NotImplementedError("model adapter must implement forward_quantized for QAD")
        return method(inputs, quantizer)
    def __call__(self, *args, **kwargs): return self.model(*args, **kwargs)
    def __getattr__(self, name): return getattr(self.model, name)
