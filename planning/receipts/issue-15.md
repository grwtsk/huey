# Issue #15: implementation verification

This is an agent-produced pre-merge work receipt, not a human decision or edition approval. Final PR/merge/issue state is recorded in the GitHub conversation.

## Scope

AGENTS instructions, authority documentation, human/work issue templates, PR template, a concrete-decision JSON Schema, read-only consistency checks and synthetic tests. No manuscript, literary anchor, medical record, private correspondence, or actual private decision payload is included. The author instruction is the direct conversation message mirrored in issue #1 comment 5746181851.

The empty repository required one minimal README base commit: `0e0be495d594e47655d7e98fdd13ff0cd6ea60e1`. Substantive implementation goes through one PR. No later direct-to-main implementation is authorized by that initialization exception.

## Verification

`python3 -m unittest discover -s tests -v`: 39 tests passed on Python 3.13.5 with the check dependencies pinned in `requirements-checks.txt`. Tests use synthetic non-sensitive records, not human approvals. Schema meta-validation runs on import. The CLI is read-only, rejects malformed/duplicate-key inputs and reports fixed codes without echoing field contents.

The tests exercise missing human evidence, declared agent origin despite the owner username, stale sessions, missing/revoked decisions, altered records, wrong source/action/gate/destination, changed input/output versions, expiration, free-text-limit review and a source gate's inability to authorize edition release. Passing these consistency tests does not authenticate a person or provide source/publication consent.

No CI, auto-merge or release workflow is installed by this issue. Local test results must be bound to the uploaded content by comparing Git blob hashes; record that comparison and the actual inspected head in the PR receipt. Do not represent an unexecuted GitHub Actions run as passed.

## Acceptance mapping

All #15 deliverables are represented by the files above. Templates distinguish proposals, actual human instructions, implementation and verification. The schema records the actor, scope, versions, actions, destinations, limits, dates and revocation. Deferred/rejected/proposed/revoked states cannot authorize actions. The protocol permits the author's newly requested checked work merges but never bypasses required repository rules. Written-first, one-question-at-a-time handling has no imposed response timeout or unsolicited reminders.

## Boundary and handoff

Issue #2 remains undecided. Issue #16 source-byte import is blocked by #2; neutral catalog metadata can still be prepared. The source inventory and manuscript/build scaffold remain #16 and #17, not completed by this change. The full dependency graph and release enforcement remain #70 and #64. No human gate is closed by #15 completion.

The consistency evaluator trusts only live observations supplied by an executor that has rechecked the original human evidence. It cannot authenticate forged trusted inputs or settle semantic questions. These are workflow controls, not formal security certification.
