# SOC core consolidation into staging

Work: [#406](https://github.com/grwtsk/huey/issues/406), following #384/#385.
Inspected staging base: `26447f857fbf85e5a28b0b3367a414533262d89f`.
Selected public source: PR #122 at
`ff0499bd341de12a31b355b79867b547f19d9b16`. The author's current request selects
one bounded consolidation of the authorized corpus and claim apparatus.

## Selected material and recorded scope

[soc-core.json](soc-core.json) records 36 original paths, source Git blobs and
staging dispositions. The slice contains 23 source paths, 11 immediate planning
paths, the commit notice template and the claim issue template:

- twelve authored prose-field exports;
- two assistant-prepared conversation drafts and the earlier context synthesis,
  with representation/citation limits;
- the complete normalized Atlas and its reference notices;
- the historical first-transfer manifest, source instructions and navigation;
- SOC-PUBLIC-01's recorded scope and 188 original claim targets, 19 verification
  owners, 30 argument links and 111 substantial-support flags;
- the existing read-only claim/support checkers and 24 synthetic tests.

Thirty-four imported files retain their exact public branch bytes. Only
`sources/standard-of-care/README.md` and `planning/standard-of-care/README.md` are
adapted navigation. The manifest pins both original and staged blobs for those
pages; their changes explain this slice, link deferred layers at exact revisions,
and distinguish historical test receipts from this PR's checks. No source prose,
claim wording, owner or support level is revised.

The scoped public-copy instruction is recorded in
[#2](https://github.com/grwtsk/huey/issues/2#issuecomment-5771600544) and preserved
in [AUTHORIZATION.md](../standard-of-care/AUTHORIZATION.md). That exact scope is
already authorized; no renewed approval is requested. These links and the
historical `approval.json` are permission-context records, not authenticated
runtime grants. Neither a checker nor a hash establishes authority or source truth.
Raw clinical originals, private evidence and unrelated private manuscript remain
outside this transfer. No private repository or external source is accessed.

## Integrity and representation limits

```sh
python3 scripts/soc_consolidation.py
python3 scripts/soc_consolidation.py --source-objects
python3 -m unittest discover -s tests -p test_soc_consolidation.py -v
python3 planning/standard-of-care/check_registry.py
python3 planning/standard-of-care/check_support.py --message-file .gitmessage
python3 -m unittest discover -s planning/standard-of-care -p 'test_*.py' -v
```

The optional source-object check uses already available public Git objects; it
never fetches private stores. It must fail if required original objects are
unavailable, rather than silently claim a comparison. Normal checks bind selected
bytes, coverage and retained claim/support declarations. Hosted checks run the
public consolidation, claim checks and both Python test locations. No Git hook,
local commit-template setting, permission engine or auto-import is installed.

Matching a staged file to its public PR #122 blob verifies **this copy**. It does
not compare the manually exported prose to the original private presentation
JSON, repeat the earlier Atlas reconstruction, authenticate testimony, verify a
citation's meaning, or complete an atomic-claim audit. Historical transfer
manifests retain their original branch names, counts, pending lists and source
inspection statements. They are not fresh execution receipts.

Claims remain `open-unverified`; coverage and automatic verification remain false
under the existing schema. Support levels identify review needed, not confidence
scores or findings. Testimony, recollection, reported records, assistant drafts,
normative reasoning, metaphor, hypotheses and contrary evidence stay attributable.
Missing corroboration does not erase a report; a source reference does not supply
corroboration. Preserve duplicate/source-family distinctions when adding evidence.
No claim-to-reader binding or certificate is created by this consolidation.

Current RF-01, title/PR-01, Human–System direction and working chapter projections
govern later adaptations. Historical source directions and earlier publication
metadata do not override them. The source layer is not a second canonical
manuscript; candidate chapter joins remain proposals. Existing literary IDs,
source pins and reading order are retained, not recalculated from these copies.

## Narrow preface baseline correction

Before this work, #403 had added `manuscript/front/preface.md` to staging without
classifying it in the inventory. The unchanged base failed `npm run test:inventory`
with `unclassified tracked manuscript`. This PR registers that already authorized
public file as a pinned, full **candidate reference** on the existing front-preface
MatterUnit. Coverage now permits an explicitly targeted front/back MatterUnit
candidate under its matching manuscript directory; unregistered paths, ambiguous
classifications, wrong groups, chapter targets and implicit ingestion stay invalid.

The preface's stable EntityID and existing ReadingPage remain unchanged. Presence
is `present` and source access is available; working publication metadata remains
non-authoritative. The derived inventory describes an available uncompiled
reference, not fully rendered prose. The page still has no selected source or
paragraph mappings. This is coverage repair only: no preface text, page plan,
reader admission, compiler ingestion or final front-matter acceptance changes.
Selection and materialization remain later #349/#353/#370 work.

## Deferred work and promotion

[The core source index](../../sources/standard-of-care/README.md) links the exact
incident, ancillary, authority and care-law layers still on #122. This pass does
not absorb them or the developmental manuscript revision. The broader PR stays
draft; historical instructions to continue its work do not make this entire
branch eligible for a bulk merge.

#126/#127 retain original representation comparison, conversation completeness
and citation repair; #145/#176 retain source-unit/atomic-claim and substantial
support review. #193/#306/#307 retain incident reconciliation and actual intake.
#314 retains exact manuscript/evidence bindings. No one of those issues is closed
by a source copy. The next coherent slice is the ancillary source/review pair,
with its own source-status and lineage checks.

Promotion to `main` remains held pending the exact-version journalistic review:
source/support/contrary material, uncertainty, rights/privacy, response opportunity,
qualified review where required, and an actual human editorial decision. No
manuscript acceptance, evidence clearance, source-service activation, deployment,
outside contact or edition release occurs here. Structural checks establish only
the stated software and copy-integrity invariants.

Disclaimer: Working draft; claim verification incomplete; not medical/legal
advice or adjudicated findings.
