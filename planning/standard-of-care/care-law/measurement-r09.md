# HUEY-CL09 — reported activity, denominators and measurement evidence

Huey book work on [PR #122](https://github.com/grwtsk/huey/pull/122), under #186, #25, #129 and the notes/method work #56–#57. Existing parent: #125. Author: R.A. Jacob Martone.

> **Disclaimer: Working draft; claim verification incomplete; not medical/legal advice or adjudicated findings.** This pass checks conditional arithmetic on reported summaries, not the underlying device measurements. No raw activity export was recovered or queried. A source citation, exact ratio or passing test does not establish clinical causation, author acceptance or release.

## Work completed

The author-review packet contains eight substantive measurement notes, 57 reference-body units and 40 question/evidence/limitation/reviewer/answer-criterion units. Eight existing paragraphs are reviewed as 31 separately addressable sentences, with exact source/support limitations. The clean narrative remains **49,841 words and byte-identical** to the preceding candidate; its opening, capstone, closing and all earlier integrations are unchanged.

Fifteen source-reported inputs support six explicitly denominated percentage comparisons and six further arithmetic checks. Two synthetic examples test compatibility of rounded summaries; neither is introduced as a recovered measurement, cutoff or replacement for a source value. All 660 previously tracked narrative passages, 141 earlier reference units and the complete 256-unit original allocation remain preserved. The previous four source-held units are not assigned invented content.

The full text, private locators, numerical patient summaries, exact sentence spans and private fingerprints remain in the author conversation. The public indices here carry identifiers and ownership, not the manuscript or raw clinical data.

## What the audit distinguishes

- A source-reported total, an independently reproduced measurement, a clinical interpretation and a causal attribution.
- Remaining proportion versus relative decrease; immediate-window versus annual-baseline denominators; steps versus walking/running distance.
- Rounded quantities versus exact inversion; a synthetic compatibility example versus an estimate of an unknown source value.
- A chosen constant-rate projection versus an observed no-event trajectory, guaranteed activity or damages allocation.
- Calendar days, days containing records and qualifying observation days; missing intervals versus observed zero; encounter-day boundary versus a presumed before/after split.
- Existing evidence and bounded clinical questions versus transferring an indefinite observation/investigation burden to the family.

The read-only reconstruction schedule specifies source/device inventory, original quantities and timestamps, aggregation, overlaps, manual entries, time zones, exclusions, denominators and sensitivity checks. It does not modify Health settings or create a clinical monitoring instruction. A required source reconstruction is not a prerequisite to receiving testimony or beginning accessible clinical care.

## Public-source inspection and a new bounded issue

[measurement-r09-sources.json](measurement-r09-sources.json) contains seven public sources: Apple support, five Apple developer-documentation entries, and the publisher's clinic-versus-daily-life gait study. Developer entries whose direct pages were JavaScript-only are labeled **indexed primary text**, not fully rendered pages or historical-version checks. No software query was executed against an account or device.

[Issue #320](https://github.com/grwtsk/huey/issues/320) records two internal inconsistencies in the cited 2025 paper: its subtype list and the association between two variability labels and their discrimination statistics. The source's Abstract/Methods, Results and table are retained separately rather than silently reconciled. The paper's independent-walking population, instruments and group-comparison purpose do not validate a consumer-device history or establish a patient-specific mechanism. Publisher HTML and PDF text were read; PDF page 1 was rendered, while page 3–4 screenshot attempts failed. The relevant HTML table was available. No author or journal was contacted.

The bounded Files retrieval examined fourteen results from five queries; these were letters or copies, not the original timestamped export or generating analysis. This is not an exhaustive finding that the original is absent. Existing #25 and #129 retain the raw-measurement and clinical-sampling questions. Earlier legal-source gaps are not closed by this pass.

## Review index and checks

[measurement-r09-units.tsv](measurement-r09-units.tsv) indexes all 97 new reference/review units. [measurement-r09-passages.tsv](measurement-r09-passages.tsv) indexes the 31 retained sentences. The private ledger supplies their exact wording and locators, the fifteen inputs and all calculations.

Run the read-only verifier against the author-review packet:

```sh
python3 verify_measurement_r09.py --packet /path/to/author-review-packet
```

Actual local execution passed twelve rational-arithmetic checks, two rounding-compatibility examples, exact clean-manuscript preservation, complete selected-sentence coverage, new and inherited ledger checks, two public-index comparisons, the public-source projection and 696 local links. Nineteen deliberately invalid mutations were rejected, including a wrong denominator, a remaining proportion relabeled as a decrease, a synthetic example presented as observed, upgraded retrieval status, a closed unresolved paper discrepancy and an unlisted narrative edit.

The original CL08 archive's twenty manifest entries were checked. This validates their byte integrity, not prior research as freshly performed. The eight affected passages and the new companion were reread for source scope; this is not a full-book reread or independent second review. The companion's catalogue and table apparatus are not claimed as a complete semantic atomization of every subordinate proposition.

Full repository tests and hosted CI were **not run**: the attempted clone failed on host resolution. Passing isolated checks cannot substitute for that suite. PR #122 remains draft/unmerged; #186, #25, #129, #320 and the substantive evidence questions remain open. No public manuscript transfer, new device access, clinical contact, legal filing, replication activation or release occurred.
