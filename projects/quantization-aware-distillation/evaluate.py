#!/usr/bin/env python3
"""Evaluate one GGUF with the exact ARC/HellaSwag likelihood protocol."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "evaluation_manifest.json"
SOURCE = ROOT / "native_likelihood.cpp"
BINARY = ROOT / ".build" / "qad-likelihood"
NATIVE_SCHEMA = "maccrate.qad.native_likelihood.v1"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def digest(value) -> str:
    data = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
    return hashlib.sha256(data).hexdigest()


def build_native(llama_cpp: Path, expected_revision: str, allow_unpinned: bool) -> Path:
    actual_revision = subprocess.check_output(
        ["git", "-C", str(llama_cpp), "rev-parse", "HEAD"], text=True
    ).strip()
    if actual_revision != expected_revision and not allow_unpinned:
        raise ValueError(
            f"llama.cpp revision mismatch: expected {expected_revision}, got {actual_revision}; "
            "checkout the pinned revision or pass --allow-unpinned-llama"
        )
    build = llama_cpp / "build" / "bin"
    required = [build / "libllama.so", build / "libggml.so", build / "libggml-base.so"]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(f"build llama.cpp first; missing: {', '.join(missing)}")
    BINARY.parent.mkdir(parents=True, exist_ok=True)
    command = [
        "c++",
        "-std=c++17",
        "-O2",
        str(SOURCE),
        f"-I{llama_cpp / 'include'}",
        f"-I{llama_cpp / 'ggml' / 'include'}",
        f"-I{llama_cpp / 'vendor'}",
        f"-L{build}",
        f"-Wl,-rpath,{build}",
        "-lllama",
        "-lggml",
        "-lggml-base",
        "-o",
        str(BINARY),
    ]
    subprocess.run(command, check=True)
    return BINARY


def encode_request(context: str, continuation: str) -> dict:
    stripped = context.rstrip()
    continuation = context[len(stripped) :] + continuation
    if not stripped or not continuation:
        raise ValueError("empty context or continuation")
    return {"context": stripped, "continuation": continuation}


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def parse_native(path: Path, requests: list[dict]) -> dict[str, dict]:
    expected = {request["id"] for request in requests}
    parsed: dict[str, dict] = {}
    for row in read_jsonl(path):
        key = row["id"]
        if (
            key not in expected
            or key in parsed
            or row.get("schema") != NATIVE_SCHEMA
            or row.get("status") != "ok"
        ):
            raise ValueError(f"invalid native response: {key}")
        result = row["batched"]
        context_ids = row["context_ids"]
        continuation_ids = row["continuation_ids"]
        joint_ids = row["joint_ids"]
        token_logprobs = result["token_logprobs"]
        if joint_ids != context_ids + continuation_ids:
            raise ValueError(f"token boundary mismatch: {key}")
        if len(token_logprobs) != len(continuation_ids):
            raise ValueError(f"likelihood count mismatch: {key}")
        if not math.isclose(sum(token_logprobs), result["sum_logprob"], abs_tol=1e-9):
            raise ValueError(f"likelihood sum mismatch: {key}")
        parsed[key] = row
    if set(parsed) != expected:
        raise ValueError("missing native responses")
    return parsed


def score(items: list[dict], parsed: dict[str, dict], task: str, model_name: str) -> list[dict]:
    results = []
    for item in items:
        scores = [
            parsed[f"{item['item_id']}:{index}"]["batched"]["sum_logprob"]
            for index in range(len(item["choices"]))
        ]
        normalized = [value / len(choice) for value, choice in zip(scores, item["choices"])]
        predicted = max(range(len(scores)), key=scores.__getitem__)
        predicted_norm = max(range(len(normalized)), key=normalized.__getitem__)
        results.append(
            {
                "schema": "maccrate.qad.multiple_choice.v1",
                "task": task,
                "model": model_name,
                "item_id": item["item_id"],
                "gold_index": item["gold_index"],
                "predicted_index": predicted,
                "predicted_index_norm": predicted_norm,
                "correct": int(predicted == item["gold_index"]),
                "correct_norm": int(predicted_norm == item["gold_index"]),
                "choice_scores": scores,
                "choice_scores_char_normalized": normalized,
            }
        )
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, required=True, help="GGUF to evaluate")
    parser.add_argument("--name", required=True, help="Model label written to results")
    parser.add_argument("--task", choices=["arc", "hellaswag"], required=True)
    parser.add_argument("--llama-cpp", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--threads", type=int, default=2)
    parser.add_argument("--count", type=int, help="Optional prefix for a smoke run")
    parser.add_argument("--timeout", type=int, default=86400)
    parser.add_argument("--allow-unpinned-llama", action="store_true")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    task = manifest["tasks"][args.task]
    items = task["items"]
    if digest(items) != task["rendered_sha256"] or len(items) != task["count"]:
        raise ValueError("evaluation manifest mismatch")
    if args.count is not None:
        if args.count < 1:
            raise ValueError("--count must be positive")
        items = items[: args.count]

    binary = build_native(args.llama_cpp, manifest["llama_commit"], args.allow_unpinned_llama)
    requests = []
    for item in items:
        for index, choice in enumerate(item["choices"]):
            requests.append(
                {
                    "id": f"{item['item_id']}:{index}",
                    **encode_request(item["context"], " " + choice),
                }
            )

    args.output.mkdir(parents=True, exist_ok=False)
    with tempfile.TemporaryDirectory(prefix="qad-eval-", dir=args.output) as temporary:
        temporary = Path(temporary)
        request_path = temporary / "requests.jsonl"
        response_path = temporary / "responses.jsonl"
        request_path.write_text(
            "".join(json.dumps(request, ensure_ascii=False) + "\n" for request in requests),
            encoding="utf-8",
        )
        env = dict(
            os.environ,
            CUDA_VISIBLE_DEVICES="",
            HIP_VISIBLE_DEVICES="",
            ROCR_VISIBLE_DEVICES="",
        )
        command = [
            str(binary),
            str(args.model),
            str(request_path),
            str(response_path),
            str(args.threads),
            "1",
            str(manifest["native_settings"]["context"]),
            "0",
        ]
        with (args.output / "native.log").open("x") as log:
            subprocess.run(command, check=True, timeout=args.timeout, env=env, stdout=log, stderr=log)
        parsed = parse_native(response_path, requests)

    results = score(items, parsed, args.task, args.name)
    with (args.output / "results.jsonl").open("x", encoding="utf-8") as handle:
        for row in results:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    summary = {
        "task": args.task,
        "model": args.name,
        "model_sha256": sha256(args.model),
        "rows": len(results),
        "choices": len(requests),
        "accuracy": sum(row["correct"] for row in results) / len(results),
        "accuracy_char_normalized": sum(row["correct_norm"] for row in results) / len(results),
        "protocol": {
            "num_fewshot": 0,
            "chat_template": False,
            "target_delimiter": " ",
            "chunk": 1,
            "context": manifest["native_settings"]["context"],
            "backend": "CPU",
            "llama_commit": manifest["llama_commit"],
        },
    }
    (args.output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
