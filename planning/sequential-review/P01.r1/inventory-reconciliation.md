# Inventory reconciliation during P01.r1 incorporation

The hosted editorial inventory check for PR #83 at head `382157ef57867adb9f601ed69bccb6dbc829700d` stopped at an unclassified tracked file, `manuscript/front/01-title-page.md`. That file and the combined author-note/advisory were introduced by the already approved FM-01.r1 commit #439; the active registry had not been reconciled. C01 now also requires a pinned canonical source. This follow-up changes metadata, not prose, under the author's instruction to update affected manuscript/source records.

The complete prior active registry remains unchanged at [editorial-registry-before.json](editorial-registry-before.json), Git blob `b721017b4ed6cf1d2cb2ecde305fb21fc4b3e41d`.

## Exact changes

- Preserve all stable entity IDs and all unaffected slots, source pins, and support paths.
- Mark the title, author/source note, and reader advisory as present staged content, not pending unwritten matter. Final packaging acceptance remains distinct.
- Pin the title to its exact #439 source and the new C01 to the exact approved P01.r1 source.
- Update active source `public-38` from the former preface at `26447f857fbf85e5a28b0b3367a414533262d89f` / blob `7c5b87446e97c2666054d915f52252d989201aa8` to approved FM-01.r1 at `b223607addfbc96d8e0250bbb65f0c2b9809c790` / blob `38cb27c6174e0931741d59de7b7db6251a17a285`. This is an explicit active-source supersession, not a claim that the old preface always said the new words. Both its original source and the former registry are preserved.
- The author/source note and advisory are one approved file, not two separate canonical objects. The existing registry supports a shared candidate source but requires each canonical source to have one parent. Therefore one exact combined source is linked to both matter slots as a candidate; component materialization remains partial rather than inventing a split, duplicating the file, or rewriting approved wording. The canonical Markdown file itself is unchanged. More granular assembly remains #35/#349/#370 work.
- Optional dedications, half-title, rights declarations and other unresolved matter remain pending; no omission or final author choice is inferred.

No test or validator is weakened. The original 53 literary-model tests passed in the first hosted run; the inventory check did not. Later check results and merge outcome must be recorded in the PR discussion only after they occur. Source pins identify public bytes, not evidence truth or independent authorship authentication.
