# Front matter and P01/P02 assembly reconciliation — #441

WORKING DRAFT — CLAIM VERIFICATION INCOMPLETE.

This engineering change makes the existing selected public sources readable in
assembly. It changes no manuscript, inventory selection, admission, evidence,
`book.yaml`, or route binding. #441 remains open; this is not manuscript acceptance,
final placement, merge authority, main promotion or edition release.

## Exact baseline and explicit intake

Baseline: `664f9b62d70d7f24e2519918357ec262d86eb6c4` on `pre-release`.
The prior page-plan blob is `b095207b23733f373b5127f3cf2d541f6a12248a`;
the reconciled plan blob is `9b9911fde421ac39dabbfedb972e17e224b353ce`.
The plan was extended explicitly. `init`/`createPlan` was not used to regenerate
it. Its five prior source records, all 1,915 existing block mappings and all
165 prior page IDs are retained. The 161 unaffected pages keep their exact
memberships. All 54 inventory entity IDs and all 90 route aliases are unchanged.

These four sources already have canonical selection and public scope references
in the unchanged inventory. Their exact path/revision/blob triples are stored in
[the plan](plan.json) and checked against the registry and Git objects.

| Source key / slot | Source revision | Source blob | New blocks / Paragraphs | Pages after intake |
| --- | --- | --- | --- | --- |
| `public-38` / `front-preface` | `b223607addfbc96d8e0250bbb65f0c2b9809c790` | `38cb27c6174e0931741d59de7b7db6251a17a285` | 81 / 74 | 6 |
| `sequential-fm01-title` / `front-title` | `b223607addfbc96d8e0250bbb65f0c2b9809c790` | `cb56c8fdc69752cea1fff1381353038dfc626e3a` | 2 / 1 | 1 |
| `sequential-p01` / `C01` | `382157ef57867adb9f601ed69bccb6dbc829700d` | `a3524efe6a57739e324f8eecda7566b9378b08ed` | 65 / 61 | 5 |
| `sequential-p02` / `C03` | `2cddcde90be5442a57abffd2c0e8191c49429c5e` | `ce398b063a82358a9d21531dada4e85eed5f573b` | 77 / 71 | 5 |

The baseline has no block mappings for these four sources. Their 225 block IDs
are new occurrence identities, not identities inferred from earlier prose or
from equal text. Each first page keeps its prior ID, replacing its single
container reference with selected source blocks. Thirteen additional page IDs
were allocated once, with sixteen-block boundaries for these first materializations.
No existing materialized source was repartitioned. These are reviewable working
navigation boundaries, not final book pagination or chapter adoption.

| Slot | Retained container ID | Retained first page ID |
| --- | --- | --- |
| Title | `he_ec94cf6d-d549-4d50-8f78-7aa954ca2ac3` | `he_b3e840bc-7a2b-49fc-bbee-c1b14d025803` |
| Preface | `he_715292cf-9c17-4707-abad-df8c3de7b737` | `he_3ba7abbe-27a7-4810-ad87-61054157d476` |
| P01 / C01 | `he_691f99fa-fb98-4a4e-a05c-124913e827a6` | `he_92a4658e-94a7-4a83-a6aa-18b50c55abe2` |
| P02 / C03 | `he_e7053ccc-323d-40b2-9b80-b4b7497d8e4a` | `he_7f1c4d0d-a725-44db-b86e-d36e8fe276c9` |

Removing the thirteen new IDs from reading order reproduces the baseline order
exactly. Front matter occupies twenty pages across the same fifteen MatterUnits;
Body still begins at C01 in Preamble. The result has 164 ordered pages, fourteen
unplaced pages, 2,140 blocks (2,067 Paragraphs), and 2,372 entity records. The
existing three movements and protected close are untouched.

## Historical sources and versioned routes

The former preface remains pinned at
`26447f857fbf85e5a28b0b3367a414533262d89f:manuscript/front/preface.md`, blob
`7c5b87446e97c2666054d915f52252d989201aa8`. Its intact prior registry and explicit
supersession are preserved in [P01's reconciliation](../sequential-review/P01.r1/inventory-reconciliation.md).
There were no earlier preface paragraph identities in this page plan; this
change does not invent correspondence between the old and revised wording.
[P02's source receipt](../sequential-review/P02.r1/inventory-reconciliation.md)
also remains unchanged. The date rewrite under #442 is not performed here.

The four continuing first pages receive new EntityVersions because their
memberships change; their stable addresses and old readable aliases retain their
IDs. An address requesting an old placeholder page version returns
`version-unavailable` in the current projection, never current prose under the
old version. Historical reconstruction still requires selecting its permitted
historical snapshot; this change does not create an archive service or a route
that silently redirects exact old wording to new wording. All unaffected page
versions and existing block versions remain unchanged.

The combined author/source-note and advisory remains one candidate source with
two target references. Both slots stay present/partial with no selected children.
Assembly loads neither copy; routes now explicitly report those empty selected
projections as unresolved. Materialized partial sources retain their existing
behaviour. Component range selection remains a separate obligation under
#35/#349/#370; no split, duplicated text or promotion is invented.

## Verification and subsequent source changes

`npm run test:pages` now includes an exact migration regression. It compares the
candidate with the pinned baseline plan, checks source objects, retained IDs and
versions, changed memberships, old alias targets and exact-version misses. The
synthetic page suite checks compatible front/back MatterUnits, body Chapters and
unplaced Chapters; bad paths, roles, kinds and ambiguous targets still fail.
Unavailable sources retain their IDs without reading their bytes.

The paragraph bridge still requires an admitted path/blob, exact occurrence,
raw wording and EntityVersion. Only the existing 260 C08A bindings are produced;
new front/P01/P02 blocks inherit none. Candidate/support sources remain excluded
from selected-source materialization. The separate #462 support registration and
#461 five-file H448 draft are tested as a combined tree in the PR receipt; neither
is imported into this engineering diff or adopted into reading order.

For another already authorized source intake: pin the actual starting plan;
identify exactly which existing selected mappings and pages continue; supply
explicit new block/range/page assignments only for genuinely new occurrences;
and compare the complete resulting plan and source scope before running the
same inventory, assembly, route, traversal and paragraph gates. Never rerun
initial allocation over existing material. Changes to existing wording require
reviewed occurrence correspondence, not source-key equality. The unfinished
[#377 correspondence API](https://github.com/grwtsk/huey/pull/377) addresses
ordinary revisions of existing occurrences; this intake does not duplicate or
silently merge it.

Actual candidate commits, combined-tree identity, test commands, browser results
and any remaining failures are recorded in the PR receipt. #441 remains open
for its complete review; historical archive serving and shared-candidate range
selection are not implemented. #438 orientation and #442/#443 source corrections
remain separate. No build result fulfills the narrator's continuing compositional
obligation or settles H448 manuscript acceptance and final placement.
