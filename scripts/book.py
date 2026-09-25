#!/usr/bin/env python3
"""Validate, list, count, or emit Huey's canonical Markdown source tree."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "book.yaml"
COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
WORD_RE = re.compile(r"\b[\w’'-]+\b", re.UNICODE)
FORBIDDEN_TRACKED_PREFIXES = ("private/", "sources/raw/", "sources/restricted/")


def load_manifest(path: Path = MANIFEST) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _inside(path: Path, root: Path) -> bool:
    path = path.resolve()
    root = root.resolve()
    return path == root or root in path.parents


def _tracked_paths() -> list[str]:
    try:
        result = subprocess.run(
            ["git", "ls-files"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def visible_text(text: str) -> str:
    return COMMENT_RE.sub("", text).strip()


def word_count(text: str) -> int:
    text = COMMENT_RE.sub(" ", text)
    return len(WORD_RE.findall(text))


def validate(manifest: dict | None = None) -> list[str]:
    manifest = manifest or load_manifest()
    errors: list[str] = []

    if manifest.get("schema") != "huey.book.v1":
        errors.append("unsupported or missing schema")

    source_root = ROOT / manifest.get("canonical_source_root", "")
    if source_root.resolve() != (ROOT / "manuscript").resolve():
        errors.append("canonical_source_root must be manuscript")

    horizon = manifest.get("word_horizon", {})
    if horizon.get("approximate_words") != 120000:
        errors.append("narrative word horizon must remain approximately 120,000 unless author direction changes it")
    if horizon.get("binding") is not False:
        errors.append("narrative word horizon must remain nonbinding")

    composition = manifest.get("composition_policy", {})
    if composition.get("mode") != "world_first_flow_then_argument_cuts":
        errors.append("composition mode must remain world-first flow then argument cuts")
    if composition.get("chapter_order_status") != "working_projection_not_final":
        errors.append("chapter order must be marked as a working projection")
    if composition.get("chapter_title_status") != "working_projection_not_final":
        errors.append("chapter titles must be marked as working projections")
    flow_root = ROOT / composition.get("flow_root", "")
    if flow_root.resolve() != (ROOT / "manuscript" / "flow").resolve():
        errors.append("flow_root must be manuscript/flow")
    if not flow_root.exists():
        errors.append("manuscript/flow must exist")

    ids: set[str] = set()
    paths: set[str] = set()
    for item in manifest.get("items", []):
        item_id = item.get("id")
        rel = item.get("path", "")
        if item_id in ids:
            errors.append(f"duplicate item id: {item_id}")
        ids.add(item_id)
        if rel in paths:
            errors.append(f"duplicate item path: {rel}")
        paths.add(rel)

        if item.get("order_status") != "working_projection_not_final":
            errors.append(f"{item_id}: order must be marked as a working projection")
        title_status = item.get("title_status", "")
        if "working" not in title_status or "final" not in title_status:
            errors.append(f"{item_id}: title must be explicitly marked as working/not final")

        path = ROOT / rel
        if path.suffix.lower() != ".md":
            errors.append(f"{item_id}: canonical manuscript source must be .md")
        if not _inside(path, source_root):
            errors.append(f"{item_id}: source path escapes manuscript/")
        if not path.exists():
            errors.append(f"{item_id}: missing source path {rel}")
            continue
        if item.get("status") == "planned" and visible_text(path.read_text(encoding="utf-8")):
            errors.append(f"{item_id}: planned placeholder contains manuscript prose")
        if item.get("include") and item.get("status") == "planned":
            errors.append(f"{item_id}: planned placeholder cannot be emitted")

    policy = manifest.get("source_policy", {})
    if policy.get("raw_evidence_in_public_repository") is not False:
        errors.append("raw evidence must remain outside the public repository")

    cert_root = ROOT / policy.get("certificate_root", "certificates")
    if cert_root.exists():
        for path in cert_root.rglob("*"):
            if path.is_file() and path.suffix.lower() != ".md":
                errors.append(f"certificate repository is Markdown-only: {path.relative_to(ROOT)}")

    for rel in _tracked_paths():
        if rel.startswith(FORBIDDEN_TRACKED_PREFIXES):
            errors.append(f"forbidden public tracked evidence path: {rel}")

    return errors


def included_items(manifest: dict) -> list[dict]:
    return [item for item in manifest.get("items", []) if item.get("include")]


def render(manifest: dict | None = None) -> str:
    manifest = manifest or load_manifest()
    errors = validate(manifest)
    if errors:
        raise ValueError("\n".join(errors))

    parts: list[str] = []
    for item in included_items(manifest):
        rel = item["path"]
        body = (ROOT / rel).read_text(encoding="utf-8").rstrip()
        parts.append(f"<!-- BEGIN {item['id']} {rel} -->\n{body}\n<!-- END {item['id']} -->")
    return "\n\n".join(parts) + ("\n" if parts else "")


def count_report(manifest: dict | None = None) -> dict:
    manifest = manifest or load_manifest()
    errors = validate(manifest)
    if errors:
        raise ValueError("\n".join(errors))

    by_movement: dict[str, int] = {}
    items: list[dict] = []
    total = 0
    for item in included_items(manifest):
        text = (ROOT / item["path"]).read_text(encoding="utf-8")
        count = word_count(text)
        total += count
        by_movement[item["movement"]] = by_movement.get(item["movement"], 0) + count
        items.append({"id": item["id"], "words": count, "path": item["path"]})

    return {
        "scope": manifest["word_horizon"]["scope"],
        "horizon": {
            "approximate_words": manifest["word_horizon"]["approximate_words"],
            "binding": manifest["word_horizon"]["binding"],
        },
        "included_words": total,
        "by_movement": by_movement,
        "items": items,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("validate", "list", "count", "emit"))
    args = parser.parse_args()

    manifest = load_manifest()
    errors = validate(manifest)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 2

    if args.command == "validate":
        print("book source tree: OK")
    elif args.command == "list":
        for item in manifest["items"]:
            print(
                "\t".join(
                    (
                        item["id"],
                        item["movement"],
                        item["status"],
                        item["order_status"],
                        item["title_status"],
                        "include" if item["include"] else "hold",
                        item["path"],
                    )
                )
            )
    elif args.command == "count":
        print(json.dumps(count_report(manifest), indent=2, ensure_ascii=False))
    elif args.command == "emit":
        sys.stdout.write(render(manifest))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
