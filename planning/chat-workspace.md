# Private chat workspace: bounded assistant adapter

WORKING DRAFT — CLAIM VERIFICATION INCOMPLETE.

This is a local host adapter for the author's requested chat-driven editing flow.
The existing assistant supplies reasoning and performs explicit commands. There is
no second model, API key, conversation endpoint, hosted server or background agent.
It contributes a **private, single-paragraph ReplaceInscription rehearsal** to
#347/#358/#359. It does not freeze the eventual full EditorialOperation schema,
authenticate a human decision, complete #355/#360/#361, or migrate the browser
editor (#364). None of those issues is closed.

## Source and editing contract

- Read the existing checked inventory, persisted plan and exact source bytes.
  Reuse EntityID, EntityVersion and exact source locators. Never allocate real
  literary identities, infer identity from equal text, initialize plans or silently
  reconcile drift. Unavailable, unmapped and stale-plan slots remain explicit.
- Validate each selected mapped source's complete parser block coverage, kind,
  ranges and Git blob. This is a **per-source projection**, not a substitute for
  the complete editorial assembly check. Candidate/support sources are excluded.
- `read` returns exact Markdown, source version/locator, current private working
  version and a raw-wording digest. A formatted change can keep the inscription
  version while changing raw Markdown; both guards are required.
- `propose` captures before/after, target, source and whole-work basis, neighboring
  paragraph IDs, actor/session/request reference, client sequence, idempotency key
  and a review digest. Actor and reference fields are host assertions, never
  authentication, source permission or evidence clearance.
- `review` exposes the exact before/after and conflict state in the private chat.
  Show this to the user and obtain the required exact decision before `decide`.
  The CLI does not obtain or independently verify user approval.
- `decide` records `applied-private`, `rejected` or `cancelled`. Applied means an
  overlay in the restricted local workspace only. No canonical Markdown, source
  pin, plan, evidence, admission, Git history or publication state is changed.
  Source/head/plan/inventory drift or a competing applied proposal blocks stale
  writes. A stale overlay also blocks reads until explicitly reconciled; it is
  never silently rebased. Rejection/cancellation preserve the original proposal.
- An idempotent retry returns the existing operation/receipt. A different payload
  under the same key or a conflicting terminal decision is rejected.
- Later private edits preserve the earlier proposal and decision. To reverse an
  approved private edit, propose its previous wording against the current private
  version and review again. There is no destructive history deletion command.

No hash, local receipt, actor field, green test or GitHub link proves human assent,
literary continuity, truth, rights or source authorization. RF-01, PR-01, the source
boundary and existing exact-payload gates remain operative. Do not use a global
search or preview to disclose the protected ending early; search requires an
explicit slot, and the host must observe the author's scope.

## Installation and interface

Node with the literary model's Unicode 17 runtime is needed (tested with Node
24.19.0 / ICU 78.3). The CLI has no added package dependencies. Run from a full
Huey checkout with the inventoried Git objects available. The ordinary Vite reader
remains a separate presentation-only editor.

Choose a restricted directory **outside all Git worktrees**, with an existing
parent, on the authorized local computer. For example:

```sh
npm run chat -- --store /restricted/huey-private list
npm run chat -- --store /restricted/huey-private list C08A
npm run chat -- --store /restricted/huey-private read he_UUID_FROM_LIST
printf '%s' '{"slot":"C08A","query":"literal phrase","limit":5}' |
  npm run chat -- --store /restricted/huey-private search
```

`--root /path/to/checkout` selects an explicit source checkout; the store is bound
to that checkout's real path. List shows source versions and line coordinates,
not prose. Read returns the current private overlay if one has been applied.
Search is case-sensitive literal matching and returns at most twenty exact
paragraphs. Don't write private requests into shell history, public logs, tracked
files, browser assets, PR descriptions or issue comments. Use stdin from the
assistant's restricted execution context.

Proposal stdin (fill values from a fresh `read`):

```json
{
  "id": "he_UUID_FROM_READ",
  "baseVersion": "VERSION_FROM_READ",
  "beforeDigest": "RAW_DIGEST_FROM_READ",
  "after": "One proposed supported Markdown paragraph.",
  "actor": "host-asserted assistant identity",
  "session": "private session reference",
  "requestRef": "exact author request reference",
  "key": "unique-idempotency-key"
}
```

```sh
node scripts/chat_workspace.mjs --store /restricted/huey-private propose < /restricted/request.json
node scripts/chat_workspace.mjs --store /restricted/huey-private review op_UUID
```

After showing the exact review and receiving its decision, pass stdin to `decide`:

