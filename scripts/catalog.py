"""Read-only, metadata-only source link planning. Never queries or grants access."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
from typing import Any
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://grwtsk.com"
SOURCE = re.compile(r"(?:A0[1-4]|E(?:0[1-9]|1[0-6])|D0[1-6])")
CHAPTER = re.compile(r"C(?:0[1-9]|1[0-6])")
ISSUE = re.compile(r"https://github\.com/grwtsk/(?:huey|neurology|noeaaeue-kernel)/issues/[1-9][0-9]*")
RECEIPT = re.compile(ISSUE.pattern + r"#issuecomment-[1-9][0-9]*")
PARAMETER = re.compile(r"[a-z][a-z0-9_]{0,31}")
ROUTE = re.compile(r"(?:/[a-z0-9][a-z0-9_-]*)+/?")
VERSION = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}")
SHA = re.compile(r"[0-9a-f]{40}")
KINDS = {"literary_anchor", "accepted_plan", "research_draft", "derived_dossier", "documentary_family"}
USES = {"anchor", "planning", "adaptation_candidate", "documentary_candidate"}
STAGES = {"contract", "real_source_admission", "storage", "search", "reader_ui", "end_to_end"}
RESERVED_PARAMETERS = {"token", "access_token", "auth", "authorization", "password", "secret", "key", "api_key", "grant"}


class CatalogError(ValueError):
    """Reason codes intentionally contain no input payload."""


def require(condition: bool, reason: str) -> None:
    if not condition:
        raise CatalogError(reason)


def exact_keys(value: Any, keys: set[str]) -> None:
    require(type(value) is dict and set(value) == keys, "INVALID_FIELDS")


def matches(pattern: re.Pattern[str], value: Any) -> bool:
    return isinstance(value, str) and pattern.fullmatch(value) is not None


def unique_list(value: Any, pattern: re.Pattern[str], *, empty: bool = False) -> None:
    require(type(value) is list and len(value) <= 128, "INVALID_LIST")
    require(empty or bool(value), "EMPTY_LIST")
    require(all(matches(pattern, item) for item in value), "INVALID_IDENTIFIER")
    require(len(set(value)) == len(value), "DUPLICATE_IDENTIFIER")


def load_json(path: Path) -> Any:
    """The .yaml catalog deliberately uses only the JSON-compatible subset."""
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        result = {}
        for key, value in items:
            require(key not in result, "DUPLICATE_KEY")
            result[key] = value
        return result

    def constant(_: str) -> None:
        raise CatalogError("NONFINITE_JSON")

    try:
        with path.open("rb") as stream:
            data = stream.read(1_000_001)
        require(len(data) <= 1_000_000, "INPUT_TOO_LARGE")
        return json.loads(data.decode("utf-8"), object_pairs_hook=pairs, parse_constant=constant)
    except (OSError, UnicodeError, json.JSONDecodeError, RecursionError) as exc:
        raise CatalogError("INVALID_INPUT") from exc


def validate(catalog: Any, service: Any) -> None:
    exact_keys(catalog, {"schema_version", "inventory_basis", "mapping_status", "expected_ids", "entries"})
    require(type(catalog["schema_version"]) is int and catalog["schema_version"] == 1, "UNSUPPORTED_SCHEMA")
    require(catalog["inventory_basis"] == "https://github.com/grwtsk/huey/issues/16", "INVALID_INVENTORY_BASIS")
    require(catalog["mapping_status"] == "proposed_not_source_verified", "INVALID_MAPPING_STATUS")
    unique_list(catalog["expected_ids"], SOURCE)
    expected = {f"A{i:02}" for i in range(1, 5)} | {f"E{i:02}" for i in range(1, 17)} | {f"D{i:02}" for i in range(1, 7)}
    require(set(catalog["expected_ids"]) == expected, "INCOMPLETE_INVENTORY")
    require(type(catalog["entries"]) is list and len(catalog["entries"]) == len(expected), "INCOMPLETE_INVENTORY")

    exact_keys(service, {"schema_version", "author_instruction", "reader_origin", "owners", "binding", "dependencies"})
    require(type(service["schema_version"]) is int and service["schema_version"] == 1, "UNSUPPORTED_SCHEMA")
    require(service["author_instruction"] == "https://github.com/grwtsk/huey/issues/16#issuecomment-5746275749", "INVALID_INSTRUCTION_REF")
    require(service["reader_origin"] == ORIGIN, "INVALID_ORIGIN")
    require(service["owners"] == {"source_service": "grwtsk/noeaaeue-kernel", "reader_ui": "grwtsk/neurology", "coverage": "grwtsk/huey"}, "INVALID_OWNERSHIP")
    require(type(service["dependencies"]) is list and len(service["dependencies"]) == 6, "INVALID_DEPENDENCIES")
    dependency_ids = set()
    for dep in service["dependencies"]:
        exact_keys(dep, {"stage", "issue"})
        require(matches(ISSUE, dep["issue"]), "INVALID_DEPENDENCY_REF")
        require(isinstance(dep["stage"], str) and dep["stage"] in STAGES, "INVALID_STAGE")
        require(dep["stage"] not in dependency_ids, "DUPLICATE_STAGE")
        dependency_ids.add(dep["stage"])
    require(dependency_ids == STAGES, "MISSING_STAGE")

    binding = service["binding"]
    if binding is not None:
        exact_keys(binding, {"endpoint_path", "query_parameter", "interface_version", "kernel_commit", "host_commit", "verification_receipt"})
        require(matches(ROUTE, binding["endpoint_path"]), "UNSAFE_ENDPOINT")
        require(matches(PARAMETER, binding["query_parameter"]) and binding["query_parameter"] not in RESERVED_PARAMETERS, "UNSAFE_QUERY_PARAMETER")
        require(matches(VERSION, binding["interface_version"]), "INVALID_INTERFACE_VERSION")
        require(matches(SHA, binding["kernel_commit"]) and matches(SHA, binding["host_commit"]), "INVALID_COMMIT")
        require(matches(RECEIPT, binding["verification_receipt"]), "INVALID_BINDING_RECEIPT")

    seen = set()
    for entry in catalog["entries"]:
        exact_keys(entry, {"source_id", "kind", "chapters", "use", "query_alias", "binding"})
        sid = entry["source_id"]
        require(matches(SOURCE, sid), "INVALID_SOURCE_ID")
        require(sid not in seen, "DUPLICATE_SOURCE_ID")
        seen.add(sid)
        require(isinstance(entry["kind"], str) and entry["kind"] in KINDS, "INVALID_KIND")
        expected_kind = ("literary_anchor" if sid in {"A01", "A02", "A03"} else
                         "accepted_plan" if sid == "A04" else
                         "research_draft" if sid.startswith("E") else
                         "derived_dossier" if sid == "D01" else "documentary_family")
        require(entry["kind"] == expected_kind, "SOURCE_CLASS_CHANGED")
        require(isinstance(entry["use"], str) and entry["use"] in USES, "INVALID_USE")
        unique_list(entry["chapters"], CHAPTER, empty=entry["use"] == "planning")
        require(entry["query_alias"] == "huey." + sid.lower(), "INVALID_QUERY_ALIAS")
        ref = entry["binding"]
        if ref is not None:
            require(binding is not None, "SERVICE_BINDING_REQUIRED")
            exact_keys(ref, {"interface_version", "verification_receipt"})
            require(ref["interface_version"] == binding["interface_version"], "INCOMPATIBLE_BINDING")
            require(matches(RECEIPT, ref["verification_receipt"]), "INVALID_BINDING_RECEIPT")
    require(seen == expected, "INCOMPLETE_INVENTORY")


def _url(entry: dict[str, Any], service: dict[str, Any]) -> str | None:
    binding = service["binding"]
    if binding is None or entry["binding"] is None:
        return None
    return ORIGIN + binding["endpoint_path"] + "?" + urlencode({binding["query_parameter"]: entry["query_alias"]})


def link_for(source_id: str, catalog: Any, service: Any) -> str | None:
    """Format navigation only; configured receipts require external inspection."""
    validate(catalog, service)
    for entry in catalog["entries"]:
        if entry["source_id"] == source_id:
            return _url(entry, service)
    raise CatalogError("UNKNOWN_SOURCE_ID")


def render(catalog: Any, service: Any) -> str:
    validate(catalog, service)
    lines = ["# Source-to-book coverage ledger", "", "Generated by `python3 scripts/catalog.py render`. Do not edit this table by hand.", "", "These are planning aliases and proposed mappings, not an inventory of ingested records or independent factual verification. Detailed titles, original bytes, private locators and source-version bindings belong behind Reader access in the kernel-managed service.", "", "A configured link populates a search query; it never grants access. Pending means no working endpoint/source binding is claimed. The endpoint and alias syntax require the upstream contract and an inspected integration receipt.", "", "| Source alias | Source class | Use | Chapter tasks | Reader search |", "|---|---|---|---|---|"]
    for entry in sorted(catalog["entries"], key=lambda row: row["source_id"]):
        chapters = ", ".join(entry["chapters"]) or "Structure only"
        url = _url(entry, service)
        link = f"[Search permitted sources]({url})" if url else "Pending service / binding"
        lines.append(f"| {entry['source_id']} | {entry['kind']} | {entry['use']} | {chapters} | {link} |")
    lines += ["", "Chapter work: " + ", ".join(f"[C{i:02}](https://github.com/grwtsk/huey/issues/{i + 36})" for i in range(1, 17)) + ".", "", "## Delivery dependencies", ""]
    for dep in service["dependencies"]:
        lines.append(f"- {dep['stage']}: {dep['issue']}")
    lines += ["", "The source-to-chapter assignments are editorial proposals derived from the existing work plan. They do not revise source wording, accept factual claims, or count recipient variants as independent evidence. See `source-catalog-contract.md` for the D-series register and stage-specific completion boundaries.", ""]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("validate", "render", "check", "link"))
    parser.add_argument("source_id", nargs="?")
    parser.add_argument("--catalog", type=Path, default=ROOT / "sources/catalog.yaml")
    parser.add_argument("--service", type=Path, default=ROOT / "planning/source-service.json")
    parser.add_argument("--ledger", type=Path, default=ROOT / "planning/source-coverage.md")
    args = parser.parse_args()
    try:
        catalog, service = load_json(args.catalog), load_json(args.service)
        validate(catalog, service)
        if args.command == "render":
            print(render(catalog, service), end="")
        elif args.command == "check":
            require(args.ledger.read_text(encoding="utf-8") == render(catalog, service), "LEDGER_DRIFT")
            print("LEDGER_CURRENT_NOT_SERVICE_VERIFICATION")
        elif args.command == "link":
            url = link_for(args.source_id, catalog, service)
            if url is None:
                print("PENDING_SERVICE_OR_BINDING")
                return 3
            print(url)
        else:
            bound = sum(entry["binding"] is not None for entry in catalog["entries"])
            state = "configured_not_live_verified" if service["binding"] is not None else "pending"
            print(f"CATALOG_VALID aliases={len(catalog['entries'])} bound={bound} service={state}")
    except CatalogError as exc:
        print(str(exc))
        return 1
    except (OSError, UnicodeError, ValueError, TypeError, RecursionError):
        print("INVALID_INPUT")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
