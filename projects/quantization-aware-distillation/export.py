#!/usr/bin/env python3
"""Merge trained weights, create Q4_0 GGUF, and smoke-test the result."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path

os.environ.setdefault("HF_DEACTIVATE_ASYNC_LOAD", "1")

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_ID = "google/gemma-4-E2B-it"
MODEL_REVISION = "3e22461f65e89153144f8adb70e3b8c2cc9845a7"


def run(command: list[str]) -> None:
    print("+", " ".join(command), flush=True)
    subprocess.run(command, check=True)


def export_hf(base: str, revision: str | None, weights: Path, output: Path) -> None:
    load_kwargs = {"dtype": torch.bfloat16, "low_cpu_mem_usage": True, "device_map": {"": "cpu"}}
    if revision:
        load_kwargs["revision"] = revision
    model = AutoModelForCausalLM.from_pretrained(base, **load_kwargs)
    tokenizer = AutoTokenizer.from_pretrained(base, revision=revision)
    state = torch.load(weights, map_location="cpu", mmap=True, weights_only=True)

    language_model = model.model.language_model
    expected = language_model.state_dict()
    if state.keys() != expected.keys():
        missing = sorted(expected.keys() - state.keys())
        extra = sorted(state.keys() - expected.keys())
        raise ValueError(f"language-model keys mismatch; missing={missing[:5]}, extra={extra[:5]}")
    for name, tensor in state.items():
        target = expected[name]
        if tensor.shape != target.shape or tensor.dtype != target.dtype:
            raise ValueError(
                f"tensor mismatch for {name}: expected {target.shape}/{target.dtype}, "
                f"got {tensor.shape}/{tensor.dtype}"
            )
    language_model.load_state_dict(state, strict=True)
    output.mkdir(parents=True, exist_ok=False)
    model.save_pretrained(output, safe_serialization=True, max_shard_size="2GB")
    tokenizer.save_pretrained(output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default=MODEL_ID, help="Base model ID or local directory")
    parser.add_argument("--revision", default=MODEL_REVISION)
    parser.add_argument("--weights", type=Path, required=True, help="language-model.pt from train.py")
    parser.add_argument("--llama-cpp", type=Path, required=True)
    parser.add_argument("--hf-output", type=Path, required=True, help="Intermediate Hugging Face directory")
    parser.add_argument("--output", type=Path, required=True, help="Final Q4_0 GGUF")
    parser.add_argument("--keep-f16", action="store_true")
    args = parser.parse_args()

    converter = args.llama_cpp / "convert_hf_to_gguf.py"
    quantizer = args.llama_cpp / "build" / "bin" / "llama-quantize"
    cli = args.llama_cpp / "build" / "bin" / "llama-cli"
    for path in (converter, quantizer, cli):
        if not path.exists():
            raise FileNotFoundError(path)
    if args.output.exists():
        raise FileExistsError(args.output)

    revision = None if Path(args.base).expanduser().exists() else args.revision
    export_hf(args.base, revision, args.weights, args.hf_output)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    f16 = args.output.with_name(args.output.stem + "-f16.gguf")
    if f16.exists():
        raise FileExistsError(f16)
    run(["python3", str(converter), str(args.hf_output), "--outfile", str(f16), "--outtype", "f16"])
    run([str(quantizer), str(f16), str(args.output), "Q4_0"])
    run([str(cli), "-m", str(args.output), "-p", "Say hello.", "-n", "8", "--temp", "0"])
    if not args.keep_f16:
        f16.unlink()
    print(
        json.dumps(
            {
                "hf_output": str(args.hf_output),
                "gguf": str(args.output),
                "gguf_bytes": args.output.stat().st_size,
            }
        )
    )


if __name__ == "__main__":
    main()