```json
{
  "operationId": "op_UUID",
  "reviewDigest": "DIGEST_FROM_REVIEW",
  "approvalRef": "exact private user decision reference",
  "status": "applied-private"
}
```

`status` may instead be `rejected` or `cancelled`. Never manufacture an approval
reference, infer assent from a link or use the demo's synthetic reference for real
work. Successful application remains local; a separate canonical source adapter
and disclosure/evidence review are necessary before a source commit.

## Restricted source-patch preview

`source-preview op_UUID` requires an applied private decision and fresh exact
source basis. It batches all currently applied private paragraph overlays for that
source, replacing their original UTF-16 ranges in descending order. It emits exact
before/after source bytes, a deterministic full-file unified patch, the candidate
Git blob and contributing operation IDs. It verifies unchanged structural block
count; synthetic tests run `git apply --check` without applying the patch.

This output contains source text and is **private**, unlike the source-neutral
`handoff` result. Keep it in the restricted workspace/chat; never publish it or send
it to GitHub before reviewing the exact payload's disclosure permission. The
command neither writes canonical source nor updates its source pin/identity plan.
A full-file patch can include unchanged source text; its disclosure review must
cover the whole payload. Use it as an inspectable materialization input, not proof
that publication metadata has been reconciled.

Concrete remaining canonical-write work: combine the source patch with a complete
old-ID → new-range correspondence (including nonparagraph blocks), retain page and
route identity, update the selected source revision/blob and range sidecar
atomically, and invalidate/reconcile old evidence bindings instead of inheriting
them. The existing #377 API validates a proposed correspondence but explicitly
has no apply command; #463 fixes the complete assembly but does not add a writer.
The next bounded engineering increment can connect these existing contracts to an
atomic source-plus-sidecar transaction and an explicit reviewed Git commit receipt.
That is implementation work; only actual content disclosure and editorial
acceptance require the separate human decisions already described.

## GitHub handoff

```sh
node scripts/chat_workspace.mjs --store /restricted/huey-private link op_UUID https://github.com/grwtsk/huey/issues/358
node scripts/chat_workspace.mjs --store /restricted/huey-private handoff op_UUID
```

`link` stores a local association only. It does not verify the issue/PR, post a
comment or treat the linked item as an approval. `handoff` produces a source-neutral
preview, identifies a draft PR against `pre-release`, and names the remaining
review/materialization gates. It excludes prose, source locators and private
fingerprints. It performs no network request, Git write, push, PR creation, merge
or deployment. An authorized host may use its GitHub connector after verifying the
recipient and exact payload; private source patches require their own clearance.

## Storage and concurrency limits

The store is created mode 0700; JSON is mode 0600, owned by the local user. Reject
symlinks, hard-linked state files, nonregular entries, permissive modes and stores
inside a Git worktree. Sandbox-provided empty `.git` placeholders are not real
worktrees. Data stays outside the source checkout rather than relying on ignore
rules. This is filesystem isolation, not encryption or a multi-user security
service; anyone controlling this OS account can forge local records.

An exclusive lock serializes writers. State is replaced via same-directory atomic
rename, so a process interruption before replacement preserves the old state.
If an interrupted writer leaves `workspace.lock`, inspect the process and state
before removing that lock; the tool never guesses that another writer is dead.
A crash after the rename can leave a committed state with an uncertain client
response; inspect/retry by idempotency key. The workspace survives process restarts only while its filesystem remains available;
this adapter does not guarantee retention across cloud-environment replacement.
Power-loss durability, encrypted
backups, multi-device replication and source-drift reconciliation are not supplied.
Keep private stores under the user's authorized retention policy.

## Verification and current integration dependency

```sh
npm run test:chat
node scripts/chat_demo.mjs
```

The demonstration creates only synthetic text in a temporary restricted workspace,
performs read → proposal → exact review → synthetic decision → restart → search →
source-neutral handoff, verifies the synthetic source stayed unchanged, and removes
its synthetic workspace. It never obtains real human approval or edits manuscript.
Tests cover stale bases/raw Markdown, competing edits, retries, terminal decisions,
lineage, unavailable-source reads, unsupported edits, privacy paths, permissions,
locks, integrity and local-only handoff.

At the implementation base `664f9b6`, full editorial assembly is already blocked by
front-matter placement and four missing source plans. Existing #441 / PR #463 owns
that complete source/identity/route repair; this adapter neither duplicates it nor
claims those baseline checks passed. The current base permits 1,860 validated
mapped paragraphs across five selected sources; four present sources remain
unmapped. Use the reviewed #463 candidate locally only with explicit provenance,
and rerun combined checks before integrating it. No literary wording is changed
by this software-only adapter.
