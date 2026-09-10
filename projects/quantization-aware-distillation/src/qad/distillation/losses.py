"""Token-level distillation loss."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class TokenKLDistillation:
    temperature: float = 1.0
    ce_weight: float = 0.0
    ignore_index: int = -100
    vocab_chunk: int = 8192

    def __post_init__(self) -> None:
        if self.temperature <= 0:
            raise ValueError("temperature must be positive")
        if not 0 <= self.ce_weight <= 1:
            raise ValueError("ce_weight must be in [0, 1]")
        if self.vocab_chunk < 1:
            raise ValueError("vocab_chunk must be positive")

    def loss(self, teacher_logits: Any, student_logits: Any, labels: Any = None):
        import torch
        import torch.nn.functional as F

        if teacher_logits.shape != student_logits.shape:
            raise ValueError("teacher and student logits must have the same shape")
        temperature = self.temperature
        teacher = teacher_logits.detach().float() / temperature
        student = student_logits.float() / temperature

        if teacher.shape[-1] <= self.vocab_chunk:
            token_kl = F.kl_div(
                student.log_softmax(dim=-1),
                teacher.softmax(dim=-1),
                reduction="none",
            ).sum(dim=-1)
        else:
            teacher_lse = torch.logsumexp(teacher, dim=-1, keepdim=True)
            student_lse = torch.logsumexp(student, dim=-1, keepdim=True)
            token_kl = torch.zeros(
                teacher.shape[:-1],
                device=student_logits.device,
                dtype=torch.float32,
            )
            for start in range(0, teacher.shape[-1], self.vocab_chunk):
                end = min(start + self.vocab_chunk, teacher.shape[-1])
                teacher_logp = teacher[..., start:end] - teacher_lse
                student_logp = student[..., start:end] - student_lse
                teacher_probability = teacher_logp.exp()
                token_kl.add_((teacher_probability * (teacher_logp - student_logp)).sum(dim=-1))
        token_kl = token_kl * (temperature * temperature)

        mask = self._mask(token_kl, labels)
        kl = token_kl.masked_select(mask).mean() if mask.any() else student_logits.sum() * 0.0
        if self.ce_weight == 0 or labels is None or not (labels != self.ignore_index).any():
            return kl
        cross_entropy = F.cross_entropy(
            student_logits.reshape(-1, student_logits.shape[-1]),
            labels.reshape(-1),
            ignore_index=self.ignore_index,
        )
        return (1 - self.ce_weight) * kl + self.ce_weight * cross_entropy

    def _mask(self, values, labels):
        import torch

        if labels is None:
            return torch.ones_like(values, dtype=torch.bool)
        if labels.shape != values.shape:
            raise ValueError("labels must match logits' batch and sequence dimensions")
        return labels != self.ignore_index
