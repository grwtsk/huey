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
