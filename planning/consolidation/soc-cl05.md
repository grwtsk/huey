# CL05 public integration receipt, indexes and checker

Work: [#433](https://github.com/grwtsk/huey/issues/433), following #431/#432.
Staging base: `3e3e7a2a1cdb2c2ea82d37bd5c2c1d5abb178d50`.
Selected public source: draft PR #122 at
`ff0499bd341de12a31b355b79867b547f19d9b16`.

## Exact selection and source scope

[soc-cl05.json](soc-cl05.json), model `huey.soc-cl05.v1`, pins four unchanged
files under `planning/standard-of-care/care-law/`: `integration-r05.md`,
`integration-r05.tsv`, `integration-r05-retained.tsv` and
`verify_integration_r05.py`, totaling 42,903 bytes. The two indexes describe
changed and retained units separately. No private manuscript, claim text, span,
fingerprint, predecessor archive or source note is imported. CL06–CL13 stay separate.

The original SOC-PUBLIC-01 author instruction, recorded in
[#2](https://github.com/grwtsk/huey/issues/2#issuecomment-5771600544), covers this
associated public apparatus; #177 records its Huey destination correction. The
current author request supplies the bounded consolidation task. A reference,
username, public branch, checksum or successful test cannot authenticate authority,
grant permission or establish source support.

## Changed and retained public indexes

The changed-unit index has 78 ordered `HUEY-CL05-U001–U078` rows across eleven
`CL05-E01–E11` groups of 5, 8, 5, 5, 8, 4, 11, 8, 9, 9 and 6. Its owners are
#185 (51 rows), #184 (16) and #183 (11). Types remain argument, request, metaphor,
interpretation, ethics, question, hypothesis, theology, law, scope, literary-source,
source-description and editorial; none becomes a finding by being indexed.

The changed rows contain 182 references to ten aliases and 86 references to 51
distinct `HUEY-CARELAW-01:C001–C256` IDs across 64 rows. Fourteen rows explicitly
use `-` for no C mapping. This does not mean missing evidence or omitted prose.

The retained index has 189 ordered `HUEY-CL05-R001–R189` rows in 44 `CL05-P`
paragraph groups. P011/P026/P038/P039 are absent from this retained census because
the historical receipt records their replacement. They are not silently omitted
material or currently retired literary entities. Owners are #185 (160 rows) and
#50 (29). The retained index has a `review_state` column rather than `carelaw_ids`;
it supplies no additional C mappings.

Both indexes use the historical chapter coordinate 14 and the column `passage`
for their different edit/paragraph references. Under #404, those coordinates
and original paragraph ordinals are working locators, not stable literary identity.
The 267 total rows account for the historical public census, not a newly verified
complete current chapter or book. Exact text and spans remain private.

Retained aliases occur in 300 references to B/M/L17/W03. Across both indexes,
eleven aliases occur in 482 references: A/B/M/L17 and W01–W07. W03 appears only
in the retained index. Multiple addressed source copies remain one source family,
not independent corroboration or evidence of delivery. The aliases are never
opened as paths or converted into evidence certificates or paragraph bindings.

## Preserve the unresolved source lineage

R089–R092, all in P023, retain `personal-declaration-lineage-pending`, owner #50,
source B only, and `retained-source-lineage-open`. The original declaration's
author source was not recovered in that historical pass. Its predecessor lineage
must neither become original-source authentication nor disappear as an error.
A search miss does not prove that the source is absent or permit invented prose.

The other 185 retained rows say `retained-source-scoped-review`. This is historical
review metadata, not authenticated human approval, factual clearance or current
publication admission. The new checker preserves the exact four open rows and
their relationships; it cannot perform the source comparison or resolve #50.

The supplied meditation remains personal source material, distinct from a signed
historical declaration, universal doctrine, clinical prognosis and compulsory
forgiveness. Professional ethics, legal applicability and literary analogy retain
their different status. The historical icon image/catalogue/location checks were
not performed. No new source retrieval or image inspection occurs here.

## Historical work and archived code

The receipt describes eleven private-candidate edits: eight insertions and three
replacements affecting four paragraphs. It reports 45,640 → 46,804 words (+1,164),
48 original paragraph dispositions, 44 exact retentions, preservation of 226
earlier integration units, and a cumulative 116/256 C adaptation mappings with
140 remaining. These are historical results, not current manuscript measurements
or checks. Later progress under #186 and prior reconstruction limits remain visible.

Seven September 22 primary-text inspections remain dated research receipts.
Digital Dante and an initial regulation route failed; alternative resources were
reportedly read. The source text's currentness does not settle historical or
case applicability. No fresh legal, medical, theological or literary research
is claimed by this public preservation.

The archived verifier requires a private packet. It resolves and confines its
claims-file, baseline and candidate reads under that selected root, but reads
whole files without resource limits. It does not read either public TSV or verify
the predecessor archive/its sixteen manifest entries. The latter verification
was separate historical work. The new wrapper never imports or executes the
archived verifier; all twenty-two original mutation cases remain unrun. Syntax
parsing does not reproduce those checks or authenticate source provenance.

## Current public checks and evidence handoff

```sh
python3 scripts/soc_cl05.py
python3 scripts/soc_cl05.py --source-objects
python3 scripts/soc_consolidation.py
python3 scripts/soc_consolidation.py --source-objects
python3 -m unittest discover -s tests -v
```

The public wrapper pins all four files before checking strict index shapes,
ordered disjoint unit IDs, edit/paragraph membership, chapter coordinates, kinds,
owners, aliases, C references and retained states. Fixed public paths and
reason-only diagnostics keep index values out of file reads and error text.
Source-object mode compares available public Huey Git objects without fetching.
No private-packet, export or source-service interface is added.

The cumulative gate requires all eight slice validators and exactly 87 files:
85 exact copies and two adapted navigation pages. Six earlier slice manifests
remain byte-identical. CL04 now validates its fixed historical navigation receipt;
CL05 binds the current endpoint. There is no directory exemption for later files.
Actual commands/results belong in the PR receipt. Copy/index checks do not prove
complete clause coverage, literary or factual correctness, authority or acceptance.

New evidence still follows the [intake protocol](../evidence-intake/README.md),
its policy/worker instructions and [vault handoff](vault-handoff.md). Restricted
raw remains private; reviewed public certificates and permitted derivatives cross
the existing boundary. Missing private configuration never causes public fallback.
Supporting, contrary, limiting, contextual and source-family relations retain
separate review. The certificate schema/index are unchanged. No evidence was
received, no certificate created, no vault queried and no service/watch activated.

## Dependencies and next bounded slice

#186 retains exact current manuscript/span/source reconciliation. #50/#28 retain
the declaration-lineage, chapter and theological-reference questions. #145/#176
retain complete proposition/apparatus coverage and substantial support;
#178–#185/#187 retain specific facts, contrary material, chronology, applicability
and competent review. #2/#3/#5/#11 remain their respective disclosure, unresolved
memory and human acceptance gates. They block those stages, not already-authorized
public preservation. Only #433's consolidation may close; #122 remains draft/open.

Next separate slice: CL06's four public receipt, changed-unit index, paragraph
index and checker files after dependency review. No continuation is launched.
RF-01, PR-01 and the three movements remain unchanged. No new disclosure beyond
the recorded scope, evidence clearance, manuscript acceptance, main promotion,
deployment or edition release occurs here.

Disclaimer: Working draft; claim verification incomplete; not medical/legal
advice or adjudicated findings.
