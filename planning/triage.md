# Read-only active-work triage

Implemented slice: [#81](https://github.com/grwtsk/huey/issues/81), within the still-open execution workflow [#70](https://github.com/grwtsk/huey/issues/70).

This command validates a stage graph and reports its readiness frontier. It does not fetch GitHub, interpret private sources, authenticate decisions, run work, change issues, merge a PR, or publish anything. The existing authority checker and human gates remain separate. A fresh-looking input is still an observation that the executor must verify.

## Run and replay

From the repository root, using Python 3.13:

```sh
python3 scripts/triage.py --format markdown
python3 scripts/triage.py --format json
python3 -m unittest discover -s tests -v
```

The default is current UTC with a maximum snapshot age of 24 hours. A stale or future snapshot returns exit code 3 and no ready-stage classification. Invalid input returns 2 with a fixed reason code; a valid fresh report returns 0, which is not permission to act. `--max-age-seconds` can narrow the planning window, with a maximum of seven days. This is not a revocation freshness policy for an operating service.

A historical replay is explicit:

```sh
python3 scripts/triage.py --as-of 2026-09-20T02:27:13Z --format markdown
```

Replay checks the saved observation at that time; it does not make it current or query remote systems. Output goes to stdout only. Save it deliberately when needed; no files or accounts are modified by the command.

## What the checked-in snapshot covers

`triage-plan.json` is a partial graph of 25 stages across 17 owning issues, not a replacement for the full book backlog or facility plans. It narrows the current next-work frontier from the live issues already filed. The original issue bodies, accepted interface contracts, source rules and human decisions remain controlling. Unmapped work is untriaged, not complete.

`triage-snapshot.json` is a source-free projection assembled during this work session. The issue states and `updated_at` values came from connected GitHub reads. The three open-PR collections for `grwtsk/huey`, `grwtsk/neurology` and `grwtsk/noeaaeue-kernel` were each empty at inspection. Those reads were not an atomic transaction. The snapshot precedes this response's new PR; it is not a claim that the collections remain empty afterward.

The snapshot contains no private issue body, source title, testimony, credential, account identifier or grant. All 17 observed issues were open. No stage-completion receipts were imported, so none of the planned facility or backup features is represented as completed.

The plan's small preparation stages are deliberate. Drafting a storage contract, writing synthetic tests or preparing a risk inventory does not require a production account or admitted patient evidence. A `.prepare` receipt is not a runtime verification. Integrated execution remains behind an `external` check whose owning issue supplies the full interface, native-admission, security, recovery and operational requirements. The local intake path does not wait for peer distribution, iCloud, review or attention routing.

## Classification and blocker handling

The command reports immediate dependencies and a root-blocker frontier. A root may be work that can be prepared now; it is not necessarily a question for the author.

| Status | Meaning |
|---|---|
| `ready_to_prepare` | Observed open work with no unmet stages or unresolved PR-list coverage; inspect its actual scope before starting. |
| `resume_open_pr` | A currently observed open PR is mapped to this stage; do not create a duplicate. |
| `reconcile_open_prs` | Multiple PRs map to the stage; inspect and reconcile rather than choosing silently. |
| `inspect_unmapped_prs` | An open PR has not been scoped; it may overlap this work. |
| `inspect_issue` / `inspect_pr_coverage` | Required observations are missing or incomplete. |
| `inspect_completion_evidence` | The issue is closed, but no separate work-completion receipt was recorded. |
| `work_receipt_recorded` | A caller-recorded, stage-specific evidence reference is present; the tool does not verify its truth. |
| `inspect_stale_receipt` / `receipt_dependency_conflict` | The receipt was checked against another issue revision or would bypass an unmet dependency. |
| `human_packet_not_ready` | Preparation is incomplete; do not ask the author to approve a nonexistent packet. |
| `human_review_required` | The graph's packet dependencies are satisfied or none are needed; inspect the original human issue, not a generated answer. |
| `blocked_external_check` / `external_check_required` | Integration, qualified review or activation evidence remains outside this CLI. |
| `blocked_dependencies` / `refresh_snapshot` | Work depends on unresolved stages, or the observation is not current enough for this report. |

The initial report identifies ten source-free preparation stages, four human packets not yet ready, one existing human-review issue, three dependency-blocked work stages and seven external checks blocked by earlier work. These counts are properties of the saved snapshot, not progress or compliance scores.

The remaining lifecycle decision is [kernel #135](https://github.com/grwtsk/noeaaeue-kernel/issues/135). Actual owner enrollment [neurology #93](https://github.com/grwtsk/neurology/issues/93), Google binding [#103](https://github.com/grwtsk/neurology/issues/103), attention recipients [#110](https://github.com/grwtsk/neurology/issues/110) and remaining source scope [Huey #2](https://github.com/grwtsk/huey/issues/2) retain their own preparation and action boundaries. No new human issue is necessary for this triage code.

## Refresh protocol

1. Fetch live issue bodies/comments and complete PR listings for the affected repositories. Preserve the distinction between an issue and a PR sharing the repository's numeric sequence. Inspect existing PR diffs, reviews, checks and current head before proposing another PR or a merge.
2. Project only canonical issue references, states, update times and source-free PR metadata into a new snapshot. A PR with an empty `stages` list is unclassified, not harmless. Partial PR coverage blocks a no-open-PR inference. Missing issue observations remain missing.
3. Recompute `plan_sha256` using `scripts.triage.digest` only after reviewing an intentional plan revision. A digest binds structure, not authorship. Do not relabel a human/external stage as work or remove its dependencies to manufacture readiness.
4. Record a `work_receipt` only after independently inspecting the specific artifact, tests and evidence. Bind its stage, exact artifact commit, same-repository evidence URL and the issue's update time checked at that review. A merged PR or closed issue does not automatically supply this record. A changed issue requires reinspection even when the change is merely a comment.
5. Read the report and perform the original authority/source checks before any action. Mark stage-specific blockers on the owning issues, with fully qualified cross-repository URLs and reciprocal links. Those textual links are not native GitHub dependency objects.

This first version deliberately refuses completion records for `human` and `external` stages. Their actual satisfaction needs the separately reviewed live decision/integration process; it cannot be encoded by an `approved: true` flag in this public snapshot. Full-book coverage and an authenticated bridge to those processes remain #70 work. This conservative limitation does not block independent source-free preparation.

## Validation and limits

The implementation rejects duplicate JSON keys, nonfinite values, unknown fields, ambiguous references, duplicate/unknown stage IDs, dependency cycles, stale plan hashes, cross-repository PR/receipt mismatches, and invalid clocks. Files are bounded to one megabyte, graphs to 256 stages and 2,048 edges. Errors do not echo submitted payloads or malformed CLI arguments.

The synthetic tests exercise these checks, PR reuse, partial observations, stale/future snapshots, human closure, contradictory receipts and read-only behavior. Existing authority/catalog regression tests remain unchanged. Passing the suite does not establish HIPAA compliance, source authenticity, a working cloud backup, local passkeys, a deployed kernel or any human's consent. No network client, polling loop, notification, credential, model or release path was added.
