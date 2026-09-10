"""Gemma chat rendering with assistant-only causal labels."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ChatTemplateExample:
    prompt_text: str
    rendered_text: str
    prompt_ids: tuple[int, ...]
    input_ids: tuple[int, ...]
    labels: tuple[int, ...]
    assistant_start: int
    assistant_token_count: int


def _as_ids(value: Any) -> list[int]:
    if isinstance(value, dict) or hasattr(value, "keys"):
        value = value["input_ids"]
    if hasattr(value, "tolist"):
        value = value.tolist()
    while value and isinstance(value[0], list):
        value = value[0]
    return [int(token) for token in value]


def render_gemma_chat(tokenizer: Any, user: str, assistant: str) -> ChatTemplateExample:
    """Render the native template and mask every non-assistant target."""
    if not hasattr(tokenizer, "apply_chat_template"):
        raise TypeError("tokenizer must provide apply_chat_template")
    prompt_messages = [{"role": "user", "content": user}]
    full_messages = prompt_messages + [{"role": "assistant", "content": assistant}]
    prompt_ids = _as_ids(
        tokenizer.apply_chat_template(
            prompt_messages,
            add_generation_prompt=True,
            tokenize=True,
        )
    )
    input_ids = _as_ids(
        tokenizer.apply_chat_template(
            full_messages,
            add_generation_prompt=False,
            tokenize=True,
        )
    )
    if len(input_ids) <= len(prompt_ids) or input_ids[: len(prompt_ids)] != prompt_ids:
        raise ValueError("full chat sequence does not preserve the generation-prompt prefix")

    assistant_start = len(prompt_ids)
    labels = [-100] * len(input_ids)
    # Logits at position i predict input_ids[i + 1]. Include the assistant
    # terminator while excluding prompt, system, and user positions.
    for position in range(assistant_start - 1, len(input_ids) - 1):
        labels[position] = input_ids[position + 1]
    assistant_token_count = sum(label != -100 for label in labels)
    if assistant_token_count == 0:
        raise ValueError("assistant completion produced no supervised tokens")

    return ChatTemplateExample(
        prompt_text=str(
            tokenizer.apply_chat_template(
                prompt_messages,
                add_generation_prompt=True,
                tokenize=False,
            )
        ),
        rendered_text=str(
            tokenizer.apply_chat_template(
                full_messages,
                add_generation_prompt=False,
                tokenize=False,
            )
        ),
        prompt_ids=tuple(prompt_ids),
        input_ids=tuple(input_ids),
        labels=tuple(labels),
        assistant_start=assistant_start,
        assistant_token_count=assistant_token_count,
    )
