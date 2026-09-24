# Stable paragraph permalinks v1

[#352](https://github.com/grwtsk/huey/issues/352) adds paragraph focus and exact
evidence-link reconciliation to the opt-in editorial browser. It consumes the
existing [route grammar](README.md), [traversal](../editorial-pages/traversal.md)
and persisted assembly IDs. It changes no manuscript, entity registry, admission
manifest or evidence ledger. Markdown remains canonical; generated JSON is derived.

## Current and exact links

Every materialized Paragraph has two native links:

- `/huey/paragraph/{EntityID}` selects its current state in this projection.
- `/huey/paragraph/{EntityID}/v/{EntityVersion}` requires that exact local state.

Both links use the persisted opaque ID, never a paragraph ordinal, text digest,
file path, chapter name, page number or viewport coordinate. Equal-valued
paragraphs remain separate occurrences. Exact versions use the existing
`huey-literary-model/1` semantics; no new entity/version scheme is introduced.

`resolveParagraphLocation` in `reader/src/paragraphs.mjs` uses the checked route
table and both explicit page sequences. It resolves the paragraph first, then its
available current ReadingPage memberships. One candidate selects that page. More
than one requires a named native button choice; book/workspace order is displayed
but never used to silently choose. The choice lives in this browser history
entry, not the paragraph URL or entity. An invalid/stale choice requires a new
choice rather than silently changing context. A copied link with multiple
memberships therefore asks its recipient to choose again.

The URL remains the paragraph address while its selected page renders. The exact
paragraph receives visible focus and scrolls into view on deliberate/direct
navigation. Back/Forward restores the URL and selected page choice without a push
or forced scroll; native history retains scroll restoration. Current and exact
links support native keyboard, touch, copying and opening in another tab. Page
traversal uses the chosen page's neighbors and never joins Unplaced to the book.

An exact link pins the paragraph, not its surrounding prose or former position.
The browser says that the surrounding text comes from the selected current page.
A missing exact version renders an explicit outcome and **no current substitute**.
Denied/unavailable states likewise do not expose paragraph text. Metadata remains
an observation of the selected projection, not a browser permission engine.
If the chosen page does not materialize exactly one matching Paragraph block,
the browser reports unavailable context without displaying surrounding prose or
claiming the requested occurrence was focused.

## Move, split, join and retirement contract

| Change | Route behavior |
| --- | --- |
| Move/reorder/repartition | The same Paragraph ID resolves through its new current page membership. Unchanged local paragraph state keeps its version. |
| Paragraph revision | Current link resolves the selected new version; an unavailable old exact version does not redirect to it. |
| Multiple page projections | Explicit context choice; no duplicate paragraph identity. |
| No current page membership | Known paragraph reports `unprojected`; absence of membership does not infer retirement, omission or a successor. |
| Split/join/replacement | Old IDs are not rebound to new occurrences. A retained old record remains addressable in its selected snapshot; no successor is inferred by text equality, position or Git ancestry. |
| Retired/removed from this projection | A retained accessible record without membership reports `unprojected`; an absent record reports `unknown`. Neither result invents a retirement event or redirects to another occurrence. |

Synthetic histories test these distinctions. Full operation/lineage creation,
retirement annotations, reviewed successor redirects and historical snapshot
selection remain #358/#368. This adapter consumes one selected snapshot and does
not reconstruct an archive, deleted prose or restricted history. Stable addresses
identify what is requested; they do not promise every past version is available.
ReadingPage remains authored navigation, separate from Chapter and later TypesetPage.

## Exact compatibility with admitted evidence

`scripts/paragraph_bindings.mjs` produces `huey.legacy-paragraph-bindings.v1`:

```text
{ schema, bindings: [{
    chapterId, chapterBlob, ordinal, rawSha256, entityId, entityVersion
}] }
```

The closed validator rejects unknown fields, malformed tuples, duplicate legacy
coordinates and duplicate entity/version bindings. This is correspondence
metadata, not a source permission, authenticated Instruction/Grant, evidence
finding or literary lineage record. The producer requires the already selected
canonical source and slot to be available before reading their material.

Reconciliation requires the admitted chapter's **same path and exact Git blob**
as the selected public source. Git revisions may differ when those pins name the
same blob; each original revision stays recorded upstream. The builder reparses
the exact source with both current parsers and checks:

1. Exact legacy paragraph number, line range, raw wording, rendered text and raw
   SHA-256 against the admitted compiler output.
2. A unique existing structural source mapping at that range, its source key,
   path/revision/blob and UTF-16 range.
3. The existing Paragraph ID, canonical state and sealed EntityVersion against
   the corresponding structural paragraph.

No identity is allocated or guessed. A raw hash checks fidelity only; equality
does not select an occurrence. CRLF normalization follows the legacy compiler's
documented raw-paragraph representation, while structural state is checked with
its own parser. Different selected blobs receive no inherited binding. A matching
source with ambiguous/missing mappings fails generation; failed generation removes
the previous bridge file so it cannot masquerade as a fresh result.

The present public selection yields **260 C08A bindings**. The **211 unplaced
paragraphs** still have stable current/exact routes but no admitted collection
binding. That absence means reconciliation is absent, not that evidence does not
exist or that the paragraph has no claims. No evidence/admission status changes.

Editorial paragraph links reach the existing
`/#evidence/{chapterId}/{ordinal}/{chapterBlob}` collection only through an exact
ID/**version** binding. The collection continues to display the pinned admitted
wording, source link and pending claim-mapping status. In the explicit editorial
build it offers current/exact stable links back only when all four legacy fields,
including `rawSha256`, match. A changed paragraph version cannot inherit the old
collection. The legacy Git blob and raw SHA are not EntityVersion.

The bridge contains only those six public correspondence fields: no prose, source
paths, locators, alternative candidates or restricted fingerprints. Generated
files remain ignored under `reader/generated-editorial/data/`. The explicit
editorial mode serves/packages `paragraphs.json` and `traversal.json`; ordinary
publication builds exclude both. Malformed or unavailable bridge data disables
only the extra evidence adjacency, leaving paragraph navigation and existing
admitted evidence behavior usable. There is no automatic redirect from legacy
hash routes and no silent admission of the unplaced chapter.

## Checks and remaining work

```sh
npm test
npm run test:paragraphs
npm run build:editorial
npm run preview
HUEY_TRAVERSAL_URL=http://127.0.0.1:4173 python3 reader/tests/paragraph_browser_test.py
```

The pure reader tests run on the declared Node range. Reconciliation/build uses
the assembly's Unicode-17 runtime (tested Node 22.23.2 / ICU 78.2). Browser checks
use Playwright 1.58.0 Chromium over actual HTTP: real admitted correspondence plus
synthetic moves, revisions, ambiguous membership, denial, malformed bridges and
keyboard/reflow/forced-color/touch-emulation checks. They do not establish native
VoiceOver, physical touch/trackpad, other engines or accessibility certification.
Hosted jobs also run the previous traversal and admitted-editor browser suites.
Actual commands, counts and tested revisions belong in the PR receipt.

#370/#353 retain deferred source ingestion and reconciliation. #364 retains the
complete editable migration; this editorial view remains read-only so navigation
does not discard drafts. #314 retains substantive evidence mapping. #363/#368
retain full source-range/lifecycle work, and #367 retains origin activation.
No private source service, kernel authority runtime, manuscript acceptance,
evidence clearance, new source disclosure, main promotion, deployment or release
is performed. Structural checks do not establish factual or literary truth.
