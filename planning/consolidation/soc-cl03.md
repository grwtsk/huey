# CL03 public integration receipt, index and checker

Work: [#429](https://github.com/grwtsk/huey/issues/429), following #427/#428.
Inspected staging base: `94893a187cf83f44868563da3b9d0b98d7f30d5f`.
Selected public source: draft PR #122 at
`ff0499bd341de12a31b355b79867b547f19d9b16`.

## Exact public selection

[soc-cl03.json](soc-cl03.json), model `huey.soc-cl03.v1`, pins exactly three
unchanged files under `planning/standard-of-care/care-law/`, totaling 24,456 bytes:
`integration-r03.md`, `integration-r03.tsv` and `verify_integration_r03.py`.
The receipt links the index and historical private-packet checker. No private
baseline, revised narrative, changes-and-claims file, source note or packet is
part of this selection. Later CL04–CL13 files remain deferred.

The original SOC-PUBLIC-01 author instruction, recorded in
[#2](https://github.com/grwtsk/huey/issues/2#issuecomment-5771600544), and the
explicit Huey recovery direction in [#177](https://github.com/grwtsk/huey/issues/177)
cover this named derived apparatus. Current scope is the author's requested
consolidation, not new manuscript integration. Public visibility, a URL, an
approval label or a hash does not supply authenticated authority. The public
reference locates the original instruction; it is not an Instruction/Grant.

## What the public index can establish

The exact six-column TSV retains 109 ordered `HUEY-CL03-U001–U109` rows, eleven
`CL03-E01–E11` edit groups and nine Huey owners (#178–#186). Group sizes are
7, 9, 24, 9, 12, 5, 4, 10, 8, 13 and 8. These are historical editorial IDs,
not new literary EntityIDs, evidence certificates or current paragraph bindings.

The original types remain 44 argument, 15 request, 12 law, nine question, eight
interpretation, six source-description, five scope, three policy, three ethics,
two hypothesis, one testimony and one editorial unit. They are classifications
in a source-neutral index, not independently verified facts or atomic clauses.

Thirteen source aliases occur in 164 references: A/B for author direction and
the identified baseline; L17/L10/N09 for the already-described source families;
W01–W08 for the eight public authorities listed in the receipt. No alias is opened
as a locator. Multiple addressed copies remain a source family, not independent
corroboration, dispatch, delivery or receipt.

Seventy-eight C-ID references across 53 rows identify 65 distinct members of
`HUEY-CARELAW-01:C001–C256`; 56 rows use the explicit `-` marker for no C-ID mapping.
That marker does not mean absent evidence, omitted prose or a missing literary
entity. These relationships are kept separate from SOC/ANC/Q03/incident totals.
The public index has no exact manuscript wording, private spans, locators or
fingerprints. It cannot establish actual source support or current placement.

## Historical work, current boundaries

The September 22 CL03 delivery receipt describes eleven private-candidate edits
(three insertions and eight replacements) in the then-current Chapters 10–11,
109 new/rewritten units and 65 selected C-unit adaptations. Its word comparison
42,059 → 43,830 (+1,771), eight source inspections, twelve rejected mutations,
37 retained quotation occurrences and outside-chapter preservation are historical
reports. They are not measurements, source reads or manuscript checks performed
by this consolidation. The remaining 191 C units described there belong to that
checkpoint; later CL04–CL08 integration recorded in #186 is not erased.

The receipt explicitly describes reconstruction from rendered Files text when
raw-byte materialization was unavailable. This limitation remains unchanged;
matching the public receipt does not authenticate the private baseline. Likewise,
its headings “Fresh primary-source checks” and “Actual manuscript work” refer to
that earlier pass. Current legal applicability, private originals and those eight
external authorities were not checked here. Existing policy-access limits and
contrary material are preserved.

The current [pre-release policy](../pre-release.md) governs this scoped PR rather
than historical instructions to resume the whole development PR. #122 remains
draft. #404 governs mutable chapter projections; the old chapter numbers are
historical coordinates, not current assignments. No manuscript, ReadingPage,
route, admission or reader evidence binding changes.

The original checker requires `--packet` and reads its private baseline, candidate
and claim records. It does **not** read the TSV. It also trusts packet-selected
filenames without path containment; it is preserved historical tooling, not the
public intake facility or a safe interface for untrusted packages. This pass
neither imports nor executes it, and does not fabricate a packet to claim its
twelve original mutations passed. New public tests exercise the new wrapper only.

## Current checks and evidence handoff

```sh
python3 scripts/soc_cl03.py
python3 scripts/soc_cl03.py --source-objects
python3 scripts/soc_consolidation.py
python3 scripts/soc_consolidation.py --source-objects
python3 -m unittest discover -s tests -v
```

The new wrapper checks fixed byte pins, declared historical limits, strict TSV
structure, IDs, edit groups, types, owners, source aliases and C-ID membership.
Its inputs are fixed public paths; it has no private packet, root override or
export option. Diagnostics do not print submitted content. Available public Huey
Git objects may be compared with `--source-objects`; no network fetch occurs.
The cumulative gate requires exactly **80 selected files**, 78 exact copies and
two adapted navigation pages, and all six slice validators. All four predecessor
slice manifests remain unchanged; the CL03 receipt extends the care-law navigation
transition. No directory exemption admits later files.

These are copy/index consistency checks, not source authentication, complete
clause coverage, factual or literary correctness, private manuscript preservation
or human acceptance. Actual commands, tested version, results and unavailable
checks belong in this PR's receipt; old test statements remain historical.

New evidence still follows the current [intake protocol](../evidence-intake/README.md),
policy/worker instructions and [vault capture/export/reverse-receipt handoff](vault-handoff.md).
Restricted raw remains private; its reviewed public certificates and permitted
derivatives require the existing boundary checks. Public objects follow their
own whole-object classification. Missing private configuration never causes
public fallback. The certificate schema and public evidence index are unchanged.
Retain separately reviewed supporting, contrary, limiting, contextual and source
family relationships; an alias or new deposit does not resolve a claim.
No evidence, certificate, source service, outside contact or watch is created.

## Remaining work

#186 retains exact current candidate/span/provenance reconciliation; #46/#47
remain open for their chapter work. #178–#185/#187 retain source, chronology,
clinical/communication, institutional, applicability and notice questions.
#145/#176 retain complete clause/apparatus coverage and substantial support.
Private-packet disclosure and human acceptance remain their respective #2/#5/#11
gates. These do not block already-authorized public-file preservation and are not
satisfied by it. RF-01 preserves testimony and separately attributable accounts,
including contrary material; PR-01 remains untouched.

Only #429's bounded consolidation may close. Next separate slice: CL04's public
receipt/index/checker after dependency review; its private-packet checks require
their own exact inputs and authorized scope. No continuation is launched. Main
remains held for exact-version journalistic review and an actual human decision.
No new source disclosure outside the recorded scope, manuscript acceptance,
evidence clearance, main promotion, deployment or release occurs here.

Disclaimer: Working draft; claim verification incomplete; not medical/legal
advice or adjudicated findings.
