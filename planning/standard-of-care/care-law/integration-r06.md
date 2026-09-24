# HUEY-CL06 — encounter, witness and record in Chapters 3–5

**Huey book work.** Author: R.A. Jacob Martone. Parent [#125](https://github.com/grwtsk/huey/issues/125); manuscript integration [#186](https://github.com/grwtsk/huey/issues/186); chapter tasks #39–#41; continuing [PR #122](https://github.com/grwtsk/huey/pull/122).

> **Working draft; claim verification incomplete; not medical/legal advice or adjudicated findings.** These are candidate edits and source-review records, not author acceptance, a completed investigation, a new clinical instruction, a source-disclosure grant or an edition release.

## Actual manuscript work

Sixteen operations revise the existing Chapters 3–5: **13 insertions after retained anchors and three replacements**. The exact mounted HUEY-CL05 candidate was compared byte-for-byte with the prior archive member before editing. No rendered-text reconstruction was needed in this pass.

The author-review packet contains the complete revised manuscript, all three complete chapters, exact before/after edits, 79 new or rewritten units, a 140-paragraph disposition register, the original 256 care-law dispositions, source notes and a read-only verifier. The narrative grows from **46,804 to 48,212 words**, a net addition of **1,408**, using the same whitespace convention (excluding headings and scene-break markers, including the author line). No spoken duration is inferred.

**All material outside Chapters 3–5 is unchanged.** The opening, chapter/movement order, all existing curly-quoted occurrences, later manuscript integrations, supplied capstone and protected closing remain exact. No new scene, dialogue, witness statement, clinical finding, date of delivery or legal outcome is invented. Original letters remain unmodified.

Chapter 3 now makes the questions about referral scope, symptom reception and the sequence of consent more specific without supplying missing maneuvers or motives. Chapter 4 distinguishes a witness's own account, a report about the witness, and a summary by someone else; it makes the conditions of clinic/home observations and the burden of gathering further evidence explicit. Chapter 5 develops item-specific examination findings, record dates and preparation, evidentiary foundations, contextual completeness, audit limitations and a concise clinically useful handoff.

The standards are not imposed as a requirement that the patient litigate before being heard. Court evidence rules, professional ethics, original testimony, current documentary descriptions and author-proposed safeguards remain distinguishable.

## Exact tracking without public manuscript disclosure

[integration-r06.tsv](integration-r06.tsv) gives the **79-unit** public index: unit, edit, chapter, type, Huey owner, source aliases and related earlier C IDs. Exact text, source locators and character spans remain in the author conversation.

[integration-r06-paragraphs.tsv](integration-r06-paragraphs.tsv) accounts for **all 140 baseline body paragraphs** in the target chapters. Of these, 137 remain exact; three are replaced with explicit lineage. This is a source-scope and change map, **not a claim that every retained subordinate clause has been independently verified**. Two retained opening Chapter 4 personal identity/memory paragraphs retain an original-source-link task under the existing chapter/source work; they were not rewritten or newly authenticated.

All prior **304 new/rewritten units** from CL03–CL05 and **189 retained Chapter 14 units** are preserved. Thirty-seven of the original C001–C256 units inform this pass. Across the manuscript-integration passes, **122 have identified adaptations and 134 remain not yet adapted**. These are editorial-lineage counts, not resolved-allegation counts. The namespaces of earlier SOC and care-law work remain unchanged.

The existing issues hold the work: #178 chronology/witness sources; #179 clinical assessment; #180 consent/communication; #181 records; #184 evidentiary and legal applicability; #186 manuscript integration. Each new unit has a question, evidence needed, competent reviewer, contrary material or limits, and a closure test. No duplicate investigation program is created.

## Eight fresh primary-source checks

All were read on September 22, 2026; historical applicability and individual legal use remain separate questions.

| Alias | Primary authority | Pinpoint and boundary |
|---|---|---|
| W01 | [Evidence Code §702](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=EVID&sectionNum=702.) | Personal knowledge, subject to §801; not a clinical-intake rule or a finding about a witness. |
| W02 | [Evidence Code §780](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=EVID&sectionNum=780.) | Opening and (c), (d), (f); nonexclusive credibility factors, not status-based acceptance or rejection. |
| W03 | [Evidence Code §356](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=EVID&sectionNum=356.) | Contextual completeness on the same subject; not unlimited admission or a document-production order. |
| W04 | [Evidence Code §1271](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=EVID&sectionNum=1271.) | (a)–(d), business-record foundation; not automatic truth or admissibility of a medical note. |
| W05 | [Evidence Code §1201](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=EVID&sectionNum=1201.) | Nested hearsay within exceptions; purpose of use and each applicable layer matter. |
| W06 | [AMA Opinion 2.1.1](https://code-medical-ethics.ama-assn.org/ethics-opinions/informed-consent) | Consent process, items 1–3 and separate emergency exception; not historical adjudication. |
| W07 | [AMA Opinion 3.3.1](https://code-medical-ethics.ama-assn.org/ethics-opinions/management-medical-records) | Clinical future usefulness, confidentiality, availability and retention; no universal retention period inferred. |
| W08 | [AMA Opinion 8.6](https://code-medical-ethics.ama-assn.org/ethics-opinions/promoting-patient-safety) | Honesty, patient communication, review and prevention; not proof that an error or investigation occurred. |

Private aliases A/B identify direction and predecessor; L08/L10/L17 identify dated patient-source families. Recipient-addressed copies are not independent corroboration. Bounded source searches did not recover the original clinical note, separately authored witness account or audit trail among the results examined; **that is not proof they do not exist**. No witness or institution was contacted. The attempted current §164.312 eCFR read led to an access barrier and was not used as an inspected legal basis.

## Actual validation

```sh
python3 verify_integration_r06.py --packet /path/to/author-review-packet
```

The standard-library checker makes no network requests and changes no manuscript. It verifies exact forward/reverse edits, all changed-prose spans, paragraph dispositions, inherited archive/ledger identities, 493 earlier tracked units, all 256 prior C-ID dispositions, and preservation outside the three chapters. **Twenty-four invalid-input tests passed**, including wrong repository/PR/owner, omitted records, fabricated findings or adoption, invented original-source inspection, lost limitations, unlisted manuscript changes and altered quotations. Text mutations recompute the candidate hash instead of relying only on a digest mismatch.

The three target chapters were read; the changed passages and their surrounding joins were reread separately from the checks. This is not a fresh whole-book semantic review or an independent second reviewer. Public indices were compared row-for-row against their private records; isolated staged-diff whitespace checks passed. Exact committed-public-file receipts are recorded in PR #122 after the writes.

A full checkout attempt failed on GitHub host resolution. **The full repository suite and hosted CI were not run.** Passing the packet checker establishes declared consistency, not historical truth, clinical adequacy, evidence admissibility or author acceptance.

## Remaining bounded work

Continue #186 with the actual current Chapters 6–7, covering the later clinician/referral and correspondence chronology. Keep source, consent, record, witness and legal questions open until their actual completion conditions are met. Preserve other concurrent source-transfer/research work on this PR. Do not silently replace a later candidate with this receipt or a source copy.

PR #122 remains draft/unmerged. No otherwise ungranted manuscript or source text is added to public Git; no raw medical records, private fingerprints, credentials or protected closing are included. No deployment, replication activation, new external destination, provider contact, complaint, legal filing or edition release is part of this pass.
