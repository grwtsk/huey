# Complete editorial inventory: source audit

Read-only audit of grwtsk/huey at pre-release `0eae39f74d6fb6f4a391f3a358a75be1d95b2f6e`, 2026-09-24 UTC. Read root/reader instructions, pre-release and framing resume, live master #1, disclosure #2, front-matter #34/#36/#7/#13, #332, relevant PRs, tree and content compiler. This source audit imported no prose and searched no private store. The associated engineering PR adds metadata/code only; its issue-graph changes are documented separately.

## Current source structure

`book.yaml` has 19 ordered literary slots: Preamble C01 C02 C02A C03 C04 C05 C06 C07; Interlude C08 C08A C09 C10 C11 C12 C12A C13 C14 C15; Excursion E01. All paths exist. C08A is full admitted working prose. The other 18 files contain comments only. Missing narrative bytes do not mean omitted chapters or no private candidate exists. C02A/C12A are untitled structural slots; final titles and public prose are not supplied. Three experiences already captured in C08A must not be duplicated as extra chapters.

`manuscript/unplaced/the-place-beneath-pain.md` is complete publicly staged working prose, outside book.yaml. PR #346 records explicit as-is public transfer; canonical placement remains open under #344/#345. Preserve the file and its own stable identity; expose it through editorial workspace membership, not a fourth Movement or automatic C14 replacement.

Front/back directories currently contain structural READMEs only. Pending front-matter candidates can be inventoried without inventing content or an omission decision. #34 owns half-title/title/copyright; #36 owns contents and optional preliminaries; #7 owns optional selections; #13 owns packaging acceptance. #35 owns source/author note/advisory. Back-matter known categories from #13/#56–#59 include notes, bibliography, chronology/method appendices, glossary/index, acknowledgments, contributor/author information, permissions and colophon. Print folios and final layout remain later production work.

## Available public candidates beyond canonical chapter files

C15 has two already merged public files: `planning/writing/c15-prototype-r01.md` and `planning/writing/c15-societal-language-braid.md`, from PRs #334/#333. They are noncanonical partial candidates with explicit unresolved private anchors, not full current Chapter 15. #332 remains open for exact private reassembly/review. Inventory these links while retaining the canonical comment-only path and unavailable protected components; do not extract or duplicate an ending.

PR #319 at `5e936adb132d22d8f0d5c41799591896535abd21` contains an alternate full C08A proposal and explicitly authorized companion essay/eight before-after proposals. Proposal targets are I01 C02; I02–I04 C03; I05 C07; I06–I08 C12. These are public and available editorial inputs, but drawn from an older extracted reading copy and not reconciled to latest private chapters. Do not replace the current admitted C08A or call these four chapters fully materialized. PR #319 remains draft/unmerged; its README and PR record the direct author public-copy instruction.

PR #122 / `writing/55-development-r01` at `ff0499bd341de12a31b355b79867b547f19d9b16` contains authorized SOC public source corpus and editorial candidates. SOC-PUBLIC-01 is explicitly recorded in live #2 comment 5771600544; `planning/standard-of-care/AUTHORIZATION.md` and `approval.json` preserve scope. This includes twelve complete authored source-text exports, contextual working material, a full atlas, ancillary/authority candidates and `planning/standard-of-care/care-law/revision.md` (256 prose units). `book-integration.json` maps 17 source sections to candidate chapter/back-matter joins. These are not a current full-book manuscript or accepted insertion. The current whole manuscript and later exact integrated reference notes remain conversation-delivered; public indices cannot reconstruct their bytes. PR #122 remains draft/unmerged with unrelated code/policy work; do not bulk-merge it to assemble this inventory.

Other open chapter and movement PRs #83–#95, #97, #117/#118/#120/#121 contain source-neutral progress records rather than full manuscript. Their existence establishes known work and boundaries, not authorization to recover private drafts. PR #83 has later opening revision receipts but no chapter payload. No other current open PR duplicates this inventory foundation.

## Exact references

[registry.json](registry.json) contains 34 metadata-only source records with exact commit/path/blob, role, authority URL and known chapter targets. It includes current manuscript and C15 files, PR #319 candidates, SOC literary-source files, indices, and three later public analytical inputs: `economics-r11.md`, `institutional-economics-r12.md`, and `reciprocal-notice-r13.md`. Those three are models/matrices, not completed chapters. The [pinned care-law directory](https://github.com/grwtsk/huey/tree/ff0499bd341de12a31b355b79867b547f19d9b16/planning/standard-of-care/care-law) retains access to their supporting apparatus. Public integration-r03–r10 files are receipts/indices; their actual narrative/reference prose remains private. A source link is not automatic adoption or authority for additional material. Only public object hashes were recorded.

Important public authority receipts:
- Current C08A: https://github.com/grwtsk/huey/issues/2#issuecomment-5782472575 and #308.
- Unplaced chapter: https://github.com/grwtsk/huey/pull/346.
- C15 braid: https://github.com/grwtsk/huey/issues/332#issuecomment-5790403521.
- C15 prototype: https://github.com/grwtsk/huey/issues/332#issuecomment-5790493315.
- Interiority candidates: https://github.com/grwtsk/huey/pull/319 plus its pinned companion README.
- SOC corpus: https://github.com/grwtsk/huey/issues/2#issuecomment-5771600544.

