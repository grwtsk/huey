"""Synthetic observations only; no fixture is a human decision or a live grant."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from scripts.triage import InvalidInput, ROOT, digest, load_json, markdown, report, validate_plan

NOW = datetime(2026, 9, 20, 3, tzinfo=timezone.utc)
N = "https://github.com/grwtsk/neurology/issues/"
H = "https://github.com/grwtsk/huey/issues/"


def fixture():
    plan = {"schema_version": 1, "scope": "partial_active_work_not_full_backlog", "stages": [
        {"id": "build.prepare", "issue": H + "17", "kind": "work", "depends_on": []},
        {"id": "backup.prepare", "issue": N + "104", "kind": "work", "depends_on": []},
        {"id": "backup.test", "issue": N + "104", "kind": "work", "depends_on": ["backup.prepare"]},
        {"id": "backup.account", "issue": N + "103", "kind": "human", "depends_on": ["backup.test"]},
        {"id": "backup.live", "issue": N + "104", "kind": "external", "depends_on": ["backup.account"]},
    ]}
    snapshot = {"schema_version": 1, "plan_sha256": digest(plan), "observed_at": "2026-09-20T02:00:00Z",
        "issues": [{"ref": ref, "state": "open", "updated_at": "2026-09-20T01:00:00Z"} for ref in sorted({x["issue"] for x in plan["stages"]})],
        "pr_collections": [{"repository": repo, "coverage": "complete", "open": []} for repo in ("grwtsk/huey", "grwtsk/neurology", "grwtsk/noeaaeue-kernel")],
        "work_receipts": []}
    return plan, snapshot


class TriageTests(unittest.TestCase):
    def setUp(self):
        self.plan, self.snapshot = fixture()

    def evaluate(self, **kwargs):
        return report(self.plan, self.snapshot, now=kwargs.pop("now", NOW), **kwargs)

    def stages(self, **kwargs):
        return {r["stage"]: r for r in self.evaluate(**kwargs)["stages"]}

    def rebind(self):
        self.snapshot["plan_sha256"] = digest(self.plan)

    def receipt(self, stage="backup.prepare"):
        self.snapshot["work_receipts"].append({"stage": stage, "artifact_commit": "a" * 40,
            "evidence_ref": "https://github.com/grwtsk/neurology/pull/999", "issue_updated_at": "2026-09-20T01:00:00Z"})

    def rejects(self, code):
        with self.assertRaisesRegex(InvalidInput, "^" + code + "$"):
            self.evaluate()

    def test_preparation_does_not_wait_for_later_human_action(self):
        rows = self.stages()
        self.assertEqual(rows["backup.prepare"]["status"], "ready_to_prepare")
        self.assertEqual(rows["backup.account"]["status"], "human_packet_not_ready")
        self.assertEqual(rows["build.prepare"]["status"], "ready_to_prepare")

    def test_root_blockers_expand_transitively(self):
        self.assertEqual(self.stages()["backup.live"]["root_blockers"], ["backup.prepare"])
        self.assertEqual(self.stages()["backup.live"]["unmet_dependencies"], ["backup.account"])

    def test_a_work_receipt_unblocks_only_its_stage(self):
        self.receipt()
        rows = self.stages()
        self.assertEqual(rows["backup.prepare"]["status"], "work_receipt_recorded")
        self.assertEqual(rows["backup.test"]["status"], "ready_to_prepare")
        self.assertEqual(rows["backup.account"]["status"], "human_packet_not_ready")

    def test_completed_packet_exposes_human_question_not_permission(self):
        self.receipt(); self.receipt("backup.test")
        rows = self.stages()
        self.assertEqual(rows["backup.account"]["status"], "human_review_required")
        self.assertEqual(rows["backup.live"]["status"], "blocked_external_check")

    def test_issue_closure_is_not_work_completion(self):
        next(x for x in self.snapshot["issues"] if x["ref"] == N + "104")["state"] = "closed"
        rows = self.stages()
        self.assertEqual(rows["backup.prepare"]["status"], "inspect_completion_evidence")
        self.assertEqual(rows["backup.test"]["status"], "blocked_dependencies")

    def test_human_closure_is_not_acceptance(self):
        self.receipt(); self.receipt("backup.test")
        next(x for x in self.snapshot["issues"] if x["ref"] == N + "103")["state"] = "closed"
        self.assertEqual(self.stages()["backup.account"]["status"], "human_review_required")

    def test_human_and_external_receipts_are_not_consumed(self):
        for stage in ("backup.account", "backup.live"):
            with self.subTest(stage=stage):
                self.snapshot["work_receipts"] = []
                self.receipt(stage)
                self.rejects("NONWORK_RECEIPT_NOT_SUPPORTED")

    def test_a_receipt_cannot_skip_dependencies(self):
        self.receipt("backup.test")
        self.assertEqual(self.stages()["backup.test"]["status"], "receipt_dependency_conflict")

    def test_existing_pr_is_resumed_not_duplicated(self):
        self.snapshot["pr_collections"][1]["open"] = [{"number": 999, "head_sha": "a"*40, "stages": ["backup.prepare"]}]
        row = self.stages()["backup.prepare"]
        self.assertEqual(row["status"], "resume_open_pr")
        self.assertEqual(row["open_prs"], ["https://github.com/grwtsk/neurology/pull/999"])
        self.assertEqual(self.stages()["backup.test"]["status"], "blocked_dependencies")

    def test_multiple_matching_prs_require_reconciliation(self):
        self.snapshot["pr_collections"][1]["open"] = [{"number": x, "head_sha": "a"*40, "stages": ["backup.prepare"]} for x in (998, 999)]
        self.assertEqual(self.stages()["backup.prepare"]["status"], "reconcile_open_prs")

    def test_unmapped_open_pr_blocks_duplicate_creation(self):
        self.snapshot["pr_collections"][1]["open"] = [{"number": 999, "head_sha": "a"*40, "stages": []}]
        self.assertEqual(self.stages()["backup.prepare"]["status"], "inspect_unmapped_prs")

    def test_changed_issue_requires_rechecking_work_receipt(self):
        self.receipt()
        next(x for x in self.snapshot["issues"] if x["ref"] == N+"104")["updated_at"] = "2026-09-20T01:30:00Z"
        self.assertEqual(self.stages()["backup.prepare"]["status"], "inspect_stale_receipt")

    def test_exact_commit_receipt_must_match_artifact(self):
        self.receipt()
        self.snapshot["work_receipts"][0]["evidence_ref"] = "https://github.com/grwtsk/neurology/commit/" + "b"*40
        self.rejects("RECEIPT_COMMIT_MISMATCH")

    def test_partial_pr_coverage_does_not_claim_no_open_pr(self):
        self.snapshot["pr_collections"][1]["coverage"] = "partial"
        self.assertEqual(self.stages()["backup.prepare"]["status"], "inspect_pr_coverage")

    def test_missing_pr_coverage_is_explicit(self):
        self.snapshot["pr_collections"].pop(1)
        self.assertEqual(self.stages()["backup.prepare"]["status"], "inspect_pr_coverage")

    def test_missing_issue_is_not_ready_or_complete(self):
        self.receipt()
        self.snapshot["issues"] = [x for x in self.snapshot["issues"] if x["ref"] != N + "104"]
        self.assertEqual(self.stages()["backup.prepare"]["status"], "inspect_issue")

    def test_stale_snapshot_blocks_every_readiness_claim(self):
        result = self.evaluate(now=NOW + timedelta(days=2))
        self.assertEqual(result["freshness"], "stale")
        self.assertTrue(all(row["status"] == "refresh_snapshot" for row in result["stages"]))

    def test_future_snapshot_is_not_current(self):
        self.assertEqual(self.evaluate(now=NOW-timedelta(days=1))["freshness"], "future")

    def test_freshness_boundary(self):
        base = datetime(2026, 9, 20, 2, tzinfo=timezone.utc)
        self.assertEqual(self.evaluate(now=base+timedelta(seconds=86400))["freshness"], "fresh")
        self.assertEqual(self.evaluate(now=base+timedelta(seconds=86401))["freshness"], "stale")

    def test_invalid_clock_and_age(self):
        with self.assertRaisesRegex(InvalidInput, "INVALID_CLOCK"):
            self.evaluate(now=datetime(2026, 9, 20))
        for age in (True, 0, -1, 604801, "60"):
            with self.subTest(age=age), self.assertRaisesRegex(InvalidInput, "INVALID_MAX_AGE"):
                self.evaluate(max_age_seconds=age)

    def test_changed_plan_invalidates_snapshot(self):
        self.plan["stages"][0]["id"] = "build.changed"
        self.rejects("SNAPSHOT_PLAN_MISMATCH")

    def test_duplicate_and_unknown_dependencies(self):
        for deps, reason in [(["missing"], "UNKNOWN_DEPENDENCY"), (["backup.prepare"]*2, "DUPLICATE_DEPENDENCY")]:
            with self.subTest(deps=deps):
                self.plan, self.snapshot = fixture()
                self.plan["stages"][2]["depends_on"] = deps; self.rebind()
                self.rejects(reason)

    def test_cycle_and_self_cycle(self):
        for deps in (["backup.test"], ["backup.prepare"]):
            with self.subTest(deps=deps):
                self.plan, self.snapshot = fixture()
                self.plan["stages"][1]["depends_on"] = deps; self.rebind()
                self.rejects("DEPENDENCY_CYCLE")

    def test_duplicate_nodes_and_empty_plan(self):
        self.plan["stages"].append(deepcopy(self.plan["stages"][0])); self.rebind()
        self.rejects("DUPLICATE_STAGE_ID")
        self.plan["stages"] = []; self.rebind(); self.rejects("EMPTY_PLAN")

    def test_noncanonical_and_secret_issue_links_rejected(self):
        for ref in ("#104", "neurology#104", N+"104?token=secret", N+"104#issuecomment-1", "https://github.com/other/repo/issues/1", N+"01"):
            with self.subTest(ref=ref):
                self.plan, self.snapshot = fixture()
                self.plan["stages"][0]["issue"] = ref; self.rebind()
                self.rejects("NONCANONICAL_ISSUE")

    def test_raw_payload_fields_rejected(self):
        for field in ("body", "title", "source", "token", "grant"):
            with self.subTest(field=field):
                self.plan, self.snapshot = fixture()
                self.snapshot[field] = "PRIVATE_SENTINEL"
                self.rejects("INVALID_SNAPSHOT")

    def test_unknown_stage_kind_and_boolean_schema_version(self):
        self.plan["stages"][0]["kind"] = "approved"; self.rebind()
        self.rejects("INVALID_STAGE_KIND")
        self.plan, self.snapshot = fixture(); self.plan["schema_version"] = True; self.rebind()
        self.rejects("INVALID_PLAN_VERSION")
        self.plan, self.snapshot = fixture(); self.snapshot["schema_version"] = True
        self.rejects("INVALID_SNAPSHOT_VERSION")

    def test_invalid_timestamp_and_observation_order(self):
        self.snapshot["observed_at"] = "2026-09-20"
        self.rejects("INVALID_TIMESTAMP")
        self.plan, self.snapshot = fixture()
        self.snapshot["issues"][0]["updated_at"] = "2026-09-21T00:00:00Z"
        self.rejects("ISSUE_NEWER_THAN_SNAPSHOT")

    def test_duplicate_observation_and_receipt(self):
        self.snapshot["issues"].append(deepcopy(self.snapshot["issues"][0]))
        self.rejects("DUPLICATE_ISSUE_OBSERVATION")
        self.plan, self.snapshot = fixture(); self.receipt(); self.receipt()
        self.rejects("DUPLICATE_WORK_RECEIPT")

    def test_forged_completion_and_wrong_repository_receipt(self):
        self.receipt(); self.snapshot["work_receipts"][0]["approved_by_owner"] = True
        self.rejects("INVALID_WORK_RECEIPT")
        self.snapshot["work_receipts"][0].pop("approved_by_owner")
        self.snapshot["work_receipts"][0]["evidence_ref"] = "https://github.com/grwtsk/huey/pull/999"
        self.rejects("WRONG_REPOSITORY_RECEIPT")

    def test_cross_repository_pr_does_not_attach_to_stage(self):
        self.snapshot["pr_collections"][0]["open"] = [{"number": 999, "head_sha": "a"*40, "stages": ["backup.prepare"]}]
        self.rejects("WRONG_REPOSITORY_PR")

    def test_unknown_and_duplicate_pr_stage(self):
        for stages, reason in [(["missing"], "UNKNOWN_PR_STAGE"), (["backup.prepare"]*2, "DUPLICATE_PR_STAGE")]:
            with self.subTest(stages=stages):
                self.snapshot["pr_collections"][1]["open"] = [{"number": 999, "head_sha": "a"*40, "stages": stages}]
                self.rejects(reason)

    def test_malformed_primitive_values(self):
        for key, value in [("number", True), ("head_sha", "main")]:
            with self.subTest(key=key):
                self.plan, self.snapshot = fixture()
                pr = {"number": 999, "head_sha": "a"*40, "stages": []}; pr[key] = value
                self.snapshot["pr_collections"][1]["open"] = [pr]
                with self.assertRaises(InvalidInput): self.evaluate()

    def test_dependency_graph_bound(self):
        self.plan["stages"] *= 60; self.rebind()
        self.rejects("INVALID_STAGES")

    def test_plan_order_does_not_change_classification(self):
        expected = self.evaluate()["stages"]
        self.plan["stages"].reverse(); self.rebind()
        self.assertEqual(expected, self.evaluate()["stages"])

    def test_input_is_unchanged_and_output_deterministic(self):
        before = deepcopy((self.plan, self.snapshot))
        self.assertEqual(self.evaluate(), self.evaluate())
        self.assertEqual(before, (self.plan, self.snapshot))
        self.assertIn("Planning only", markdown(self.evaluate()))

    def test_no_network_operation(self):
        with patch("socket.socket", side_effect=AssertionError("network forbidden")):
            self.evaluate()

    def test_loader_rejects_duplicates_nonfinite_oversize_and_bad_utf8(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/"input.json"
            for raw in (b'{"a":1,"a":2}', b'{"a":NaN}', b'x'*1_000_001, b'\xff'):
                with self.subTest(size=len(raw)):
                    path.write_bytes(raw)
                    with self.assertRaises((ValueError, UnicodeError)): load_json(path)

    def test_cli_is_read_only_and_supports_explicit_replay(self):
        with tempfile.TemporaryDirectory() as directory:
            p, s = Path(directory)/"plan.json", Path(directory)/"snapshot.json"
            p.write_text(json.dumps(self.plan)); s.write_text(json.dumps(self.snapshot))
            before = (p.read_bytes(), s.read_bytes())
            cmd = [sys.executable, str(ROOT/"scripts/triage.py"), "--plan", str(p), "--snapshot", str(s)]
            good = subprocess.run(cmd+["--as-of", "2026-09-20T03:00:00Z"], capture_output=True, text=True)
            self.assertEqual(good.returncode, 0, good.stderr)
            self.assertEqual(json.loads(good.stdout)["freshness"], "fresh")
            stale = subprocess.run(cmd+["--as-of", "2026-09-22T03:00:00Z"], capture_output=True, text=True)
            self.assertEqual(stale.returncode, 3)
            s.write_text('{"private":"PRIVATE_SENTINEL"}')
            bad = subprocess.run(cmd, capture_output=True, text=True)
            self.assertEqual(bad.returncode, 2)
            self.assertNotIn("PRIVATE_SENTINEL", bad.stdout+bad.stderr)
            self.assertEqual(p.read_bytes(), before[0])
            self.assertEqual(s.read_text(), '{"private":"PRIVATE_SENTINEL"}')

    def test_cli_invalid_argument_does_not_echo_private_values(self):
        result = subprocess.run([sys.executable, str(ROOT/"scripts/triage.py"), "--max-age-seconds", "PRIVATE_SENTINEL"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stderr.strip(), "INVALID_ARGUMENTS")
        self.assertNotIn("PRIVATE_SENTINEL", result.stdout+result.stderr)

    def test_cli_missing_input_does_not_print_a_traceback(self):
        result = subprocess.run([sys.executable, str(ROOT/"scripts/triage.py"), "--plan", "/missing/plan.json"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stderr.strip(), "INVALID_INPUT")

    def test_repository_active_plan_is_partial_and_consistent(self):
        p = load_json(ROOT/"planning/triage-plan.json")
        s = load_json(ROOT/"planning/triage-snapshot.json")
        result = report(p, s, now=datetime.fromisoformat(s["observed_at"].replace("Z", "+00:00")))
        self.assertEqual(result["scope"], "partial_active_work_not_full_backlog")
        self.assertEqual(result["freshness"], "fresh")
        self.assertEqual(set(c["repository"] for c in s["pr_collections"]), {"grwtsk/huey", "grwtsk/neurology", "grwtsk/noeaaeue-kernel"})
        self.assertTrue(all(r["status"] != "work_receipt_recorded" for r in result["stages"] if r["kind"] != "work"))


if __name__ == "__main__":
    unittest.main()
