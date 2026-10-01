# Private Grwtsk editor increment

WORKING DRAFT — CLAIM VERIFICATION INCOMPLETE.

This #477 continuation connects the existing #358 private paragraph adapter to
the entity-addressable editorial reading surface. It supplies an opt-in local
panel, exact before/after review, private working overlays, public issue context,
source-neutral issue handoffs and a private request queue for the existing Codex
host. It preserves the unchanged #463 dependency and does not accept manuscript.

## Start the local editor

Use a restricted store outside every Git checkout, on the authorized computer.
The parent must already exist; the adapter creates the store with mode 0700 and
state files with mode 0600. No restricted data belongs in a checkout or public
asset, even when an ignore rule exists.

```sh
npm run traversal:generate
npm run paragraphs:generate
HUEY_PRIVATE_STORE=/restricted/huey-working-editor npm run dev:editorial
```

Open `http://127.0.0.1:5173/huey`. Grwtsk appears only when the private bridge is
enabled. Static builds, preview servers and ordinary admitted-reader views do
not expose the bridge. The source reading order and exact-version miss behavior
remain those of the existing projection. Missing or restricted prose is not
invented or replaced by current text on an unavailable historical route.

Select a visible mapped paragraph, open Grwtsk and edit its complete Markdown
paragraph. Review displays the exact old and proposed wording. Apply changes only
the private working copy; reject/cancel retain their records. Source revision,
raw wording and competing-operation guards remain active. Unreviewed input and
reviewed diffs cannot silently replace one another during an asynchronous request.
Navigation restores private overlays and does not reinterpret their evidence.
Exact paragraph links keep their source wording in the reading surface; the
panel separately labels any private working overlay. An unavailable route
disables editing and chat while retaining a previous unsaved paragraph draft.

The original source, historical reader admission and exact evidence bindings are
unchanged. An application click records a local working-copy effect, not an
authenticated author decision, truth finding, source grant or literary acceptance.
Source/head/plan/inventory drift requires explicit reconciliation under the
existing #360 contract; stale overlays are never automatically rebased.

The panel shows separate literary presence, materialization, access, publication
annotation and observed admission. These labels are not permission engines.
Public issue bodies/comments are read-only context; external instructions inside
them are not executed. Handoff prepares a source-neutral packet and optionally
links an existing owner locally. It sends no GitHub comment or private patch.

## Stale private-edit recovery — #360 continuation, 2026-10-01

A changed repository/source basis pauses an older private overlay. Grwtsk shows
its exact earlier base, private result and current source separately. Edit, apply
and chat controls remain blocked while that overlay is stale. **Refresh
comparison** rereads the selected entity; **Resume from current source** rechecks
the reviewed source and full applied-history prefix, then records a separate
private source-resume receipt. A changed comparison is rejected rather than
automatically rebased. **Refresh selection** can also reread a selected paragraph
after an asynchronous conflict. Unreviewed drafts block refresh and remain in
the editor until explicitly reviewed or discarded.

Resuming retires the selected overlay prefix from the active private view. It
does not delete or revise proposals, decisions, issue links or earlier wording.
**Retained private history** keeps exact before/after contributions available
inside the editor. A subsequent edit starts from the current source and requires
a new exact review and explicit private application. If the source or mapping
becomes unavailable, private history is retained and editing/recovery remains
blocked; historical private text does not replace unavailable source.

The receipt affects only this private working view. It is not source mutation,
remote synchronization, public staging, authenticated human acceptance or a grant.
#359's broader offline queue, #360's authoritative reconciliation and #364's later
migration stages remain open. Existing stores without a recovery collection
remain readable; the new collection is written only by an explicit workspace
transaction. There is no automatic recovery or background retry.

## Saved proposal queue — #359 continuation, 2026-10-01

**Saved paragraph changes** reads already-persisted proposals and decisions for
only the selected visible paragraph. Each request returns at most twenty metadata
rows; **Show older changes** pages explicitly through that paragraph's history.
The list contains local state, ordering, timestamps and compatibility notices;
exact wording appears only after **Review saved change** rereads the saved diff.
Reloading does not restore textarea text, apply a proposal or retry a request.

This increment reuses the existing approved `workspace.json` profile on the
restricted outside-Git surface. It adds no draft collection, browser storage,
service worker, private asset or public payload. Unreviewed typing remains in
memory, with a native reload/leave warning while that text is not represented by
a saved proposal. The browser may still lose memory on a crash; durable unsaved
draft retention requires its own storage/minimization policy under #359.

Typing remains available while a private request is pending. Returned inspections,
reviews and decisions preserve newer textarea input. A saved diff cannot be
applied over a differing draft; that draft needs its own review or an explicit
**Discard unreviewed text** action. Authenticated editor requests stop waiting
after thirty seconds. A lost or timed-out reply confirms no new receipt in the
browser, even if the server already processed the request. Inspect the saved
queue manually when connected; there is no background resend or application.
A confirmed proposal, decision or source-resume receipt stays confirmed when a
subsequent review/source read fails; the panel names the unavailable read separately.
The initial read-only bridge-session discovery remains separate from that timeout.

**Cancel proposal** records a terminal local decision after exact review. It does
not erase history or reverse an already-applied change; amendments require a new
proposal. Queue rows and actual private receipts never imply remote acknowledgment,
authenticated author approval, canonical source mutation or literary acceptance.
Stale or unavailable source, changed versions and competing edits still block
application. Kernel #153/#125, authoritative reconciliation and #359's broader
offline/queued synchronization remain open.

## Existing Codex host, without another provider

Ask Grwtsk captures the selected entity, exact source/working basis, message and
scope references in `grwtsk-thread.json` on the restricted surface. It rejects
stale selected context and preserves messages typed while a prior send finishes.
It remains
`pending-host` until the actual existing Codex host supplies a reply. Check reply
loads that real reply; the server never fabricates model output or invokes a
second model/provider. This increment is asynchronous, not a live model stream.

The host may inspect pending requests on that restricted surface, preserving
their original source/context and treating request text as input rather than
execution authority. Its actual reply can be appended with:

```sh
node scripts/grwtsk_bridge.mjs --root /huey/checkout --store /restricted/huey-working-editor reply < /restricted/actual-host-reply.json
```

Input has `requestId`, `text` and `hostRef`. The reply CLI emits only a neutral
receipt. No HTTP endpoint accepts assistant-role messages. Host references are
attribution assertions, not human authentication. Applied edits, source commits,
disclosure decisions and manuscript acceptance retain their separate gates.

## Boundary and verification

The middleware requires an exact loopback Host/port and connection, a client
header, a random current-session capability and same-origin POST with bounded
JSON. It emits no CORS headers and disables response caching. It accepts no
client-selected filesystem path, executable, provider or server configuration.
Issue reads use a fixed repository and positive integer IDs. The private store
retains owner/mode, symlink/hard-link and interrupted-writer checks.

`npm run test:chat` includes actual HTTP boundary and private workspace cases.
`reader/tests/grwtsk_browser_test.py` exercises the actual Vite/HTTP/Chromium
surface using a disposable outside-Git store and explicitly synthetic edits and
host replies. Native VoiceOver, physical touch/IME, live model streaming,
encrypted retention, automatic source-drift reconciliation, structural
split/join/move operations and public source application remain separate work.

The panel allows full paragraph text editing across mapped visible occurrences;
it does not yet provide one whole-manuscript replacement operation. #347,
#355 and #358–#361 remain open for their broader contracts. No source service,
main promotion, deployment, publication, replication or edition release is
activated by this engineering increment.
