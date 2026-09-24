# Huey

Author: R.A. Jacob Martone.

> **WORKING MANUSCRIPT — CLAIM VERIFICATION INCOMPLETE.** Check-in is not independent factual verification or release of a finished edition. See the repository [notice](../README.md) and [chapter check-in #308](https://github.com/grwtsk/huey/issues/308).

## Working chapter order

The original fifteen chapter IDs retain their order. The working structure now has five stable insertion IDs: **C02A**, **C08A**, **C12A**, **C14A**, and **C14B**. C08A is the admitted middle-book chapter **Baptism in the Color of Rain**. C14A and C14B are author-directed public working chapters, staged here without implying final-edition acceptance or promotion to `main`. C02A and C12A remain structural placeholders only: the author has identified their subjects as the death of his mother and his rape, respectively, but has supplied no final literary title or public manuscript prose for either slot.

The author has also clarified that three of the five previously registered experiential pieces are already captured within C08A. They are not duplicated as extra chapter slots. The two remaining experiences stand at meaningful distance from C08A and reflect it without being made equivalent to it or used as automatic causal explanations. The working relation is **C02A → distance → C08A → distance → C12A**. Exact EX-01–EX-05 identity reconciliation remains pending against the private register rather than being guessed from the source-neutral public inventory.

This index records structure, not final-edition acceptance. C08A retains its existing public admission; C14A and C14B are staged public working prose under [#378](https://github.com/grwtsk/huey/issues/378); C02A and C12A remain comment-only placeholders. The three movements and the protected C15 → movement break → Edna closing sequence remain unchanged.

### Preamble

| Stable ID | Chapter | Work issue |
|---|---|---|
| C01 | The Feather | [#37](https://github.com/grwtsk/huey/issues/37) |
| C02 | A Life Already Under Way | [#38](https://github.com/grwtsk/huey/issues/38) |
| C02A | *Untitled experiential chapter — mother's death* (working descriptor) | [#322](https://github.com/grwtsk/huey/issues/322) |
| C03 | The Room | [#39](https://github.com/grwtsk/huey/issues/39) |
| C04 | The Other Person in the Room | [#40](https://github.com/grwtsk/huey/issues/40) |
| C05 | The Note That Arrived First | [#41](https://github.com/grwtsk/huey/issues/41) |
| C06 | One Physician, Two Chairs | [#42](https://github.com/grwtsk/huey/issues/42) |
| C07 | A Page of My Own | [#43](https://github.com/grwtsk/huey/issues/43) |

### Interlude

| Stable ID | Chapter | Work issue |
|---|---|---|
| C08 | The Ring of Umber | [#44](https://github.com/grwtsk/huey/issues/44) |
| C08A | [Baptism in the Color of Rain](02-interlude/baptism-in-the-color-of-rain.md) | [#308](https://github.com/grwtsk/huey/issues/308) |
| C09 | The Possibility of a Feather | [#45](https://github.com/grwtsk/huey/issues/45) |
| C10 | The Instruments Already in the Room | [#46](https://github.com/grwtsk/huey/issues/46) |
| C11 | Insufficiently Examined | [#47](https://github.com/grwtsk/huey/issues/47) |
| C12 | The Human Cost | [#48](https://github.com/grwtsk/huey/issues/48) |
| C12A | *Untitled experiential chapter — rape* (working descriptor) | [#322](https://github.com/grwtsk/huey/issues/322) |
| C13 | Four Chambers | [#49](https://github.com/grwtsk/huey/issues/49) |
| C14 | Under the Pantocrator | [#50](https://github.com/grwtsk/huey/issues/50) |
| C14A | [On the Eve of the Last su[p, p′, p″, p‴, …]er](02-interlude/14a-on-the-eve-of-the-last-super.md) | [#378](https://github.com/grwtsk/huey/issues/378) |
| C14B | [Orange After the End](02-interlude/14b-orange-after-the-end.md) | [#378](https://github.com/grwtsk/huey/issues/378) |
| C15 | A Different Last Page | [#51](https://github.com/grwtsk/huey/issues/51) |

The C02A and C12A labels above are working descriptors, not literary titles. Their placement is structural and remains reviewable when source-grounded drafts exist.

C14A and C14B preserve the protected closing architecture by appearing after C14 and before C15. Their public check-in records the author's current instruction to add these exact working chapters to the repository; evidence review, reader admission, main-branch promotion, and finished-edition release remain separate gates.

### Excursion: Edna

The complete existing excursion remains the narrative close under [#52](https://github.com/grwtsk/huey/issues/52). Under [#380](https://github.com/grwtsk/huey/issues/380), the public E01 file now carries only the exact author-directed classroom-question delta in its final-scene location; the surrounding supplied excursion, its existing response, and its terminal sentence remain on the protected source surface and are not reconstructed here.

## Chapter source and exact edit

The chapter file preserves the immediately preceding conversation's complete woven chapter, combining *Baptism in the Color of Rain* and *After August*. Only the first `netch` becomes `netch asheba`, retaining italics. The later `netch`, all other narrative words, paragraph breaks and eight section breaks remain unchanged. No byline, editorial warning or placement note has been inserted into the narrative itself.

The author's explicit GitHub instruction authorizes public transfer of this chapter version to grwtsk/huey. The [placement record](../planning/writing/baptism-in-the-color-of-rain.json) records the scope and content identity. It does not authorize copying other private chapters or raw clinical records, activate replication or deployment, or accept the remainder of the manuscript. Full-book assembly and measured spoken runtime remain under [#55](https://github.com/grwtsk/huey/issues/55) and [#62](https://github.com/grwtsk/huey/issues/62).

## Canonical Markdown source and expansion envelope

The canonical prose root is `manuscript/`. `book.yaml` defines ordered stable IDs and build admission; planned chapter paths contain comments only until prose is actually admitted. The narrative-body planning target is **80,000–114,000 words**: Preamble 31,000–43,000; Interlude 48,400–70,400; the supplied short Excursion remains approximately 600 and is not expansion filler.

Use `python3 scripts/book.py validate`, `list`, `count`, or `emit` (also exposed through the root npm scripts). LaTeX, HTML and reader pipelines should consume the same emitted Markdown rather than maintain parallel prose copies. Public `certificates/` contains derived certificates only; raw evidence remains outside public Git under the existing private-source boundary. See [the structural plan](../planning/word-target-and-source-architecture.md).
