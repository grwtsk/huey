# Standards, care burden and trust — staged claim apparatus

> [!WARNING]
> **WORKING DRAFT — CLAIM VERIFICATION INCOMPLETE.** This material includes attributed testimony, allegations, hypotheses, normative arguments and AI-assisted drafts. A citation, commit, issue closure or passing software test is not independent verification. Received medical assertions and subsequent assistant corrections may contain errors. This is not a clinical guideline, medical/legal advice or an adjudicated finding. Permission to copy working sources is not factual endorsement or acceptance of a finished edition.

## Ancillary consolidation update — #421

The [ancillary source/review pair](../consolidation/soc-ancillary.md) now adds
five source JSON records and the unchanged [SOC-T02 review](ancillary-r02/README.md).
Its 70 `ANC-C` claims, 16 substantial-support flags, 59 source nodes and 24 exact
leaf dispositions supplement the 188 core targets without renumbering or merging
the namespaces. Scalar occurrences are JSON locations, not independent witnesses
or new Huey literary EntityIDs. Media and source-status review remain #189/#190;
the argument draft remains proposed under #191, with no fixed chapter assignment.

SOC-T02's `checks.json`, source comparisons and three-file remainder are historical
receipts. Later Q03 authority work exists on #122 and is still outside staging.
Current commands, copy checks and limitations are in the new consolidation record.
The existing core index below describes #406's original scope; its source/review
claims are not retrospectively certified by this addition.

## Scoped source copying and staging

The author approved public copies of the specified discussion, Atlas and essay
collection. [AUTHORIZATION.md](AUTHORIZATION.md), [approval.json](approval.json)
and [#2's receipt](https://github.com/grwtsk/huey/issues/2#issuecomment-5771600544)
retain the exact scope and instruction. These are recorded permission context,
not authenticated runtime Instruction/Grant objects. No new permission question
is needed for this same scope. Raw clinical records and unrelated private material
remain excluded; evidence review and finished-edition decisions stay separate.

The [core source index](../../sources/standard-of-care/README.md) now provides the
twelve text exports, three context artifacts and normalized Atlas in staging.
[#406](https://github.com/grwtsk/huey/issues/406) and the
[consolidation record](../consolidation/soc-core.md) identify exact source pins,
selected paths, adapted navigation and deferred layers. Source bytes and claim
rows remain those of public PR #122 at
`ff0499bd341de12a31b355b79867b547f19d9b16`. The whole development PR remains draft;
care-law, incident and authority work remains outside this consolidation. The
ancillary addition is explicit and separately pinned under #421.

## Claim and argument coverage

[registry.json](registry.json) links **30 argument issues (#146–#175)** to **19
initial verification issues (#127–#145)**. [claims.tsv](claims.tsv) names **188
initial targets**, each with its existing issue and support level. **111 require
substantial support**, coordinated under [#176](https://github.com/grwtsk/huey/issues/176).
[support-policy.json](support-policy.json) defines these review categories.

The register is an initial topic decomposition, not a sentence-level source map.
A count, valid issue link or named support level is not a finding. A substantial
flag does not make a proposition false; an unflagged proposition is not thereby
true. First-person experience remains attributable testimony. Normative arguments
and metaphors need reasoning/provenance review, not invented empirical proof.

Every additional material proposition discovered needs a stable child ID, exact
source/version/locator, speaker and proposition type, covering verification issue,
supporting and contrary material, contextual limits and next action. Split compound
targets before factual clearance. [#145](https://github.com/grwtsk/huey/issues/145)
and [#176](https://github.com/grwtsk/huey/issues/176) remain open. Link new evidence
through the [existing intake protocol](../evidence-intake/README.md); a deposited
item or public certificate does not mark a claim verified or update reader evidence
automatically (#307/#314).

The original registry's `source_permission_issue: 2` identifies the recorded scope.
It is not a current blocker for SOC-PUBLIC-01. C180's historical restricted-manifest
reference concerns version identity; the grant permits this specified public
manifest. Private clinical-record locators remain excluded. The checkers validate
that these recorded assertions remain internally consistent; they do not
independently authenticate the author instruction or permission.

## Reproduction and historical receipts

```sh
python3 planning/standard-of-care/check_registry.py
python3 planning/standard-of-care/check_support.py --message-file .gitmessage
python3 -m unittest discover -s planning/standard-of-care -p 'test_*.py' -v
python3 scripts/soc_consolidation.py
```

Every new relevant commit must include the exact trailer in [.gitmessage](../../.gitmessage)
and [DISCLAIMER.md](DISCLAIMER.md). The [claim issue template](../../.github/ISSUE_TEMPLATE/claim-verification.md)
retains source/counterevidence requirements. No local Git configuration or hook is
installed by adding the template. Hosted checks execute these consistency checks;
a green result is not substantive clearance or human review.

The original planning README reported 24 local tests in an earlier partial
workspace, and prior Atlas reconstruction/hash checks. Those are **historical
receipts**, available at the [pinned original README](https://github.com/grwtsk/huey/blob/ff0499bd341de12a31b355b79867b547f19d9b16/planning/standard-of-care/README.md).
Current commands, tested candidate and actual results are recorded in this
consolidation PR. Matching the public exports to PR #122 does not repeat their
original extraction or compare them to inaccessible original source JSON.

Current RF-01, title/PR-01, Human–System direction and working chapter projections
govern later adaptation. Do not turn source testimony into a new blanket framing,
freeze candidate chapter joins as final identity, or replace an original source
with a preferred synthesis. No manuscript acceptance, evidence clearance, main
promotion, deployment or release follows from this staging consolidation.
