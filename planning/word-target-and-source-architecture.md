# Scale horizon and canonical source architecture

Status: structural pre-release plan under #17 and #404. No manuscript prose is expanded by this change.

## Approximate scale horizon — not a goal

The author currently expects that the finished narrative may extend to roughly **120,000 words or so**.

That number is a **scale horizon**, not a target to hit. It is not a quota, cap, minimum, deadline, release criterion, or commitment to stop adding material. The previous 80,000–114,000 hard validation band is retired.

Counting remains useful for observing the size of the world being built, estimating production burden, and noticing when an argument cut has become unwieldy. It must not become a literary success condition.

The supplied short Excursion: Edna remains protected from expansion merely to satisfy scale.

The title **Huey**, PR-01, the protected closing, source permissions, evidence gates and release boundaries remain unchanged. The three movements remain the current high-level architecture; chapter count, titles, order and boundaries within them are now explicitly working projections.

See [world-first composition and argument cuts](world-and-argument-cuts.md) and #404.

## Experiential spacing inside the current working projection

The author has resolved the high-level relationship among the five registered experiential pieces without expanding their prose here:

- three of the five are already captured within **C08A, Baptism in the Color of Rain**;
- one remaining piece is a detailed account of the author's mother's death;
- one remaining piece is a detailed account of the author's rape.

The two remaining pieces currently have working structural slots and no imposed final literary titles. Their IDs preserve staging history; their eventual chapter ownership/order may change during late partition:

| Stable ID | Working placement | Working descriptor | Status |
|---|---|---|---|
| C02A | after C02, Preamble | mother's death | structural placeholder only |
| C12A | after C12, Interlude | rape | structural placeholder only |

Their current spacing relation is **C02A → distance → C08A → distance → C12A**. It is a working editorial projection only, not final chapter order. “Reflection” does not assert equivalence, causation, symmetry, diagnosis, or that one trauma exists to explain another.

The source-neutral EX-01–EX-05 inventory does not publicly identify which exact EX IDs correspond to the two remaining slots. That reconciliation must use the private register; it must not be inferred from titles, profile information, or likely chronology.

C08A remains one chapter rather than being split into three duplicate experiential entries. C02A and C12A remain comment-only until source-grounded prose is separately admitted. The C15 → movement break → Edna close is unchanged.

## Canonical source rule

All prose-bearing public book source lives under **manuscript/** and is Markdown.

Two composition surfaces now coexist:

- **partitioned working projection** — the current chapter paths referenced by `book.yaml`;
- **pre-partition flow** — `manuscript/flow/`, for admitted prose that belongs to Huey's world but does not yet have a final chapter, title, order or boundary.

The root **book.yaml** records current build admission and the current projection. Its item order, chapter numbers, titles and paths are planning coordinates, not final literary identity. A planned chapter path may still contain only a structural HTML comment until prose is actually admitted there.

Build and reader systems must consume canonical Markdown through explicit admission. Reader copies, LaTeX intermediates, HTML intermediates, PDFs, EPUBs, and generated bundles are not a second source of truth. Flow drafts are not emitted merely because they exist.

Current extraction commands:

    npm run book:check
    npm run book:list
    npm run book:count
    npm run book:md > build/huey.md

The final command emits only manifest entries explicitly marked include=true and fails if the source tree violates the manifest. LaTeX and HTML typesetters should consume that emitted Markdown or call the same extraction module.

## Certificate repository and private evidence boundary

The public **certificates/** tree stores derived verification records only and is Markdown-only at this stage.

A certificate may identify an approved opaque source or claim ID, the check performed, the version of the public derivative checked, the checker, date, limitations, and result. It must not contain a raw record, scan, screenshot, restricted quotation, private locator, access token, or private-source fingerprint prohibited by existing disclosure rules.

Raw evidence remains outside this public repository in the separately controlled private evidence repository/service. This scaffold does not create, activate, query, migrate, or disclose that private repository. A public certificate is not the evidence and is not proof of the underlying event; it records a bounded check.

## Folder contract

- **manuscript/front/** — front-matter source when separately approved; outside the narrative scale observation.
- **manuscript/flow/** — pre-partition public working prose; not a fourth movement and not emitted by existence alone.
- **manuscript/01-preamble/** — current working Preamble projection.
- **manuscript/02-interlude/** — current working Interlude projection, including C08A as the compositional mixing chamber.
- **manuscript/03-excursion/** — protected closing-excursion path; do not expand it merely to satisfy scale.
- **manuscript/back/** — separately marked reference/back matter, never an explanatory narrative epilogue.
- **certificates/** — public derived certificates only.
- **production/** — typesetting/input contract, not canonical prose.
- **build/** and **dist/** — ignored generated outputs.

Later expansion is not required to begin inside a chapter. New admitted prose may first enter `manuscript/flow/`. When a mature argument cut becomes visible, move/reference the material through explicit lineage, update the working projection, and let every renderer extract only the deliberately admitted reading sequence.
