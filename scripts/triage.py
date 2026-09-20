"""Read-only stage triage. Input observations are claims to verify, never grants."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REPOS = frozenset({"grwtsk/huey", "grwtsk/neurology", "grwtsk/noeaaeue-kernel"})
ISSUE = re.compile(r"https://github\.com/(grwtsk/(?:huey|neurology|noeaaeue-kernel))/issues/([1-9][0-9]*)\Z")
RECEIPT = re.compile(r"https://github\.com/(grwtsk/(?:huey|neurology|noeaaeue-kernel))/(?:pull/[1-9][0-9]*|commit/[0-9a-f]{40})(?:#issuecomment-[1-9][0-9]*)?\Z")
ID = re.compile(r"[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*\Z")
SHA256 = re.compile(r"[0-9a-f]{64}\Z")
COMMIT = re.compile(r"[0-9a-f]{40}\Z")
TIME = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:Z|[+-][0-9]{2}:[0-9]{2})\Z")
MAX_BYTES = 1_000_000
MAX_NODES = 256
MAX_EDGES = 2048


class InvalidInput(ValueError):
    """Only fixed reason codes may reach the command's output."""


def require(condition: bool, code: str) -> None:
    if not condition:
        raise InvalidInput(code)


def keys(value: Any, expected: set[str], code: str) -> None:
    require(type(value) is dict and set(value) == expected, code)


def items(value: Any, maximum: int, code: str) -> None:
    require(type(value) is list and len(value) <= maximum, code)


def matches(pattern: re.Pattern[str], value: Any) -> bool:
    return type(value) is str and pattern.fullmatch(value) is not None


def unique(values: list[Any], code: str) -> None:
    require(len(values) == len(set(values)), code)


def instant(value: Any) -> datetime:
    require(matches(TIME, value), "INVALID_TIMESTAMP")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError as exc:
        raise InvalidInput("INVALID_TIMESTAMP") from exc


