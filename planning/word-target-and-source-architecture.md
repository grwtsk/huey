# Word target and canonical source architecture

Status: structural pre-release plan under #17. No manuscript prose is expanded by this change.

## Expansion envelope

The narrative-body target is now **80,000–114,000 words**. This supersedes the older approximate 56,000-word planning allocation as a word-count target only. It does not change the title, the three-movement order, the stable chapter identities, PR-01, the protected closing, source permissions, acceptance gates, or release status.

| Movement | Planning envelope | Expansion posture |
|---|---:|---|
| Preamble | 31,000–43,000 | deepen lived scenes, continuity, ordinary life, and the conditions under which later events are understood |
| Interlude | 48,400–70,400 | carry most additional room for medical, institutional, legal, ethical, reflective, and constructive material without turning the book into a dossier |
| Excursion: Edna | approximately 600 | preserve the supplied short close; do not lengthen it to satisfy the target |

The envelopes sum to 80,000–114,000. They are planning bands, not chapter quotas. Expansion should come from warranted scene, relation, transition, reflection, context, counterevidence, and source-fidelity work. Repetition, evidence dumping, decorative abstraction, or padding the ending do not count as successful expansion.

Relative to the earlier 24,000 / 31,400 / approximately 600 plan, expansion capacity is approximately 7,000–19,000 words in the Preamble and 17,000–39,000 in the Interlude, while the Excursion remains fixed.


## Experiential spacing inside the expanded architecture

The author has resolved the high-level relationship among the five registered experiential pieces without expanding their prose here:

- three of the five are already captured within **C08A, Baptism in the Color of Rain**;
- one remaining piece is a detailed account of the author's mother's death;
- one remaining piece is a detailed account of the author's rape.

The two remaining pieces now have stable structural slots but no imposed literary titles:

| Stable ID | Working placement | Working descriptor | Status |
|---|---|---|---|
| C02A | after C02, Preamble | mother's death | structural placeholder only |
| C12A | after C12, Interlude | rape | structural placeholder only |

Their governing relation is **C02A → distance → C08A → distance → C12A**. “Reflection” here is an editorial spacing relation only. It does not assert equivalence, causation, symmetry, diagnosis, or that one trauma exists to explain another.

The source-neutral EX-01–EX-05 inventory does not publicly identify which exact EX IDs correspond to the two remaining slots. That reconciliation must use the private register; it must not be inferred from titles, profile information, or likely chronology.

C08A remains one chapter rather than being split into three duplicate experiential entries. C02A and C12A remain comment-only until source-grounded prose is separately admitted. The C15 → movement break → Edna close is unchanged.

## Canonical source rule

All prose-bearing book source lives under **manuscript/** and is Markdown. Stable paths exist before prose is admitted so chapter work can grow without moving the book around in Git.

The root **book.yaml** is ordering and build metadata only. It names every stable narrative unit, its Markdown path, current staging status, and whether that source is presently admitted to an emitted working manuscript. A planned source file contains only a structural HTML comment until actual prose is authorized for that public path.

Build and reader systems must consume canonical Markdown through the manifest. Reader copies, LaTeX intermediates, HTML intermediates, PDFs, EPUBs, and generated bundles are not a second source of truth.

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

- **manuscript/front/** — front-matter source when separately approved; excluded from narrative target.
- **manuscript/01-preamble/** — canonical Preamble Markdown.
- **manuscript/02-interlude/** — canonical Interlude Markdown, including stable C08A.
- **manuscript/03-excursion/** — canonical closing-excursion path; do not expand it merely to hit word count.
- **manuscript/back/** — separately marked reference/back matter, never an explanatory narrative epilogue.
- **certificates/** — public derived certificates only.
- **production/** — typesetting/input contract, not canonical prose.
- **build/** and **dist/** — ignored generated outputs.

Later expansion is local: edit the chapter Markdown that owns the material, update its status in book.yaml when it is actually admitted, and let every renderer extract the same ordered source.
