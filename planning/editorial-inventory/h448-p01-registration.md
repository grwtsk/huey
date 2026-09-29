# H448-P01/r1 support-source registration

Bounded engineering integration under [#441](https://github.com/grwtsk/huey/issues/441),
separate from the exact five-file prose staging in [#461](https://github.com/grwtsk/huey/pull/461).
Working draft; claim verification incomplete. Registration is not manuscript
acceptance, adopted first-person testimony, final placement or promotion authority.

## Exact source and operation

The single new registry source is `h448-p01-r1`, role `support`, extent `full`,
with `targets: []`. Here `full` describes the complete selected flow artifact;
it does not mean a complete or accepted chapter. Its pin is:

- Revision: `1769ec26df3bc30ea309d102912dd63f78a10227`.
- Path: `manuscript/flow/h448-p01-cooper.md`.
- Git blob: `2423bebc56fe75d44b4ce0b724d2dc0924b5b65e`.
- Public scope: [H448-D01](https://github.com/grwtsk/huey/issues/2#issuecomment-5886827528), #461 and #441.

The previous 45 source records, all 47 slots, containers and `supportPaths` are
unchanged. No slot or EntityID is allocated. The existing schema admits a
manuscript support source only under `manuscript/flow/`; `supportPaths` remains
limited to structural READMEs. Neither a wildcard nor a checker exception is added.

Source references are provenance pointers, not permission capabilities. The
author's exact staging authorization was inspected separately. H448-D01 and the
continuing narrator-service condition are not enlarged by the registration.

## Verification boundary

The repair branch contains metadata, regression tests and this note, not copies
of #461's five files. A disposable archive and isolated Git index combine the
repair tree with #461's exact files for local integration checking. No branch
merge, worktree registration or promotion is performed by that check. The exact
repair commit and combined test-tree identity are recorded in the PR receipt.

`tests/editorial-inventory.test.mjs` checks the actual H448 registration with the
new path explicitly in `trackedPaths`: removing the registration fails; adding
the support source passes without changing slots or ownership or reading the
flow prose. A separate temporary-Git fixture reproduces the transition from
untracked to tracked, verifies the source pin, and rejects a nonempty target.
The existing strict shape, path and source checks are retained.

The actual combined candidate passes inventory with 46 public source references.
Independent SHA-256 comparison preserves all five authorized files and bundle
`ec6208714f3f69d3d8db947227c27846c53fee041b005010cac6cf2ee43ea56e`.
Book configuration, reader manifest, C08A and the page plan remain byte-identical;
inventory slots and ownership and actual `scripts/book.py emit` output are unchanged.
These byte checks are separate from registry validation: a support-source pin
check does not inspect or certify current working-copy support prose.

## Next failure, not complete assembly

After registration, `node scripts/editorial_pages.mjs check` reaches
`EDITORIAL_PAGES: source role differs from placement`. The known canonical
front-matter sources encounter an assembler requirement for group `book`.
This is the inherited next failure, now freshly reached on the combined candidate.

#441 remains open for front-matter handling, stable source/page reconciliation,
historical routes, P01/P02 coverage and the remaining downstream checks. No page
or route identities are regenerated, no canonical placement is assigned, and no
complete editorial-build pass is claimed. The author's promotion plan and its
attributable decisions remain separate; no merge or promotion is performed here.