## Reader/evidence boundary

The current publication compiler consumes only `reader/content/book.json` and evidence ledger. It admits one C08A chapter with 260 positional paragraphs at its pinned blob. It intentionally forbids payload locators on unavailable publication chapters, checks Git blob bytes and source containment, then attaches paragraph evidence by exact raw SHA256. New editorial metadata should not alter those gates or assign evidence clearance.

Reader EX and book.yaml E01 name the existing excursion in their respective namespaces; preserve both explicitly instead of inventing a second excursion. Existing Cxx IDs and evidence paragraph ordinals are compatibility aliases/source coordinates, not new opaque EntityIDs. The #348 normative model remains the identity contract, with fresh opaque IDs persisted in a durable registry rather than rederived from path/order/title.

Suggested invariant: maintain separate canonical chapter-file materialization, available candidate refs, access status and publication status. A placeholder may have available noncanonical fragments and unavailable private full prose simultaneously. Neither an admission denial nor an unavailable file removes a literary slot from editorial existence. No access/publication state should be inferred from text emptiness or public branch existence alone.

No tests of code were run in this source-audit subtask. Results describe inspected structure and documented scope, not prose acceptance, factual verification or completeness of inaccessible material.

## Inspected open PR heads

| PR | Branch | Exact head | Public payload classification |
| --- | --- | --- | --- |
| #319 | `writing/interiority-r01` | `5e936adb132d22d8f0d5c41799591896535abd21` | Public manuscript/candidate proposals; draft, unreconciled |
| #122 | `writing/55-development-r01` | `ff0499bd341de12a31b355b79867b547f19d9b16` | Approved SOC source corpus, candidates and metadata; full book remains private |
| #121 | `writing/54-interlude-r01` | `b3f6d06a750729e462d89d6d21d4a00c7f994c5b` | Progress/structural receipt only; actual chapter/movement prose remains private |
| #120 | `writing/51-a-different-last-page` | `103ae503d9f41cd54c38da9397ed66b3f0040796` | Progress/structural receipt only; actual chapter/movement prose remains private |
| #118 | `writing/50-under-the-pantocrator-draft` | `5d2c71bb8b503c08627ff79a70fcdcf92fdb40a0` | Progress/structural receipt only; actual chapter/movement prose remains private |
| #117 | `writing/49-four-chambers-draft` | `da12db289fc99932bd03ad769dffe13f75f2df74` | Progress/structural receipt only; actual chapter/movement prose remains private |
| #97 | `writing/96-identity-recognition-correction` | `1c3a9d57064dd88d910436c09194c70c37fd5762` | Progress/structural receipt only; actual chapter/movement prose remains private |
| #95 | `writing/48-twelfth-chapter-draft` | `3e473dde595c670a6c3df13a76e742f3b9793fe3` | Progress/structural receipt only; actual chapter/movement prose remains private |
| #94 | `writing/47-eleventh-chapter-draft` | `3a244a22fbb24245b8ea5551647385122e92e6cf` | Progress/structural receipt only; actual chapter/movement prose remains private |
| #93 | `writing/46-tenth-chapter-draft` | `b99d6286ac562d7f4234a518453abd15f0331f83` | Progress/structural receipt only; actual chapter/movement prose remains private |
| #92 | `writing/45-ninth-chapter-draft` | `e450f2d8827202f36da8a5135c99ad35ae2da967` | Progress/structural receipt only; actual chapter/movement prose remains private |
| #91 | `writing/44-eighth-chapter-draft` | `a28a3a565b0d7f74fc880fb1cba0537fac09863f` | Progress/structural receipt only; actual chapter/movement prose remains private |
| #90 | `writing/53-preamble-revision-r01` | `f85fa655e3ebe9a3709bb25e1b76450bbd702a2a` | Progress/structural receipt only; actual chapter/movement prose remains private |
| #89 | `writing/43-seventh-chapter-draft` | `ab6f9f22a6c94a35c407619a5097a03078827340` | Progress/structural receipt only; actual chapter/movement prose remains private |
| #88 | `writing/42-sixth-chapter-draft` | `b7f39d41c2d00e07e6727921aba0134e87feb6ce` | Progress/structural receipt only; actual chapter/movement prose remains private |
| #87 | `writing/41-fifth-chapter-draft` | `1e9833c7df4157e87c8175fbfc06b055c7b08cbf` | Progress/structural receipt only; actual chapter/movement prose remains private |
| #86 | `writing/40-fourth-chapter-draft` | `86dab6c4592015ee5d465fb5b25ae411606295e2` | Progress/structural receipt only; actual chapter/movement prose remains private |
| #85 | `writing/39-third-chapter-draft` | `8eae727739e4b95a9b80bcff5091ca706f2249e4` | Progress/structural receipt only; actual chapter/movement prose remains private |
| #84 | `writing/38-second-chapter-draft` | `2c289001ce81039065b9c092fea4ac6084396d06` | Progress/structural receipt only; actual chapter/movement prose remains private |
| #83 | `writing/37-first-chapter-draft` | `6be7c5a61d4b2c10b95ad10186de8ac10715bae4` | Progress/structural receipt only; actual chapter/movement prose remains private |
