"""Synthetic tests only; fixtures are not author decisions."""
from copy import deepcopy
from dataclasses import asdict, replace
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from scripts.authority import LiveObservation, Request, digest, evaluate, load_record, text_digest, validate_record

NOW = datetime(2026, 9, 19, 12, tzinfo=timezone.utc)
ROOT = Path(__file__).resolve().parents[1]


class AuthorityTests(unittest.TestCase):
    def setUp(self):
        self.record = {
            "schema_version": 1, "decision_id": "HUEY-D999", "issue_number": 2,
            "state": "accepted", "author": {"name": "R.A. Jacob Martone", "github": "grwtsk"},
            "recorded_by": "agent", "instruction": {
                "source_kind": "conversation", "source_ref": "synthetic:test-only",
                "text": "Synthetic permission for a non-sensitive fixture.",
                "sha256": text_digest("Synthetic permission for a non-sensitive fixture.")},
            "scope": {"actions": ["store_source"], "input_revision": "synthetic-v1",
                "output_sha256": "a" * 64, "destinations": ["synthetic:private"],
                "limits": ["Synthetic fixture only."]},
            "issued_at": "2026-09-19T10:00:00Z", "expires_at": None, "revocation_status": "active"}
        self.request = Request(2, "store_source", "synthetic-v1", "a" * 64, "synthetic:private", "test-session")

    def live(self, record=None, request=None, **changes):
        record = record if record is not None else self.record
        request = request if request is not None else self.request
        base = LiveObservation(digest(record), record["instruction"]["sha256"],
            record["instruction"]["source_ref"], "grwtsk", "human", "accepted",
            request.session_id, True, digest(asdict(request)))
        return replace(base, **changes)

    def check(self, record=None, request=None, live=None):
        return evaluate(record if record is not None else self.record,
            request if request is not None else self.request,
            live if live is not None else self.live(), now=NOW)

    def test_valid_fixture_is_consistent_not_authenticated(self):
        self.assertEqual(self.check(), ())

    def test_schema_accepts_pending_without_fake_permission(self):
        record = deepcopy(self.record)
        for state in ("proposed", "deferred", "rejected", "revoked"):
            record.update(state=state, instruction=None, scope=None, issued_at=None, expires_at=None, revocation_status="unknown")
            self.assertEqual(validate_record(record), ())
            self.assertEqual(self.check(record=record), ("NOT_ACCEPTED",))

    def test_accepted_requires_payload(self):
        for key in ("instruction", "scope", "issued_at"):
            with self.subTest(key=key):
                record = deepcopy(self.record); record[key] = None
                self.assertEqual(validate_record(record), ("INVALID_RECORD",))

    def test_closed_issue_is_not_permission(self):
        self.assertEqual(validate_record({"state": "closed", "author": "grwtsk"}), ("INVALID_RECORD",))

    def test_unknown_fields_rejected(self):
        record = deepcopy(self.record); record["approved_by_ai"] = True
        self.assertEqual(validate_record(record), ("INVALID_RECORD",))

    def test_human_username_without_live_evidence_is_insufficient(self):
        self.assertEqual(evaluate(self.record, self.request, None, now=NOW), ("LIVE_HUMAN_EVIDENCE_REQUIRED",))

    def test_agent_origin_rejected_even_with_owner_username(self):
        self.assertEqual(self.check(live=self.live(actor_kind="agent")), ("HUMAN_ORIGIN_NOT_ESTABLISHED",))

    def test_unknown_origin_rejected(self):
        self.assertEqual(self.check(live=self.live(actor_kind="unknown")), ("HUMAN_ORIGIN_NOT_ESTABLISHED",))

    def test_other_actor_rejected(self):
        self.assertEqual(self.check(live=self.live(author_github="other")), ("HUMAN_ORIGIN_NOT_ESTABLISHED",))

    def test_prior_session_rejected(self):
        self.assertEqual(self.check(live=self.live(session_id="old")), ("FRESH_REVOCATION_REVIEW_REQUIRED",))

    def test_missing_revocation_check_rejected(self):
        self.assertEqual(self.check(live=self.live(revocation_checked=False)), ("FRESH_REVOCATION_REVIEW_REQUIRED",))

    def test_live_revocation_rejected(self):
        self.assertEqual(self.check(live=self.live(decision_state="revoked")), ("LIVE_DECISION_NOT_ACCEPTED",))

    def test_live_defer_rejected(self):
        self.assertEqual(self.check(live=self.live(decision_state="deferred")), ("LIVE_DECISION_NOT_ACCEPTED",))

    def test_changed_record_after_review_rejected(self):
        record = deepcopy(self.record); record["scope"]["destinations"].append("synthetic:public")
        self.assertEqual(self.check(record=record), ("LIVE_EVIDENCE_MISMATCH",))

    def test_changed_instruction_detected(self):
        record = deepcopy(self.record); record["instruction"]["text"] = "Forged instruction"
        self.assertEqual(validate_record(record), ("INSTRUCTION_DIGEST_MISMATCH",))

    def test_other_instruction_digest_rejected(self):
        self.assertEqual(self.check(live=self.live(instruction_sha256="b" * 64)), ("LIVE_EVIDENCE_MISMATCH",))

    def test_other_source_rejected(self):
        self.assertEqual(self.check(live=self.live(source_ref="synthetic:other")), ("LIVE_EVIDENCE_MISMATCH",))

    def test_public_disclosure_not_granted(self):
        request = replace(self.request, destination="synthetic:public")
        self.assertEqual(self.check(request=request, live=self.live(request=request)), ("DESTINATION_NOT_GRANTED",))

    def test_other_action_rejected(self):
        request = replace(self.request, action="contact_external")
        self.assertEqual(self.check(request=request, live=self.live(request=request)), ("ACTION_NOT_GRANTED",))

    def test_other_input_revision_rejected(self):
        self.assertEqual(self.check(request=replace(self.request, input_revision="synthetic-v2")), ("STALE_ARTIFACT",))

    def test_other_output_rejected(self):
        self.assertEqual(self.check(request=replace(self.request, output_sha256="b" * 64)), ("STALE_ARTIFACT",))

    def test_other_gate_rejected(self):
        self.assertEqual(self.check(request=replace(self.request, gate_issue=4)), ("WRONG_GATE",))

    def test_source_gate_cannot_release_edition(self):
        record = deepcopy(self.record); record["scope"]["actions"] = ["release_edition"]
        request = replace(self.request, action="release_edition")
        self.assertEqual(self.check(record=record, request=request, live=self.live(record, request)), ("RELEASE_GATE_REQUIRED",))

    def test_exact_request_and_limits_need_review(self):
        self.assertEqual(self.check(live=self.live(reviewed_request_sha256="c" * 64)), ("EXACT_REQUEST_AND_LIMIT_REVIEW_REQUIRED",))

    def test_no_arbitrary_boolean_as_live_evidence(self):
        self.assertNotEqual(self.check(live=self.live(actor_kind="approved")), ())

    def test_expiration_boundary(self):
        record = deepcopy(self.record); record["expires_at"] = "2026-09-19T12:00:00Z"
        self.assertEqual(self.check(record=record, live=self.live(record)), ("EXPIRED",))

    def test_future_instruction_rejected(self):
        record = deepcopy(self.record); record["issued_at"] = "2026-09-20T10:00:00Z"
        self.assertEqual(self.check(record=record, live=self.live(record)), ("NOT_YET_EFFECTIVE",))

    def test_expiration_before_issue_invalid(self):
        record = deepcopy(self.record); record["expires_at"] = "2026-09-18T12:00:00Z"
        self.assertEqual(validate_record(record), ("INVALID_EXPIRATION",))

    def test_invalid_timestamp_and_naive_clock(self):
        record = deepcopy(self.record); record["issued_at"] = "not-a-date"
        self.assertEqual(validate_record(record), ("INVALID_RECORD",))
        self.assertEqual(evaluate(self.record, self.request, self.live(), now=datetime(2026,9,19)), ("INVALID_CLOCK",))

    def test_invalid_request_rejected(self):
        for changes in ({"session_id": ""}, {"gate_issue": True}, {"output_sha256": "bad"}):
            with self.subTest(changes=changes):
                self.assertEqual(self.check(request=replace(self.request, **changes)), ("INVALID_REQUEST",))

    def test_malformed_request_fails_closed(self):
        self.assertEqual(evaluate(self.record, {}, self.live(), now=NOW), ("INVALID_REQUEST",))
        self.assertEqual(self.check(request=replace(self.request, output_sha256=None)), ("INVALID_REQUEST",))

    def test_boolean_cannot_replace_live_observation(self):
        self.assertEqual(evaluate(self.record, self.request, True, now=NOW), ("INVALID_LIVE_OBSERVATION",))

    def test_truthy_text_cannot_replace_revocation_check(self):
        self.assertEqual(self.check(live=self.live(revocation_checked="yes")), ("FRESH_REVOCATION_REVIEW_REQUIRED",))

    def test_record_revocation_flag_cannot_be_unknown(self):
        record = deepcopy(self.record); record["revocation_status"] = "unknown"
        self.assertEqual(validate_record(record), ("INVALID_RECORD",))

    def test_recorded_by_human_does_not_remove_live_check(self):
        record = deepcopy(self.record); record["recorded_by"] = "human"
        self.assertEqual(evaluate(record, self.request, None, now=NOW), ("LIVE_HUMAN_EVIDENCE_REQUIRED",))

    def test_digest_is_order_independent_and_changes_with_scope(self):
        self.assertEqual(digest({"a":1,"b":2}), digest({"b":2,"a":1}))
        self.assertNotEqual(digest({"a":1}), digest({"a":2}))

    def test_json_loader_rejects_duplicates_and_nonfinite(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/"record.json"
            for payload in ('{"a":1,"a":2}', '{"a":NaN}'):
                path.write_text(payload)
                with self.assertRaises(ValueError): load_record(path)

    def test_cli_is_read_only_and_does_not_echo_private_values(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/"record.json"
            path.write_text(json.dumps(self.record))
            original = path.read_bytes()
            result = subprocess.run([sys.executable,str(ROOT/"scripts/authority.py"),str(path)],capture_output=True,text=True)
            self.assertEqual(result.returncode,0)
            self.assertEqual(result.stdout.strip(),"VALID_RECORD_NOT_AUTHORIZATION")
            self.assertEqual(path.read_bytes(),original)
            path.write_text('{"private": "SENSITIVE_TEST_SENTINEL"}')
            result = subprocess.run([sys.executable,str(ROOT/"scripts/authority.py"),str(path)],capture_output=True,text=True)
            self.assertEqual(result.returncode,1)
            self.assertNotIn("SENSITIVE_TEST_SENTINEL",result.stdout+result.stderr)

    def test_cli_missing_file_fails_closed(self):
        result = subprocess.run([sys.executable,str(ROOT/"scripts/authority.py"),"/definitely-missing/record.json"],capture_output=True,text=True)
        self.assertEqual(result.returncode,2)
        self.assertEqual(result.stdout.strip(),"INVALID_INPUT")


if __name__ == "__main__":
    unittest.main()
