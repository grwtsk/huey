# SOC-Q03 — Authority register: preservation and source inspection

> [!WARNING]
> **WORKING DRAFT — CLAIM VERIFICATION INCOMPLETE.** A quotation match establishes wording within the inspected source, not the truth of every associated statement, clinical applicability, legal liability, an individual physician's pledge or conduct, or doctrinal equivalence. These are research notes, not medical/legal advice or adjudicated findings.

[Verification #192](https://github.com/grwtsk/huey/issues/192) continues [Atlas review #144](https://github.com/grwtsk/huey/issues/144), [transfer #126](https://github.com/grwtsk/huey/issues/126), [coverage #145](https://github.com/grwtsk/huey/issues/145) and [substantial support #176](https://github.com/grwtsk/huey/issues/176). SOC-PUBLIC-01 already authorizes this specific source copy; verification is not another permission gate.

## What is preserved

The [complete original authority register](../../../sources/standard-of-care/neurology-current/content/authority-quotes.json) contains **12 entries, 351 lines and 15,994 UTF-8 bytes**. Its reconstructed Git blob is **69f35715a28dc800250959ee2a19cf67bfa91e90**, matching the connected source at `grwtsk/neurology@c920e426b8b6753b9f4bacf019e48010e57918c2`. The source wording, dates, translations, notes and relationships are unchanged. In particular, `verified_at: 2026-09-18` is historical source metadata, not a new certification.

The import copies one formerly pending ancillary file. The ethics architecture and painting image remain pending; full presentation JSON for the twelve earlier prose exports, their whole-text comparisons and complete conversation capture remain separate work. A direct attempt to reuse the three foreign-repository blob IDs was rejected; no foreign object was represented as transferred through that failed attempt. The source originals and live website are unchanged.

## What the outside-source reading established

[review.json](review.json) records the actual attempted URLs, access result, inspected passage, version result, observation and limitations for each entry. These external checks are distinct from preservation of the supplied register. Nine entries have wording matched against retrieved primary-page text; two have **official search-excerpt support only**; one could not be checked against its specified edition.

| Review | Supplied entry | Actual result and important limit |
|---|---|---|
| Q03-R01 | WMA Cordoba | Sentence matched; read the surrounding relationship and transfer provisions, not the quoted sentence alone. |
| Q03-R02 | UN UDHR | Official search excerpt matches Article 1; direct original and alternative page reads failed with HTTP 403. Full primary-page inspection remains open. |
| Q03-R03 | DOJ mobility access | Excerpt matched in Services and Facilities; relevant Part 2 assistance questions read. Current technical assistance is not a historical case finding. |
| Q03-R04 | 988 Lifeline | Homepage sentence matched. A published description is not an individual service guarantee; detailed service/privacy claims need their own evidence. |
| Q03-R05 | 1 Corinthians 13:6, KJV | Verse matched; complete chapter inspected. Preserve KJV wording and distinguish it from the register's explanatory gloss. |
| Q03-R06 | Leviticus 19:18, JPS 1985 | Specified edition unavailable; plain reader shell did not expose the text. Wording, punctuation and edition verification remain open. |
| Q03-R07 | Qur'an 5:32 | Displayed English clause and surrounding verse read; the specific translator credit was not exposed and remains unverified. |
| Q03-R08 | Dhammapada verse 5 | Two-sentence excerpt matched; third sentence and modern-translation reuse notice remain relevant. Rights clearance is separate. |
| Q03-R09 | WMA Geneva | Sentence matched, but the supplied URL is a proposed-revision document. The separately read adopted declaration supplies the preferred reference for new prose. |
| Q03-R10 | UN CRPD Article 25 | Official Adopted Articles search excerpt supports the wording; complete direct primary-text retrieval failed. Do not substitute a working draft. |
| Q03-R11 | AMA Patient Rights | Right 1 matched; opening and rights 1–9 read. The broader advocacy/continuity context is retained. |
| Q03-R12 | WHO Constitution | Excerpt matched; the omitted continuation remains part of its context, not an outcome guarantee. |

The corresponding primary URLs and pinpoints are in each review row. No public source is used to resolve a disputed patient event. No access failure is evidence that a quotation is false. No accessible source is silently substituted for the source that failed.

## Claim coverage, without inflated counts

[fields.tsv](fields.tsv) maps **every one of the 271 scalar source fields** to an exact JSON pointer, review and Huey verification issue. This includes **68 separate conceptual relationship references**. All 68 remain explicitly unreviewed correspondences under #144: neither their endpoint integrity nor their semantic support is certified by this pass.

**89 field-review targets require substantial support**, including those relationships, compound context notes and service details. That is a field-level queue, **not 89 newly established facts or an assertion of exhaustive clause-level review**. Compound source notes still require more granular semantic review under #145/#192 where necessary. The earlier 188 SOC targets and 70 ANC checks retain their IDs and are not renumbered or merged into a fictitious total of unique claims.

[claims.tsv](claims.tsv) separately states **14 propositions** used in [The standards are not silent](argument-draft.md). Eleven describe inspected sources or their citation context; three are normative/methodological arguments. Every proposed prose unit has claim IDs. Those IDs lead to a verification issue, source review and limitation. The twelve-unit passage is a candidate, not an applied or accepted manuscript edit.

## Reproduce the structural checks

```sh
python3 planning/standard-of-care/authority-q03/verify.py
python3 -m unittest discover -s planning/standard-of-care/authority-q03 -p 'test_verify.py' -v
```

The validator is read-only and offline. It verifies byte identity, exact field coverage, unique identifiers, issue ownership, known access/status distinctions and candidate-unit coverage. It does not contact websites, inspect meaning, grant permissions, resolve rights or clear claims. A passing test must never change an unresolved evidence status.

The tested payload and negative-input test results are recorded in the commit/issue receipt. This is a partial materialization; the full repository suite and hosted CI were not run. No claim is made that test success establishes a professional standard's applicability to the patient.

## Remaining evidence actions

Retrieve the specified JPS edition and translator credit for the Quran.com version; inspect full UDHR/CRPD primary text; inspect the detailed service/privacy sources; review each of the 68 relationship references against the complete Atlas and ethics architecture; then examine how each approved use relates to the book's actual passage. Preserve unfavorable and limiting context. Use existing #192/#144/#145/#176 rather than making the author repeat permission or testimony.

Every relevant commit carries:

> Disclaimer: Working draft; claim verification incomplete; not medical/legal advice or adjudicated findings.
