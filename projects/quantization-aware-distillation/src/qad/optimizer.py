"""FP32 AdamW and exact-resume checkpoint utilities."""
from __future__ import annotations

import os
import random
from pathlib import Path

import torch

CHECKPOINT_SCHEMA = "maccrate.qad.exact_resume.v1"


class ChunkedFP32AdamW:
    """AdamW with FP32 state, bounded temporaries, and explicit BF16 copy-back."""

    def __init__(
        self,
        parameters,
        lr: float,
        betas: tuple[float, float] = (0.9, 0.999),
        eps: float = 1e-8,
        weight_decay: float = 0.01,
        chunk: int = 1 << 20,
    ) -> None:
        self.parameters = [parameter for parameter in parameters if parameter.requires_grad]
        if (
            lr < 0
            or eps < 0
            or weight_decay < 0
            or chunk <= 0
            or not all(0 <= beta < 1 for beta in betas)
        ):
            raise ValueError("invalid AdamW hyperparameters")
        if any(
            not parameter.is_contiguous() or not parameter.is_floating_point()
            for parameter in self.parameters
        ):
            raise ValueError("only contiguous floating-point parameters are supported")

        self.lr = lr
        self.beta1, self.beta2 = betas
        self.eps = eps
        self.weight_decay = weight_decay
        self.chunk = chunk
        self.step_count = 0
        self.parameter_steps = [0] * len(self.parameters)
        self.masters = [parameter.detach().float().clone() for parameter in self.parameters]
        self.exp_avg = [torch.zeros_like(master) for master in self.masters]
        self.exp_avg_sq = [torch.zeros_like(master) for master in self.masters]

    def zero_grad(self, set_to_none: bool = True) -> None:
        for parameter in self.parameters:
            if set_to_none:
                parameter.grad = None
            elif parameter.grad is not None:
                parameter.grad.zero_()

    @torch.no_grad()
    def step(self) -> None:
        if any(
            parameter.grad is not None and parameter.grad.is_sparse
            for parameter in self.parameters
        ):
            raise ValueError("sparse gradients are unsupported")
        self.step_count += 1
        beta1, beta2 = self.beta1, self.beta2

        for index, (parameter, master, average, square_average) in enumerate(
            zip(self.parameters, self.masters, self.exp_avg, self.exp_avg_sq)
        ):
            if parameter.grad is None:
                continue
            self.parameter_steps[index] += 1
            step = self.parameter_steps[index]
            bias1 = 1 - beta1**step
            bias2 = (1 - beta2**step) ** 0.5
            gradient = parameter.grad.detach().reshape(-1)
            master_flat = master.view(-1)
            average_flat = average.view(-1)
            square_flat = square_average.view(-1)
            parameter_flat = parameter.view(-1)

            for start in range(0, gradient.numel(), self.chunk):
                end = min(start + self.chunk, gradient.numel())
                gradient_chunk = gradient[start:end].float()
                average_chunk = average_flat[start:end]
                square_chunk = square_flat[start:end]
                average_chunk.lerp_(gradient_chunk, 1 - beta1)
                square_chunk.mul_(beta2).addcmul_(
                    gradient_chunk,
                    gradient_chunk,
                    value=1 - beta2,
                )
                denominator = square_chunk.sqrt().div_(bias2).add_(self.eps)
                master_flat[start:end].mul_(1 - self.lr * self.weight_decay).addcdiv_(
                    average_chunk,
                    denominator,
                    value=-self.lr / bias1,
                )
                # The student must receive the updated FP32 master value. Without
                # this copy, the optimizer changes while the model remains frozen.
                parameter_flat[start:end].copy_(master_flat[start:end])

    def hyperparameters(self) -> dict:
        return {
            "lr": self.lr,
            "betas": (self.beta1, self.beta2),
            "eps": self.eps,
            "weight_decay": self.weight_decay,
            "chunk": self.chunk,
        }

    def state_dict(self) -> dict:
        return {
            "version": 1,
            "hyperparameters": self.hyperparameters(),
            "step_count": self.step_count,
            "parameter_steps": list(self.parameter_steps),
            "masters": self.masters,
            "exp_avg": self.exp_avg,
            "exp_avg_sq": self.exp_avg_sq,
        }

    def validate_state(self, state: dict) -> None:
        if state.get("version") != 1 or state.get("hyperparameters") != self.hyperparameters():
            raise ValueError("optimizer version or hyperparameters do not match")
        if len(state["parameter_steps"]) != len(self.parameters) or any(
            step < 0 or step > state["step_count"] for step in state["parameter_steps"]
        ):
            raise ValueError("invalid per-parameter optimizer steps")
        for key in ("masters", "exp_avg", "exp_avg_sq"):
            if len(state[key]) != len(self.parameters):
                raise ValueError("optimizer tensor count mismatch")
            for parameter, source in zip(self.parameters, state[key]):
                if source.shape != parameter.shape or source.dtype != torch.float32:
                    raise ValueError("optimizer tensor shape or dtype mismatch")

    @torch.no_grad()
    def load_state_dict(self, state: dict) -> None:
        self.validate_state(state)
        self.step_count = int(state["step_count"])
        self.parameter_steps = list(state["parameter_steps"])
        for key in ("masters", "exp_avg", "exp_avg_sq"):
            for destination, source in zip(getattr(self, key), state[key]):
                destination.copy_(source)
        for parameter, master in zip(self.parameters, self.masters):
            parameter.copy_(master)


