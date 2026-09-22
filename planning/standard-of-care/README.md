# Standards, care burden and trust

Program [#125](https://github.com/grwtsk/huey/issues/125); transfer [#126](https://github.com/grwtsk/huey/issues/126); existing source permission [#2](https://github.com/grwtsk/huey/issues/2). Development continues in [PR #122](https://github.com/grwtsk/huey/pull/122).

## Actual state

51 issues were created: one program, one transfer task, 19 verification tasks (#127-#145), and 30 argument tasks (#146-#175). The 188 entries are initial evidence targets, not verified facts. Full source-unit extraction and semantic support review remain open in #145. Compound targets must be split when the actual source sentences are audited. No automated complete conversation export is claimed.

The registry covers pain-limited function; prevention and relief; trauma-informed access; coordinated care; genetic and medication hypotheses and corrections; meanings of standard; patient and support-person workload; institutional accountability; prior trust; and the origin of communication barriers. The requested atlas and essay transfer remains a separate source task.

No private essay, medical record, manuscript passage, private path or source fingerprint is committed here. The source collection is private/Reader-gated; Huey is public. #2 must resolve the specific public-copy exception before #126 can place those texts in public Git. The already selected gated source architecture is not reopened. No original was deleted, no source service was deployed and no medical or legal action was taken.

## Reading the registry

`registry.json` declares its column meanings. A verification row identifies its actual issue and an inclusive range of initial claim numbers. Combine the prefix `SOC-C` with a three-digit number to obtain the stable target ID. Each target's exact question, required evidence, counterevidence search and closure conditions are in its linked issue body. An argument row gives its issue, normative reasoning ID, verification issues and claim-number ranges. Expand those ranges to recover both forward and reverse dependencies.

Every target has exactly one verification owner. The references are textual/planning dependencies, not native GitHub dependency objects. Verification blocks factual clearance of the linked passage, not preserving testimony or preparing a draft. The ledger must grow when actual source-unit review discovers additional propositions or arguments.

## Argument map

| Arguments | Issue range | Work |
|---|---|---|
| SOC-A01-A06 | #146-#151 | Custom, professional circumstances, accessibility, language, measurement and proof |
| SOC-A07-A14 | #152-#159 | Pain-limited function, relief/prevention, interpretation, trauma, coordination, medication, genetics and renal inquiry |
| SOC-A15-A19 | #160-#164 | Professional substitution, family roles, process-generated complexity, transferred costs and usable life |
| SOC-A20-A25 | #165-#170 | Agency, records, reciprocal standards, continuity conditions, actual institutional action and decision-level review |
| SOC-A26-A30 | #171-#175 | Prior trust, endurance, origins of barriers, repair of trust and moral/atlas standards |

## Evidence contract

A target identifies a proposition to investigate, not an accepted conclusion. All begin open/unverified. A later exact claim record must identify speaker/source, date/version, restricted locator, type, available evidence, missing evidence, counterevidence, applicability and disposition. Testimony, independent observation, institutional text, inference, hypothesis, clinical guidance, law, ethical argument and adjudication remain distinct. This is not a hierarchy privileging institutional speech.

Normative arguments use SOC-N identifiers and require reasoning review, not fabricated empirical citations. Preserve unsupported and superseded source wording with correction lineage on the restricted surface. A hash is not truth, a citation is not automatic support, and issue closure is not human consent or manuscript acceptance. Do not require a patient to prove a causal theory before preserving the patient's account.

## Next stages

Complete #127 source reconciliation and #126 restricted preparation. Resolve only the narrow disclosure question in #2. Read all selected atlas and essay units under #145, including nested paragraphs, tables, quotations, captions, footnotes and authority dependencies. Check the existence of an atlas edge separately from whether its target supports the proposition.

Complete each verification with a bounded disposition and retain unresolved items. Integrate the arguments through #124 into the existing narrative rather than append disconnected supplements. Preserve RF-01, original source wording, the three movements and the protected closing. No new retelling requirement or implied author approval is created.

## Local checks

Run:

```sh
python3 planning/standard-of-care/check_registry.py
python3 -m unittest discover -s planning/standard-of-care -p 'test_registry.py' -v
```

The ten synthetic tests check identifiers, claim coverage, link ownership, missing/duplicate claims, undeclared completion and a limited source-locator tripwire. They do not verify medical or legal truth, source authorship, disclosure permission or full semantic coverage.

These additions were tested as an isolated new-file payload, not a full repository checkout. The existing repository suite and hosted Actions were not run. No local check closes an evidence issue or a human decision.
