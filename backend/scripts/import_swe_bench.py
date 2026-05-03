#!/usr/bin/env python3
"""Developer CLI: fetch SWE-bench Lite entries and write swe_bench_seeds.py."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Any

import httpx

HF_ENDPOINT = (
    "https://datasets-server.huggingface.co/rows"
    "?dataset=princeton-nlp%2FSWE-bench_Lite"
    "&config=default"
    "&split=test"
    "&offset=0"
    "&limit=20"
)

DEFAULT_OUTPUT = (
    Path(__file__).parent.parent / "app" / "features" / "prompts" / "swe_bench_seeds.py"
)


def make_slug(instance_id: str) -> str:
    slug = instance_id.replace("__", "-").replace("/", "-")
    return f"swe-{slug}"


def extract_test_functions(test_patch: str) -> list[str]:
    """Extract added def test_ functions from test file hunks in a unified diff."""
    in_test_file = False
    added_lines: list[str] = []

    for line in test_patch.splitlines():
        if line.startswith("+++ b/"):
            filename = line[6:].strip()
            basename = filename.split("/")[-1]
            in_test_file = basename.startswith("test_") or basename.endswith("_test.py")
            continue
        if line.startswith("--- ") or line.startswith("diff "):
            in_test_file = False
            continue
        if not in_test_file:
            continue
        if line.startswith("+") and not line.startswith("+++"):
            added_lines.append(line[1:])

    functions: list[str] = []
    current: list[str] = []

    for line in added_lines:
        if re.match(r"^def test_\w+", line):
            if current:
                functions.append("\n".join(current))
            current = [line]
        elif current:
            current.append(line)

    if current:
        functions.append("\n".join(current))

    return [fn for fn in functions if fn.strip()]


def adapt_imports(fn_code: str) -> str:
    """Rewrite the first 'from <module> import ...' to 'from solution import ...'."""
    lines = fn_code.splitlines()
    adapted = False
    result = []
    for line in lines:
        if not adapted:
            m = re.match(r"^(\s*)from\s+\S+\s+import\s+(.+)$", line)
            if m:
                result.append(f"{m.group(1)}from solution import {m.group(2)}")
                adapted = True
                continue
        result.append(line)
    return "\n".join(result)


def build_seed_entry(entry: dict[str, Any]) -> str | None:
    instance_id = entry.get("instance_id", "").strip()
    problem_statement = entry.get("problem_statement", "").strip()
    patch = entry.get("patch", "").strip()
    test_patch = entry.get("test_patch", "").strip()
    repo = entry.get("repo", "").strip()

    if not instance_id or not problem_statement or not test_patch:
        return None

    slug = make_slug(instance_id)

    raw_fns = extract_test_functions(test_patch)
    if not raw_fns:
        return None

    adapted_fns = [adapt_imports(fn) for fn in raw_fns]
    test_code = "\n\n".join(adapted_fns)
    description = f"SWE-bench fix: {instance_id}"

    return (
        f"    BuiltinPromptSeed(\n"
        f"        slug={slug!r},\n"
        f"        name={instance_id!r},\n"
        f"        category_slug=\"code_generation\",\n"
        f"        scenario_type=\"code_generation\",\n"
        f"        description={description!r},\n"
        f"        user_prompt_text={problem_statement!r},\n"
        f"        evaluation_notes=\"SWE-bench: all pytest tests must pass against the fix.\",\n"
        f"        tags=(\"benchmark\", \"swe-bench\", \"code-generation\"),\n"
        f"        input_artifacts_jsonb=(\n"
        f"            {{\n"
        f"                \"name\": \"patch.diff\",\n"
        f"                \"kind\": \"document\",\n"
        f"                \"content\": {patch!r},\n"
        f"            }},\n"
        f"        ),\n"
        f"        test_cases_visible=None,\n"
        f"        test_cases_hidden=(\n"
        f"            {{\"type\": \"pytest\", \"code\": {test_code!r}}},\n"
        f"        ),\n"
        f"    )"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import SWE-bench Lite entries into swe_bench_seeds.py"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Path to write swe_bench_seeds.py (default: app/features/prompts/swe_bench_seeds.py)",
    )
    args = parser.parse_args()

    print("Fetching SWE-bench Lite from HuggingFace...", file=sys.stderr)
    response = httpx.get(HF_ENDPOINT, timeout=30)
    response.raise_for_status()
    data = response.json()

    rows = data.get("rows", [])
    print(f"Got {len(rows)} rows", file=sys.stderr)

    entries = [r["row"] for r in rows if r.get("row", {}).get("repo")]
    print(f"{len(entries)} entries after filtering", file=sys.stderr)

    literals: list[str] = []
    for entry in entries:
        lit = build_seed_entry(entry)
        if lit:
            literals.append(lit)
        if len(literals) >= 20:
            break

    if len(literals) < 5:
        print(
            f"ERROR: Only {len(literals)} valid entries (need >= 5). Aborting.",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"Writing {len(literals)} seeds to {args.output}", file=sys.stderr)

    lines = [
        '"""Auto-generated by import_swe_bench.py. Re-run to refresh."""',
        "from __future__ import annotations",
        "",
        "from app.features.prompts.prompt_seed_types import BuiltinPromptSeed",
        "",
        "",
        "SWE_BENCH_SEEDS: tuple[BuiltinPromptSeed, ...] = (",
    ]
    for lit in literals:
        lines.append(lit + ",")
    lines.append(")")
    lines.append("")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(lines), encoding="utf-8")
    print(f"Done. {len(literals)} seeds written.", file=sys.stderr)


if __name__ == "__main__":
    main()