def digest(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def load_json(path: Path) -> Any:
    def pairs(entries: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in entries:
            require(key not in result, "DUPLICATE_JSON_KEY")
            result[key] = value
        return result

    def constant(_: str) -> None:
        raise InvalidInput("NONFINITE_JSON")

    # Read a bounded number of bytes, even when the input is not a regular file.
    with path.open("rb") as handle:
        raw = handle.read(MAX_BYTES + 1)
    require(len(raw) <= MAX_BYTES, "INPUT_TOO_LARGE")
    return json.loads(raw.decode("utf-8"), object_pairs_hook=pairs, parse_constant=constant)


def validate_plan(plan: Any) -> tuple[dict[str, dict[str, Any]], list[str]]:
    keys(plan, {"schema_version", "scope", "stages"}, "INVALID_PLAN")
    require(type(plan["schema_version"]) is int and plan["schema_version"] == 1, "INVALID_PLAN_VERSION")
    require(plan["scope"] == "partial_active_work_not_full_backlog", "INVALID_PLAN_SCOPE")
    items(plan["stages"], MAX_NODES, "INVALID_STAGES")
    require(bool(plan["stages"]), "EMPTY_PLAN")
    nodes: dict[str, dict[str, Any]] = {}
    edge_count = 0
    for node in plan["stages"]:
        keys(node, {"id", "issue", "kind", "depends_on"}, "INVALID_STAGE")
        require(matches(ID, node["id"]) and len(node["id"]) <= 80, "INVALID_STAGE_ID")
        require(node["id"] not in nodes, "DUPLICATE_STAGE_ID")
        require(matches(ISSUE, node["issue"]), "NONCANONICAL_ISSUE")
        require(node["kind"] in ("work", "human", "external"), "INVALID_STAGE_KIND")
        items(node["depends_on"], MAX_NODES, "INVALID_DEPENDENCIES")
        require(all(matches(ID, dep) for dep in node["depends_on"]), "INVALID_DEPENDENCY_ID")
        unique(node["depends_on"], "DUPLICATE_DEPENDENCY")
        edge_count += len(node["depends_on"])
        nodes[node["id"]] = node
    require(edge_count <= MAX_EDGES, "TOO_MANY_EDGES")
    require(all(dep in nodes for n in nodes.values() for dep in n["depends_on"]), "UNKNOWN_DEPENDENCY")
    # Iterative traversal bounds recursion and makes the resulting report stable.
    pending = set(nodes)
    ordered: list[str] = []
    done: set[str] = set()
    while pending:
        ready = sorted(key for key in pending if set(nodes[key]["depends_on"]) <= done)
        require(bool(ready), "DEPENDENCY_CYCLE")
        ordered.extend(ready)
        done.update(ready)
        pending.difference_update(ready)
    return nodes, ordered


def validate_snapshot(snapshot: Any, plan: Any, nodes: dict[str, dict[str, Any]]) -> None:
    keys(snapshot, {"schema_version", "plan_sha256", "observed_at", "issues", "pr_collections", "work_receipts"}, "INVALID_SNAPSHOT")
    require(type(snapshot["schema_version"]) is int and snapshot["schema_version"] == 1, "INVALID_SNAPSHOT_VERSION")
    require(matches(SHA256, snapshot["plan_sha256"]), "INVALID_PLAN_DIGEST")
    require(snapshot["plan_sha256"] == digest(plan), "SNAPSHOT_PLAN_MISMATCH")
    observed = instant(snapshot["observed_at"])
    items(snapshot["issues"], MAX_NODES, "INVALID_ISSUE_OBSERVATIONS")
    known_issues = {node["issue"] for node in nodes.values()}
    refs: list[str] = []
    for issue in snapshot["issues"]:
        keys(issue, {"ref", "state", "updated_at"}, "INVALID_ISSUE_OBSERVATION")
        require(matches(ISSUE, issue["ref"]) and issue["ref"] in known_issues, "UNEXPECTED_ISSUE")
        require(issue["state"] in ("open", "closed"), "INVALID_ISSUE_STATE")
        require(instant(issue["updated_at"]) <= observed, "ISSUE_NEWER_THAN_SNAPSHOT")
        refs.append(issue["ref"])
    unique(refs, "DUPLICATE_ISSUE_OBSERVATION")
    items(snapshot["pr_collections"], len(REPOS), "INVALID_PR_COLLECTIONS")
    repos: list[str] = []
    for collection in snapshot["pr_collections"]:
        keys(collection, {"repository", "coverage", "open"}, "INVALID_PR_COLLECTION")
        repo = collection["repository"]
        require(type(repo) is str and repo in REPOS, "INVALID_REPOSITORY")
        require(collection["coverage"] in ("complete", "partial"), "INVALID_PR_COVERAGE")
        items(collection["open"], 100, "INVALID_OPEN_PRS")
        numbers: list[int] = []
        for pr in collection["open"]:
            keys(pr, {"number", "head_sha", "stages"}, "INVALID_PR")
            require(type(pr["number"]) is int and pr["number"] > 0, "INVALID_PR_NUMBER")
            require(matches(COMMIT, pr["head_sha"]), "INVALID_PR_HEAD")
            items(pr["stages"], MAX_NODES, "INVALID_PR_STAGES")
            require(all(type(stage) is str and stage in nodes for stage in pr["stages"]), "UNKNOWN_PR_STAGE")
            unique(pr["stages"], "DUPLICATE_PR_STAGE")
            require(all(ISSUE.fullmatch(nodes[s]["issue"]).group(1) == repo for s in pr["stages"]), "WRONG_REPOSITORY_PR")
            numbers.append(pr["number"])
        unique(numbers, "DUPLICATE_PR_NUMBER")
        repos.append(repo)
    unique(repos, "DUPLICATE_PR_COLLECTION")
    items(snapshot["work_receipts"], MAX_NODES, "INVALID_WORK_RECEIPTS")
    receipts: list[str] = []
    for receipt in snapshot["work_receipts"]:
        keys(receipt, {"stage", "artifact_commit", "evidence_ref", "issue_updated_at"}, "INVALID_WORK_RECEIPT")
        stage = receipt["stage"]
        require(type(stage) is str and stage in nodes, "UNKNOWN_RECEIPT_STAGE")
        # Human acceptance/regulated activation is intentionally not consumable here.
        require(nodes[stage]["kind"] == "work", "NONWORK_RECEIPT_NOT_SUPPORTED")
        require(matches(COMMIT, receipt["artifact_commit"]), "INVALID_RECEIPT_COMMIT")
        require(matches(RECEIPT, receipt["evidence_ref"]), "INVALID_RECEIPT_REFERENCE")
        require(RECEIPT.fullmatch(receipt["evidence_ref"]).group(1) == ISSUE.fullmatch(nodes[stage]["issue"]).group(1), "WRONG_REPOSITORY_RECEIPT")
        require(instant(receipt["issue_updated_at"]) <= observed, "RECEIPT_NEWER_THAN_SNAPSHOT")
        if "/commit/" in receipt["evidence_ref"]:
            require(receipt["evidence_ref"].split("/commit/")[1].split("#")[0] == receipt["artifact_commit"], "RECEIPT_COMMIT_MISMATCH")
        receipts.append(stage)
    unique(receipts, "DUPLICATE_WORK_RECEIPT")


def report(plan: Any, snapshot: Any, *, now: datetime, max_age_seconds: int = 86400) -> dict[str, Any]:
    nodes, order = validate_plan(plan)
    validate_snapshot(snapshot, plan, nodes)
    require(isinstance(now, datetime) and now.tzinfo is not None and now.utcoffset() is not None, "INVALID_CLOCK")
    require(type(max_age_seconds) is int and 0 < max_age_seconds <= 604800, "INVALID_MAX_AGE")
    age = (now.astimezone(timezone.utc) - instant(snapshot["observed_at"])).total_seconds()
    freshness = "future" if age < 0 else "stale" if age > max_age_seconds else "fresh"
    observations = {row["ref"]: row for row in snapshot["issues"]}
    collections = {row["repository"]: row for row in snapshot["pr_collections"]}
    receipts = {row["stage"]: row for row in snapshot["work_receipts"]}
    results: dict[str, dict[str, Any]] = {}
    for stage in order:
        node = nodes[stage]
        observation = observations.get(node["issue"])
        repo = ISSUE.fullmatch(node["issue"]).group(1)
        collection = collections.get(repo)
        prs = sorted(
            pr["number"] for pr in collection["open"] if stage in pr["stages"]
        ) if collection else []
        unmet = sorted(dep for dep in node["depends_on"] if results[dep]["status"] != "work_receipt_recorded")
        if freshness != "fresh":
            status = "refresh_snapshot"
        elif observation is None:
            status = "inspect_issue"
        elif node["kind"] == "human":
            status = "human_packet_not_ready" if unmet else "human_review_required"
        elif node["kind"] == "external":
            status = "blocked_external_check" if unmet else "external_check_required"
        elif stage in receipts and receipts[stage]["issue_updated_at"] != observation["updated_at"]:
            status = "inspect_stale_receipt"
        elif stage in receipts and unmet:
            status = "receipt_dependency_conflict"
        elif stage in receipts:
            status = "work_receipt_recorded"
        elif unmet:
            status = "blocked_dependencies"
        elif len(prs) > 1:
            status = "reconcile_open_prs"
        elif prs:
            status = "resume_open_pr"
        elif collection and any(not pr["stages"] for pr in collection["open"]):
            status = "inspect_unmapped_prs"
        elif observation["state"] == "closed":
            status = "inspect_completion_evidence"
        elif collection is None or collection["coverage"] != "complete":
            status = "inspect_pr_coverage"
        else:
            status = "ready_to_prepare"
        roots: set[str] = set()
        if status != "work_receipt_recorded":
            if freshness != "fresh" or observation is None or not unmet:
                roots.add(stage)
            else:
                for dep in unmet:
                    roots.update(results[dep]["root_blockers"])
        results[stage] = {
            "stage": stage, "issue": node["issue"], "kind": node["kind"],
            "status": status, "unmet_dependencies": unmet,
            "root_blockers": sorted(roots),
            "open_prs": [f"https://github.com/{repo}/pull/{number}" for number in prs],
        }
    rows = [results[key] for key in sorted(results)]
    return {
        "schema_version": 1, "scope": plan["scope"],
        "notice": "Planning only: observations and receipts are not authenticated, authorizations, or executable actions.",
        "plan_sha256": digest(plan), "snapshot_sha256": digest(snapshot),
        "observed_at": snapshot["observed_at"],
        "evaluated_at": now.astimezone(timezone.utc).isoformat(), "freshness": freshness,
        "counts": dict(sorted(Counter(row["status"] for row in rows).items())),
        "stages": rows,
    }


def markdown(result: dict[str, Any]) -> str:
    lines = ["# Active-work triage", "", result["notice"], "",
             f"Observed: {result['observed_at']}. Freshness: {result['freshness']}.",
             "Partial active-work graph, not the complete book or infrastructure backlog.", "",
             "| Stage | Status | Owning issue | Immediate unmet stages |",
             "|---|---|---|---|"]
    for row in result["stages"]:
        unmet = ", ".join(row["unmet_dependencies"]) or "None"
        lines.append(f"| {row['stage']} | {row['status']} | {row['issue']} | {unmet} |")
    lines.extend(["", "Re-fetch live issues, comments, PRs, checks and human instructions before acting.", ""])
    return "\n".join(lines)


class SafeParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        self.exit(2, "INVALID_ARGUMENTS\n")


def main() -> int:
    parser = SafeParser(description=__doc__)
    parser.add_argument("--plan", type=Path, default=ROOT / "planning/triage-plan.json")
    parser.add_argument("--snapshot", type=Path, default=ROOT / "planning/triage-snapshot.json")
    parser.add_argument("--as-of", help="Explicit replay time; omit for current UTC. Replay is not a live check.")
    parser.add_argument("--max-age-seconds", type=int, default=86400)
    parser.add_argument("--format", choices=("json", "markdown"), default="json")
    args = parser.parse_args()
    try:
        now = instant(args.as_of) if args.as_of else datetime.now(timezone.utc)
        result = report(load_json(args.plan), load_json(args.snapshot), now=now, max_age_seconds=args.max_age_seconds)
    except InvalidInput as exc:
        print(str(exc), file=sys.stderr)
        return 2
    except (OSError, ValueError, UnicodeError, RecursionError, OverflowError):
        print("INVALID_INPUT", file=sys.stderr)
        return 2
    print(markdown(result) if args.format == "markdown" else json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["freshness"] == "fresh" else 3


if __name__ == "__main__":
    raise SystemExit(main())
