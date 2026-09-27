# ReadingPage traversal v1

[#351](https://github.com/grwtsk/huey/issues/351) consumes the persisted #370/#349
page plan and #350 route contract. The opt-in editorial build exposes `/huey` as
a **read-only traversal of the working book**. The existing admitted editable copy
and its exact evidence hash routes remain at `/`. This bounded step implements
navigation; it does not migrate drafting, evidence mappings or editorial operations.
Keeping the traversal read-only avoids discarding unsaved local edits when changing
pages. The [#352 adapter](../routes/paragraphs.md) adds paragraph focus/permalink
runtime; #364 owns editor migration.

## Selected order and content

`createTraversal({routes, readingOrder, unplacedOrder})` snapshots checked route
metadata and two distinct sequences. Each known ReadingPage occurs exactly once.
The entry is the first book page, including when pending/unavailable. `locate(path)`
returns the route outcome and, for a ReadingPage, its sequence, index and adjacent
stable page IDs. It never filters on publication annotation/admission, wraps at an
end, joins the workspace to the narrative, or chooses a page for a Paragraph or
Chapter. Page order and IDs never depend on viewport size, reflow or font metrics.
A separate publication caller supplies its own governed route table and order;
changing the projection label grants nothing. No publication-table producer is
introduced here.

The derived browser payload is `huey.editorial-traversal.v1`:

- `routes`: the existing strictly checked `huey.route-projection.v1` metadata;
- `readingOrder` / `unplacedOrder`: copied persisted page IDs;
- `pages`: exactly `{id, label, blocks}`, with public inventory labels and ordered
  `{id, kind, text, format}` blocks from the selected authorized assembly.

Only available selected inscriptions materialize. If any page member is denied,
the entire page has no text payload. Restricted/unavailable placeholders retain
public structural metadata. Source mappings, private locators, provenance,
candidate/support prose and source fingerprints are not copied. Metadata checks
are not authenticated permissions. The existing source loader and recorded scope
remain responsible for what can enter the authorized assembly.

Current coverage is 60 book pages (15 front), 14 unplaced pages, 45 slots and 481
materialized blocks, including 471 Paragraphs. Forty-three pages have no materialized
blocks. The available selected text is the current public C08A and unplaced chapter;
public alternative candidates remain references upstream. Partial chapter slots
can therefore describe available candidate material while this traversal still
has no selected canonical prose to render. #370/#353 retain that reconciliation.

The renderer uses inert text nodes, retaining paragraph inscription and explicit
block boundaries. Basic heading/thematic-break rendering is supported; comments
are visibly literal working notes. Rich inline presentation/link rendering is
later work. Markdown remains canonical; the ignored generated payload is not a
second manuscript database. ReadingPage is not Chapter or TypesetPage. No final
pagination, source admission or manuscript acceptance follows from navigation.

## History, outcomes and focus

- Native Previous/Next links appear at document edges, with real stable page URLs.
  They are keyboard/touch/assistive equivalents and support open-in-new-tab.
- Deliberate navigation pushes one history entry. Alias canonicalization replaces
  that entry without another push and preserves any exact-version qualifier.
- `popstate` reads the browser's URL and renders synchronously from the loaded
  projection, with no push or forced scroll. Native history restores scroll.
  Deliberate navigation focuses the new heading and starts at its top.
- Restricted, unavailable, unresolved and exact-version-miss pages stay in order.
  Their text is not substituted. Unknown/non-page routes display an explicit
  outcome. The #352 adapter resolves Paragraph routes to current page context,
  requiring a choice when ambiguous; it never selects the first admitted chapter.
- An exact ReadingPage version pins local membership, not its descendants' past
  prose. A matching page version displays a notice that descendants are from the
  selected current snapshot. Missing exact page versions display no prose.
- No navigation creates an EditorialOperation, storage write, Git effect or grant.

The new view has no fixed title, chapter rail or transport toolbar. The existing
editable admitted view keeps its seven primary controls. A small in-flow context
link explicitly enters Unplaced; book traversal never enters it automatically.
A skip link, named navigation landmarks, visible focus, heading focus and polite
status updates provide browser-level accessibility support. Navigation has no
animation, including under reduced motion; forced colors remain browser-owned.

## Deliberate edge scroll

Wheel input has no portable reliable momentum discriminator. Ordinary wheel,
trackpad, touch scrolling, PageUp/PageDown, idle time and hovering never turn a page.
A new **Alt key press at the boundary**, followed by continued outward scrolling,
is the explicit opt-in gesture. Holding Alt before reaching the boundary cannot
arm it. Each fresh press can turn at most one page; continued momentum cannot
re-arm. The links and Alt+PageUp / Alt+PageDown provide explicit alternatives;
touch uses the native links rather than an inferred swipe/overscroll gesture.

`EdgeIntent` uses deterministic parameters:

| Parameter | Value |
| --- | --- |
| Edge tolerance in browser coordinates | 2 CSS pixels |
| Total outward distance after arming | at least 120 normalized CSS pixels |
| Wheel events | at least 2 |
| Duration from first wheel event | at least 100 ms |
| Expiry from fresh Alt press | 1,500 ms |
| Line/page normalization | 16 CSS pixels per line / current viewport height per page |

No timer causes navigation. Expiry is checked on incoming events. Opposite direction,
leaving the edge, modifier release/other shortcuts, horizontal input, invalid or
nonmonotonic measurements cancel the gesture. Selection, pointer selection, active
editing/interactive focus (including native summary), IME, input, dialogs, focus
changes, blur, visibility, resize and navigation cancel or suppress it. The browser
adapter never arms from a scroll/wheel event. These safeguards also apply when
future editing controls are introduced; a new editor must preserve the contract.

## Run and verify

The ordinary publication `npm run dev` / `npm run build` remain on their declared
Node range. They never package the editorial payload, even after it was generated.
The dev server also denies direct file-serving of `generated-editorial` so an
alternate source-file URL cannot bypass the explicit mode endpoint.

Editorial commands use the existing assembly's **Unicode 17** gate (tested Node
22.23.2 / ICU 78.2), without raising the ordinary reader test runtime floor:

```sh
npm run dev:editorial       # loopback Vite; open http://127.0.0.1:5173/huey
npm run build:editorial     # local static bundle only, no deployment
npm run preview            # serve that bundle at http://127.0.0.1:4173/huey
npm test
npm run test:traversal
HUEY_TRAVERSAL_URL=http://127.0.0.1:4173 python3 reader/tests/traversal_browser_test.py
```

The browser check requires Playwright 1.58.0 and its Chromium installation. It runs
against real HTTP (development server or built preview), not an in-memory DOM.
Tests cover history/deep links, explicit outcomes, input guards, semantic control
names/focus, reduced motion, forced colors and mobile touch emulation. Synthetic
IME/editing guard events do not establish native IME behavior. Chromium tests and
emulation are not macOS VoiceOver, physical touch/trackpad, Safari/Firefox or full
accessibility certification. Exact local and hosted results belong in the PR
receipt; no unrun native check is implied by this contract.

#352 extends this traversal with paragraph runtime. #370/#353 ingestion/reconciliation,
#364 complete editable migration, #367 origin/deployment and later typesetting stay
open. No private store, kernel authority/runtime, main promotion or release is
activated here.
