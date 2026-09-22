# HUEY-CL08 — residual-source concordance and reference companion

**Huey book work.** Continue [PR #122](https://github.com/grwtsk/huey/pull/122), program #125, integration #186 and back matter #56–#57. Author: R.A. Jacob Martone.

> **Disclaimer: Working draft; claim verification incomplete; not medical/legal advice or adjudicated findings.** Editorial coverage does not establish source truth, individual legal applicability, an institutional action, manuscript acceptance or release.

## The actual change

This pass creates the separate reference apparatus rather than adding more repeated prose to the narrative. The clean manuscript remains **49,841 words and byte-identical to HUEY-CL07**. The optional annotated reading copy adds links at 60 existing paragraph locations; stripping only that generated annotation reconstructs the clean copy. No chapter, quotation, opening, capstone or protected closing is rewritten.

The author-review packet contains **19 substantive reference notes**, an exact residual-source concordance, current source records, the annotated and clean manuscripts, and the reproducible checker. It tracks **141 reference body/review units**. These units are paragraphs and review fields, not a claim that every subordinate clause throughout the book has been independently verified.

## All 91 residual units now have a disposition

The previous 165 identified adaptations keep their previous status. The remaining 91 units are classified as follows:

| Disposition | Units | Meaning |
| --- | ---: | --- |
| Existing narrative correspondence | 52 | Exact current passages are linked; the relation may be partial and is not a new edit or proof of every source clause. |
| Reference detail | 31 | Legal, policy or explanatory precision belongs in the separate companion rather than another narrative repetition. |
| Source-held | 4 | Source wording remains intact; original-source linkage or a distinct placement remains open. No scene or independent evidence is invented. |
| Proposed editorial noninsertion | 4 | Earlier essay-closing formulations remain in the source archive without creating another ending for Huey. |

[integration-r08.tsv](integration-r08.tsv) records all 91 decisions and their existing Huey issue owners. [reference-r08-units.tsv](reference-r08-units.tsv) records the 141 companion units. The current private ledger retains all 256 exact original source texts, all 660 previously tracked manuscript passages, the earlier 165 mappings and the new residual dispositions. A complete placement inventory is **not** completion of #145's full factual/semantic audit or #186's remaining integration work.

## What the reference notes do

The notes distinguish the source account from a finding, the original encounter from later responsibilities, clinical listening from investigation, Title II from Title III and Section 504, an offered accommodation from demonstrated effectiveness, personal devices from necessary encounter aids, and ordinary conduct rules from a legal direct-threat determination.

They also distinguish records adequacy from fraudulent intent, reporting predicates from adjudicated guilt, separate reporting regimes, accessory elements from evidence-concealment elements, institutional reply periods from legal deadlines, and hospital grievance rules from an assumed rule for every outpatient clinic. Each note identifies the question, evidence sought, appropriate expertise, limits, and an answer that would resolve the particular inquiry. None initiates that inquiry outside this editorial project.

The original notice's offers, two agreement routes and actual wording remain. The source-held items are not disproved or made dependent on a new performance of trauma. RF-01 continues to protect the actual relational account; current source criticism neither turns the book into an accusation/defense frame nor erases supported relationships.

## Current research and explicit gaps

[reference-r08-sources.json](reference-r08-sources.json) contains **24 public source entries: 23 inspected sources and one failed retrieval**. The prior 41-entry register is left unchanged as historical work. Current texts do not automatically govern historical events.

**SD01, #184:** the inspected text of 45 CFR 84.84(b) and HHS's May 7, 2026 announcement use the fifteen-employee division and May 2027/2028 dates. One revised-timeline sentence in the HHS detailed fact sheet says fifty or more employees; older exception discussion also retains earlier dates. The working note follows the regulatory text and records the summary discrepancy rather than combining them.

**SD02, #182:** fresh primary retrieval of Penal Code 11162.7 failed. The supplied letter's invocation remains attributed source material, not a newly verified statement about the interaction of reporting regimes. That precise verification task remains open. The current 11160, 15610.23 and 15630 texts were separately read; their actual predicates still require evidence.

The individual 164.526 URL also returned an access barrier, but its current text was successfully read in the full Part 164 rendering. Those access states are recorded distinctly. Internal UCSF policy 1.01.10 remains uninspected; the public cross-reference does not supply its contents.

## Actual checks

```sh
python3 verify_reference_r08.py --packet /path/to/huey-cl08-author-review
```

The isolated checker passed unchanged-narrative comparison, all 256 source texts and 91 residual dispositions, all 660 earlier passages, exact paragraph spans, all 141 reference units, the 19-note graph, both public indexes, and local file/fragment links. **Twenty-four invalid mutations were rejected**, including lost source limits, wrong repository/owner, false acceptance or finding, fabricated source retrieval, missing residual items, altered source text, a protected-chapter target, and annotation that changes narrative prose.

The earlier packet's 20 manifest entries were checked and its delivered manuscript matched the current baseline. This was an integrity comparison, not a rerun of every earlier research or semantic-review task. Selected correspondence passages and the new reference text were read separately from the checks. No independent second review or full-book semantic reread is claimed.

A full checkout was attempted and failed on host resolution. The full repository suite, hosted CI and audio runtime were not run. Public payload whitespace and source-boundary checks are performed on the isolated files; they are not described as a full checkout.

## Continuing work

The residual placement inventory is now explicit. The four source-held items, detailed legal/history questions, wider chapter citation coverage and deeper clause audit remain open under #186/#145/#56/#57 and the relevant existing evidence issues. PR #122 remains draft and unmerged. No additional master or duplicate investigation programme was created.

No private narrative, exact private source locator, private fingerprint or protected closing text is committed by this pass. No deployment, replication activation, external contact, complaint, clinical instruction, legal filing or edition release is performed.
