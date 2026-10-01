# Exact-source draft handoff from chat

WORKING DRAFT — CLAIM VERIFICATION INCOMPLETE.

This extends the [private workspace](chat-workspace.md) with a complete **draft
candidate** file batch. It consumes the existing #377 source-correspondence
contract and the #463 whole-assembly baseline. It neither duplicates their
implementation nor merges either PR into `pre-release` or `main`. #355/#360/#361
remain open for their broader operation/server/materialization requirements.

The host can discuss a paragraph, record an actual approved private edit, review
its exact public source payload with the author, create a source checkpoint using
its authorized GitHub connector, and obtain all reconciled files for a real draft
PR. These commands perform no network writes, canonical source writes, commits,
branch movement, PR creation, manuscript acceptance or release. The final host
steps below are intentionally explicit rather than a pretend GitHub integration.

## Reproducible existing contracts

```sh
npm run contracts:install -- /restricted-or-local/huey-contracts
HUEY_CONTRACT_ROOT=/restricted-or-local/huey-contracts npm run test:handoff
```

The install command reads exact existing Git objects, fetching from the official
Huey repository only if needed. It installs code/profile files outside the source
checkout. It pins #377 to `fd12406b4876f2e7c853d34d8607f0ff551d7be2` and the compatible
#463 assembler/profile to `0863ef3f54da4e85270d336344e9723a7a952488`; every transitive
local module/profile is SHA-256 checked before import. Existing installations are
verified, not silently replaced. CI uses the same installer and the real modules,
not a mock or a competing reconciler implementation. No manuscript is installed
in this dependency directory, and no new service or credential is created.

The source checkout itself must contain a valid complete #463-equivalent assembly
and be clean. The private workspace must use that exact checkout. Current base
failure and unmapped sources cannot be bypassed by this handoff. A code-only
integration branch may retain the exact #463 ancestor while its original PR stays
open; this does not promote it upstream or accept literary content.

## Prepare, review, checkpoint, finalize

First use the private workspace's read/propose/review/decide flow. A private
application is not permission to upload its text.

```sh
node scripts/chat_handoff.mjs prepare ROOT STORE CONTRACTS op_UUID
```

The result is a **private review template** with exact source bytes/patch, source
pin, changed IDs, complete block correspondence, snapshot effects, captured base
metadata and `reviewDigest`. It has no fabricated future revision. Retain the
review digest independently in the host's private review record.

Before the first GitHub `create_tree`, the host must obtain the author's actual
approval for this exact source/snapshot payload and specified deterministic
pin/range/snapshot effects, destination `grwtsk/huey`, and draft-PR workflow.
Hashes and host fields cannot authenticate approval. Unreferenced GitHub objects
are still public disclosure. Approval to keep a local edit is insufficient.

Use the connected GitHub tools only under that authority:

1. Fetch/read current `pre-release` and the chosen working branch. Require the
   captured `targetBaseHead` for the target and `baseHead` for the working source,
   or stop and re-prepare/re-review. The target must be an ancestor of the working
   base. A stacked source draft may include the still-pending code dependency;
   identify that explicitly instead of pretending it has merged upstream. Never
   silently rebase or overwrite.
2. Create a tree from that base containing **only** the reviewed source path with
   its exact `afterText`, regular file mode `100644`. Create a checkpoint commit
   with exactly the captured base as its parent. Do not create or move a branch.
3. Fetch that returned checkpoint commit read-only into the source checkout. The
   checkpoint must change exactly that path/blob and have exactly that parent.
4. Finalize using the independently retained review digest, not a digest freshly
   copied from a possibly modified packet:

```sh
node scripts/chat_handoff.mjs finalize ROOT STORE CONTRACTS CHECKPOINT_SHA REVIEW_DIGEST < /restricted/review-template.json
```

The CLI rechecks clean current HEAD, metadata, current private operation chain,
exact checkpoint parent/file mode/bytes, whole before/after assemblies and #377's
complete version/range correspondence. The pure adapter regenerates the complete
template from fresh inputs and compares it with the reviewed packet. Tampered or
stale inputs return no partial file batch.

5. Review/check the returned complete file batch. `expectedBaseBlob` values are
   preconditions against `preconditionRef`/`baseHead`, **not** against the later
   checkpoint parent. Missing paths must remain missing; snapshots/receipts must
   not overwrite unrelated existing files. The source checkpoint already contains
   the changed source, while every other base file remains unchanged.
6. Create the final tree from the verified checkpoint tree with exactly the batch
   files; create its commit with the checkpoint as parent. This makes the registry's
   real source revision reachable without a self-referential commit hash.
7. Recheck both captured remote heads and branch absence. Create a fresh work branch at that final
   commit, then a **draft** PR to `pre-release`. Do not force-update an existing
   ref, self-approve, merge, enable auto-merge, deploy or promote to `main`.
8. Verify returned branch/head/tree and CI on that exact head. Record honest
   prepared/checkpoint-created/final-created/branched/PR-created results privately.
   If uncertain, inspect existing objects/branch/PR before retrying.

Only publication of the new branch is atomic. Source disclosure is not rolled back
if a later step fails: after checkpoint creation, say that public objects exist
and the final branch/PR is incomplete. No tool should hide that partial outcome.

## Exact effects and unchanged authority

The selected source bytes, registry revision/blob and all plan block ranges are
prepared together. IDs, kinds, source order, ReadingPage IDs/memberships, unrelated
sources and reading/workspace order remain unchanged. The supported operation is
one-to-one paragraph replacement; split/join/reorder remains explicitly unsupported.
The report is a draft proposal receipt, not authenticated editorial lineage or
truth. Existing `scopeRefs` remain historical source pointers, not a new grant for
changed wording. Private actor/session/request/approval references are not copied
into the public file batch. The batch itself still needs disclosure review.

For an admitted source, preserve the original reader entry's path/revision/blob,
admission and evidence. Add only its exact content-addressed historical snapshot
path and bytes when first necessary; the original pinned blob must match those
bytes. A preconfigured snapshot must already exist with its exact blob in the
captured Git tree, not merely as an untracked local file. Later edits do not
replace it. Missing/hash-mismatched snapshots fail closed without fallback.

The new working blob is unadmitted and has no inherited paragraph evidence bridge.
Old evidence remains attached only to the old admitted snapshot. Chapter-level
`observedReaderAdmission` is still merely a historical manifest observation. The
snapshot's storage path is omitted from generated release content; no new reader
payload or prose is released by adding this software capability.

## Verification

The synthetic integration suite uses the actual pinned #377/#463 modules. It
creates real local Git objects in a disposable synthetic repository, verifies no
ref changes before the full batch exists, checks all base-blob preconditions,
creates the final branch in one operation, then validates the candidate through
`loadInventory`, whole assembly, the reader compiler and paragraph bindings.
It verifies retained old admitted wording/evidence and zero bridge to the new
working source. Negative tests cover stale head/metadata/checkpoint, unsupported
structural edits, neighboring unapproved changes, changed review payload,
snapshot collision/missing tracked snapshot and immutable identity/page continuity.
No real source change or admission decision is exercised by these tests.
