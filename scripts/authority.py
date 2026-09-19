"""Read-only checks. Caller-established live provenance is a trust boundary."""
from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = json.loads((ROOT / "planning/decisions.schema.json").read_text(encoding="utf-8"))
Draft202012Validator.check_schema(SCHEMA)
VALIDATOR = Draft202012Validator(SCHEMA, format_checker=FormatChecker())
SHA = re.compile(r"[0-9a-f]{64}")


def digest(value: Any) -> str:
    """Bind JSON values using a documented local convention, not a signature."""
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def text_digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timezone required")
    return parsed.astimezone(timezone.utc)


def validate_record(record: Any) -> tuple[str, ...]:
    """Fixed reason codes: never echo instruction text or schema error values."""
    if not VALIDATOR.is_valid(record):
        return ("INVALID_RECORD",)
    instruction = record["instruction"]
    if instruction and text_digest(instruction["text"]) != instruction["sha256"]:
        return ("INSTRUCTION_DIGEST_MISMATCH",)
    try:
        issued = timestamp(record["issued_at"]) if record["issued_at"] else None
        expires = timestamp(record["expires_at"]) if record["expires_at"] else None
        if expires and (issued is None or expires <= issued):
            return ("INVALID_EXPIRATION",)
    except (ValueError, TypeError):
        return ("INVALID_TIMESTAMP",)
    return ()


@dataclass(frozen=True)
class Request:
    gate_issue: int
    action: str
    input_revision: str
    output_sha256: str
    destination: str
    session_id: str


@dataclass(frozen=True)
class LiveObservation:
    # Supplied from original human evidence in the current session, NEVER from a PR fixture.
    record_sha256: str
    instruction_sha256: str
    source_ref: str
    author_github: str
    actor_kind: str
    decision_state: str
    session_id: str
    revocation_checked: bool
    reviewed_request_sha256: str


def evaluate(record: Any, request: Request, live: LiveObservation | None, *, now: datetime) -> tuple[str, ...]:
    """Empty tuple means consistent with trusted inputs, NOT authenticated or executed."""
    errors = validate_record(record)
    if errors:
        return errors
    if not isinstance(request, Request):
        return ("INVALID_REQUEST",)
    values = (request.action, request.input_revision, request.output_sha256, request.destination, request.session_id)
    if (any(not isinstance(value, str) or not value for value in values) or
            type(request.gate_issue) is not int or request.gate_issue < 1 or
            not SHA.fullmatch(request.output_sha256)):
        return ("INVALID_REQUEST",)
    if not isinstance(now, datetime) or now.tzinfo is None:
        return ("INVALID_CLOCK",)
    if record["state"] != "accepted" or record["revocation_status"] != "active":
        return ("NOT_ACCEPTED",)
    if live is None:
        return ("LIVE_HUMAN_EVIDENCE_REQUIRED",)
    if not isinstance(live, LiveObservation):
        return ("INVALID_LIVE_OBSERVATION",)
    if live.actor_kind != "human" or live.author_github != "grwtsk":
        return ("HUMAN_ORIGIN_NOT_ESTABLISHED",)
    if live.session_id != request.session_id or live.revocation_checked is not True:
        return ("FRESH_REVOCATION_REVIEW_REQUIRED",)
    if live.decision_state != "accepted":
        return ("LIVE_DECISION_NOT_ACCEPTED",)
    instruction, scope = record["instruction"], record["scope"]
    if (live.record_sha256 != digest(record) or live.instruction_sha256 != instruction["sha256"] or live.source_ref != instruction["source_ref"]):
        return ("LIVE_EVIDENCE_MISMATCH",)
    if timestamp(record["issued_at"]) > now:
        return ("NOT_YET_EFFECTIVE",)
    if record["expires_at"] and now >= timestamp(record["expires_at"]):
        return ("EXPIRED",)
    if request.gate_issue != record["issue_number"]:
        return ("WRONG_GATE",)
    if request.action == "release_edition" and request.gate_issue != 14:
        return ("RELEASE_GATE_REQUIRED",)
    if request.action not in scope["actions"]:
        return ("ACTION_NOT_GRANTED",)
    if request.input_revision != scope["input_revision"] or request.output_sha256 != scope["output_sha256"]:
        return ("STALE_ARTIFACT",)
    if request.destination not in scope["destinations"]:
        return ("DESTINATION_NOT_GRANTED",)
    if live.reviewed_request_sha256 != digest(asdict(request)):
        return ("EXACT_REQUEST_AND_LIMIT_REVIEW_REQUIRED",)
    return ()


def reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate key")
        result[key] = value
    return result


def reject_constant(_: str) -> None:
    raise ValueError("nonfinite JSON number")


def load_record(path: Path) -> Any:
    if path.stat().st_size > 1_000_000:
        raise ValueError("record too large")
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicate_keys, parse_constant=reject_constant)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a decision's structure; this never authorizes an action.")
    parser.add_argument("record", type=Path)
    args = parser.parse_args()
    try:
        errors = validate_record(load_record(args.record))
    except (OSError, UnicodeError, ValueError, RecursionError):
        print("INVALID_INPUT")
        return 2
    if errors:
        print(" ".join(errors))
        return 1
    print("VALID_RECORD_NOT_AUTHORIZATION")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