def capture_rng() -> dict:
    import numpy as np

    numpy_state = np.random.get_state()
    return {
        "python": random.getstate(),
        "numpy": (
            numpy_state[0],
            numpy_state[1].tolist(),
            numpy_state[2],
            numpy_state[3],
            numpy_state[4],
        ),
        "torch_cpu": torch.get_rng_state(),
        "torch_cuda": torch.cuda.get_rng_state_all() if torch.cuda.is_initialized() else [],
    }


def restore_rng(state: dict) -> None:
    import numpy as np

    random.setstate(state["python"])
    numpy_state: tuple = state["numpy"]
    np.random.set_state(
        (
            numpy_state[0],
            np.array(numpy_state[1], dtype=np.uint32),
            numpy_state[2],
            numpy_state[3],
            numpy_state[4],
        )
    )
    torch.set_rng_state(state["torch_cpu"].cpu())
    if state["torch_cuda"]:
        if not torch.cuda.is_initialized() or len(state["torch_cuda"]) != torch.cuda.device_count():
            raise ValueError("CUDA RNG topology mismatch")
        torch.cuda.set_rng_state_all([value.cpu() for value in state["torch_cuda"]])


def validate_checkpoint(state: dict, protocol: dict) -> None:
    required = {
        "schema",
        "model",
        "optimizer",
        "rng",
        "schedule",
        "cursor",
        "metrics",
        "parameter_names",
        "protocol",
    }
    if not required.issubset(state) or state.get("schema") != CHECKPOINT_SCHEMA:
        raise ValueError("checkpoint is incomplete or incompatible")
    if state["protocol"] != protocol:
        raise ValueError("checkpoint protocol mismatch")
    cursor = state["cursor"]
    if cursor["next_row"] != cursor["step"] or len(state["metrics"]) != cursor["step"]:
        raise ValueError("checkpoint cursor and metrics do not match")
    if state["optimizer"]["step_count"] != cursor["step"]:
        raise ValueError("optimizer and cursor do not match")
    expected_schedule = {
        "kind": "constant",
        "completed_steps": cursor["step"],
        "lr": state["optimizer"]["hyperparameters"]["lr"],
    }
    if state["schedule"] != expected_schedule:
        raise ValueError("checkpoint schedule mismatch")


def save_checkpoint(
    path: Path,
    model,
    optimizer: ChunkedFP32AdamW,
    *,
    step: int,
    metrics: list[dict],
    protocol: dict,
    rendered_tokens: int,
    supervised_tokens: int,
) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    state = {
        "schema": CHECKPOINT_SCHEMA,
        "model": model.state_dict(),
        "optimizer": optimizer.state_dict(),
        "rng": capture_rng(),
        "schedule": {"kind": "constant", "completed_steps": step, "lr": optimizer.lr},
        "cursor": {
            "step": step,
            "next_row": step,
            "rendered_tokens": rendered_tokens,
            "supervised_tokens": supervised_tokens,
        },
        "metrics": metrics,
        "parameter_names": [name for name, parameter in model.named_parameters() if parameter.requires_grad],
        "protocol": protocol,
    }
    validate_checkpoint(state, protocol)
    temporary = path.with_name(path.name + ".tmp")
    with temporary.open("xb") as handle:
        torch.save(state, handle)
        handle.flush()
        os.fsync(handle.fileno())
    os.link(temporary, path)
    temporary.unlink()
    directory = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def restore_checkpoint(state: dict, model, optimizer: ChunkedFP32AdamW, protocol: dict):
    validate_checkpoint(state, protocol)
    names = [name for name, parameter in model.named_parameters() if parameter.requires_grad]
    if state["parameter_names"] != names:
        raise ValueError("trainable parameter order mismatch")
    optimizer.validate_state(state["optimizer"])
    expected = model.state_dict()
    if expected.keys() != state["model"].keys():
        raise ValueError("model keys mismatch")
    for name, destination in expected.items():
        source = state["model"][name]
        if destination.shape != source.shape or destination.dtype != source.dtype:
            raise ValueError(f"model tensor mismatch: {name}")
    for name, master in zip(names, state["optimizer"]["masters"]):
        parameter = state["model"][name]
        if not torch.equal(parameter.cpu(), master.to(device="cpu", dtype=parameter.dtype)):
            raise ValueError(f"saved model and FP32 master disagree: {name}")
    model.load_state_dict(state["model"], strict=True)
    optimizer.load_state_dict(state["optimizer"])
    restore_rng(state["rng"])
    return state["cursor"], state["metrics"]
