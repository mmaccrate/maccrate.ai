#!/usr/bin/env python3
"""Create the exact public-data training corpus used for the QAD run."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import urllib.request
from pathlib import Path

import pyarrow.parquet as pq
from transformers import AutoTokenizer

MODEL_ID = "google/gemma-4-E2B-it"
SOURCE_URL = (
    "https://huggingface.co/datasets/OpenAssistant/oasst1/resolve/main/data/"
    "train-00000-of-00001-b42a775f407cee45.parquet"
)
SOURCE_SHA256 = "bbfadf5ed1278ba2208c837fdcad865adf65f5df55d80abadab2745db13fcb5e"
EXPECTED_ROWS = 453
EXPECTED_RENDERED_TOKENS = 100_262
EXPECTED_JSONL_SHA256 = "a04949ebf94de950170b8886d39bcbdee895d83d1188f967bf5b4d83b5369c51"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def token_count(value) -> int:
    ids = value["input_ids"] if hasattr(value, "keys") else value
    if hasattr(ids, "tolist"):
        ids = ids.tolist()
    while ids and isinstance(ids[0], list):
        ids = ids[0]
    return len(ids)


def fetch_source(source: str, cache_path: Path) -> Path:
    candidate = Path(source).expanduser()
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    if candidate.is_file():
        if candidate.resolve() != cache_path.resolve():
            shutil.copyfile(candidate, cache_path)
    elif not cache_path.exists():
        urllib.request.urlretrieve(source, cache_path)
    actual = sha256(cache_path)
    if actual != SOURCE_SHA256:
        raise ValueError(f"source checksum mismatch: expected {SOURCE_SHA256}, got {actual}")
    return cache_path


def build_rows(source: Path, tokenizer) -> list[dict]:
    rows: list[dict] = []
    prompts: dict[str, dict] = {}
    columns = ["message_id", "parent_id", "role", "text", "deleted", "lang"]
    parquet = pq.ParquetFile(source)
    for batch in parquet.iter_batches(columns=columns, batch_size=4096):
        for record in batch.to_pylist():
            if record.get("role") == "prompter" and not record.get("deleted"):
                prompts[record["message_id"]] = record
                continue
            if (
                record.get("role") != "assistant"
                or record.get("deleted")
                or record.get("lang") not in (None, "en")
            ):
                continue
            parent = prompts.get(record.get("parent_id"))
            if not parent:
                continue
            row = {
                "id": "oasst1-" + record["message_id"],
                "domain": "conversation",
                "prompt": parent["text"],
                "answer": record["text"],
                "source": "OpenAssistant/oasst1",
                "license": "Apache-2.0",
                "split": "train",
                "repeat_index": 0,
            }
            rendered = tokenizer.apply_chat_template(
                [
                    {"role": "user", "content": row["prompt"]},
                    {"role": "assistant", "content": row["answer"]},
                ],
                tokenize=True,
                add_generation_prompt=False,
            )
            row["rendered_tokens"] = token_count(rendered)
            rows.append(row)
            if len(rows) == EXPECTED_ROWS:
                return rows
    raise RuntimeError(f"source yielded only {len(rows)} eligible rows")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=MODEL_ID, help="Model ID or local model directory")
    parser.add_argument("--source", default=SOURCE_URL, help="Pinned OASST parquet URL or local file")
    parser.add_argument("--output", type=Path, default=Path("data/train.jsonl"))
    args = parser.parse_args()

    source = fetch_source(args.source, args.output.parent / "source" / "oasst1-train.parquet")
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    rows = build_rows(source, tokenizer)
    rendered_tokens = sum(row["rendered_tokens"] for row in rows)
    if rendered_tokens != EXPECTED_RENDERED_TOKENS:
        raise ValueError(
            f"token count mismatch: expected {EXPECTED_RENDERED_TOKENS}, got {rendered_tokens}; "
            "use the pinned model tokenizer"
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    content = "\n".join(json.dumps(row, ensure_ascii=False, sort_keys=True) for row in rows) + "\n"
    args.output.write_text(content, encoding="utf-8")
    actual = sha256(args.output)
    if actual != EXPECTED_JSONL_SHA256:
        raise ValueError(f"training-data checksum mismatch: expected {EXPECTED_JSONL_SHA256}, got {actual}")
    print(json.dumps({"rows": len(rows), "rendered_tokens": rendered_tokens, "sha256": actual}))


if __name__ == "__main__":
    main()
