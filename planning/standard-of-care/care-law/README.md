# Huey — care, law and trust

> **This work belongs to `grwtsk/huey`.** It is part of the book's existing standards/care/trust program [#125](https://github.com/grwtsk/huey/issues/125) and [development PR #122](https://github.com/grwtsk/huey/pull/122). Repository correction: [#177](https://github.com/grwtsk/huey/issues/177).
>
> **DISCLAIMER:** The working material contains attributed accounts, documentary descriptions, normative arguments, legal references and unresolved questions. It is not independent verification, medical or legal advice, a finding of wrongdoing, an executed clinical instruction, final manuscript acceptance or an edition release. Prior source-inspection records remain dated records of the earlier passes; the repository correction does not claim those investigations were freshly performed.

## Actual recovered work

Read [revision.md](revision.md): the complete cumulative proposal titled **Medicine Worthy of Its Laurels**, attributed to **R.A. Jacob Martone**, recovered as Huey editorial input rather than a neurology website revision. All **256 prose units** are retained with exact wording from the second pass. The first pass's 151 IDs survive; the second pass added 105 and changed ten. [lineage.json](lineage.json) preserves all ten before/after changes and the repository/issue map.

All **41 source entries** and their specific limits are in [sources.json](sources.json). All **34 detailed reviews** are in [review.json](review.json), including source pages/sections, observations, questions, evidence needed, competing explanations, competent review functions, proposed lower-burden actions and closure tests. No original medical PDF or private witness record is copied here. A source-origin URL is provenance, not an instruction to redirect work to another repository.

The existing `SOC-C001`–`SOC-C188` targets remain unchanged. This collection uses the namespace `HUEY-CARELAW-01` with retained `C001`–`C256` identifiers. Every unit has a Huey issue owner. A source identifier or repeated account is not independent corroboration. Requests and moral definitions do not acquire a legal status merely because they are close to citations.

## Book integration, not a detached publication

[book-integration.json](book-integration.json) assigns all 17 source sections to candidate joins in Huey's existing chapter and standards issue graph. The source account belongs with the encounter, witness, inherited-record and correspondence chapters; practical care and institutional work with Chapters 10–11; transferred burdens with Chapter 12; distinct investigative/ethical/legal functions with Chapter 13; trust and Atlas correspondence with Chapter 14. Detailed authority and methods belong in the separate notes/appendices.

These are **candidate joins, not executed edits to the private full-book manuscript**. Exact current manuscript reconciliation is [#186](https://github.com/grwtsk/huey/issues/186), extending existing #124/#145/#55. Preserve the three movements, supplied opening, RF-01 relational framing, the author's supplied Chapter 15 capstone and the protected ending. Do not append this essay as an epilogue or insert repeated editor-origin cautions into the narrator's voice. A supported relationship does not disappear because its motive or ultimate classification is unknown.

## Complete correction map

The two prior PRs were incorrectly created in `grwtsk/neurology`. No neurology source article is a target of this recovery. Their task scopes now reside here:

| Misplaced neurology issue | Huey destination | Scope |
| --- | --- | --- |
| 119 | [125](https://github.com/grwtsk/huey/issues/125) | Existing program; correction is separately tracked in #177 |
| 120 | [178](https://github.com/grwtsk/huey/issues/178) | Chronology, examination findings and quotations |
| 121 | [179](https://github.com/grwtsk/huey/issues/179) | Clinical deterioration, referral and continuity |
| 122 | [180](https://github.com/grwtsk/huey/issues/180) | Communication, consent, portal and notice |
| 123 | [181](https://github.com/grwtsk/huey/issues/181) | Records, preservation and downstream reliance |
| 124 | [182](https://github.com/grwtsk/huey/issues/182) | Reporting predicates and element-specific legal review |
| 125 | [183](https://github.com/grwtsk/huey/issues/183) | Responsible offices, conflicts and handoffs |
| 126 | [184](https://github.com/grwtsk/huey/issues/184) | Jurisdiction, historical authority and deadlines |
| 127 | [185](https://github.com/grwtsk/huey/issues/185) | Consequences, burden, trust and common good |
| 128 | [186](https://github.com/grwtsk/huey/issues/186) | Actual Huey manuscript and evidence integration |
| 130 | [187](https://github.com/grwtsk/huey/issues/187) | Exact document identity and notice sequence |

The recovered tasks extend rather than replace the existing SOC verifications and arguments. Closure of a wrong-repository issue means superseded location, not an answered factual question or a completed investigation. Read #177 for actual cleanup receipts rather than infer cleanup from this table.

## Validation and exact-text export

From a checkout:

```sh
python3 planning/standard-of-care/care-law/verify.py --output-dir /tmp/huey-care-law
```

The standard-library verifier exports `claims.json` with exact prose, hashes, evidence types, source locators and inherited inspection status, review links, Huey issue URLs and candidate chapter joins. It also exports a separate `verification.json`. The marked prose in `revision.md`, the source records and review schedules are the checked-in register; exports need not be another divergent edited copy.

Actual isolated execution during this correction checked 256 unique prose IDs, 41 source records, 34 reviews, all added/edited-unit review links, 17 complete section dispositions and **21 deliberately invalid mutations**. The mutations include wrong repository, old-repository issue ownership, missing book disposition, falsely applied manuscript status, an attempted protected-close target and lost before/after lineage, as well as the previous source/notice/inspection guards.

A separate comparison against both supplied earlier packets confirmed **zero changes to the cumulative 256 prose texts** and preservation of **all 34 review rows** apart from the explicit issue-number migration. The six core file identities are recorded by the verifier. Source descriptions preserve failed rechecks and inaccessible policy contents rather than converting them to success.

These checks do not certify source authenticity, legal applicability, clinical adequacy, complete semantic atomization of subordinate clauses or final writing quality. The full Huey repository test suite and hosted CI were **not run**: the execution environment did not obtain a full checkout. No old receipt is presented as a newly run repository test.

The current corrective files and issues are for Huey. No deployment, replication activation, new outside destination, medical contact, complaint, legal filing, source deletion or edition release is part of this work.
