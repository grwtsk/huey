# Receipt-only intake facility: implementation handoff

Status: filed implementation plan, not an operating website or data grant.
Master: [neurology #90](https://github.com/grwtsk/neurology/issues/90).
Handoff work: [Huey #77](https://github.com/grwtsk/huey/issues/77).
Machine-readable stages and requirement coverage: [intake-facility.json](intake-facility.json).

## Author-selected scope

The current instruction selects a mostly blank page with a simplified text/upload composer, confirmation-only responses, local passkey protection, recorded provenance, kernel-owned bit-level index and atlas, automated metadata under the same agency guidance, and later external testimony/evidence input. The website is supported by grwtsk.com and implemented in grwtsk/neurology. Do not reopen these design decisions or invent a separate brand, CMS, source store or permission engine in Huey.

Text is optional. Files-only, text-only and combined submissions are valid. The page has Attach, Submit, a discreet passkey/session control, quiet receipts and a small support link. It has no model selector, content feed, automatic summary, interviewer, claim questionnaire or atlas dashboard. Selecting a file/pasting text does not submit it. Submitted text is evidence input, not operational instructions. No source preview or testimony echo opens automatically.

Confirmation should use fixed templates from an actual durable receipt. A language model is unnecessary even for that task. Received, partial, interrupted, denied and unavailable must not collapse into simulated success. Acceptance does not mean reviewed, understood, authentic or true. Backend metadata work is separate from the deposit response and can remain pending after durable receipt.

## Filed work

| Reference | Deliverable |
|---|---|
| [N90](https://github.com/grwtsk/neurology/issues/90) | Controlling facility epic and all stage boundaries |
| [N91](https://github.com/grwtsk/neurology/issues/91) | Blank accessible receipt-only composer |
| [N92](https://github.com/grwtsk/neurology/issues/92) | Real WebAuthn passkeys, scoped sessions and origin boundaries |
| [N93](https://github.com/grwtsk/neurology/issues/93) | Human owner enrollment and recovery arrangement |
| [N94](https://github.com/grwtsk/neurology/issues/94) | Unified text/file envelopes and durable provenance receipts |
| [N95](https://github.com/grwtsk/neurology/issues/95) | Reproducible loopback-only local facility |
| [N96](https://github.com/grwtsk/neurology/issues/96) | Human approval of first external contribution/recipient scope |
| [N97](https://github.com/grwtsk/neurology/issues/97) | Invited contributors, distinct authorship and unedited testimony |
| [N98](https://github.com/grwtsk/neurology/issues/98) | Versioned provider adapters and scoped service principals |
| [N99](https://github.com/grwtsk/neurology/issues/99) | Local/hosted security, accessibility and receipt-only acceptance |
| [N100](https://github.com/grwtsk/neurology/issues/100) | Later guarded grwtsk.com deployment and recovery |
| [K141](https://github.com/grwtsk/noeaaeue-kernel/issues/141) | Source-version bit/range index and explicit semantic mappings |
| [K142](https://github.com/grwtsk/noeaaeue-kernel/issues/142) | Attributed automated annotations under agency profiles |
| [K143](https://github.com/grwtsk/noeaaeue-kernel/issues/143) | Scoped source atlas adapter and preserved disagreement |
| [K144](https://github.com/grwtsk/noeaaeue-kernel/issues/144) | Hostile index/tag/atlas conformance and replay |
| [H77](https://github.com/grwtsk/huey/issues/77) | This source-free handoff and dependency manifest |

Existing neurology #89 remains upload transport; #87/#88 remain Reader/search and operations. Kernel #136/#137/#138 retain source contract, durable storage and filtered search; #140 retains later claim watches and authenticated executor access. The four new kernel tasks extend, not replace, their contracts or the Positive Atlas programme. They do not claim that its formal capabilities are already admitted.

## Backend identity and metadata

Tag exact source-version ranges, with explicit bit order, offsets, representation and transformation identity. Range/chunk structures can provide bit-level addressability without one stored row per bit. A storage bit is not automatically the programme's mathematical positive_bit. Byte identity is not proof of historical truth, authorship or semantic losslessness.

An original binary, extracted text, rendered page and transcript each have a separate representation identity. Exact, many-to-many, approximate, unavailable and unsupported locator mappings remain distinguishable. No parser invents a precise semantic mapping for compressed or scanned material. Originals remain unchanged while derived indices can be rebuilt.

Metadata must distinguish supplied assertions, deterministic measurements/extractions and inferred candidates. Each annotation binds its source/range, producer, code/profile version, operation, covering grant and uncertainty. Largely automated technical tagging is the selected goal; it need not trigger a human question for every file or tag. A new processor, wider disclosure, changed purpose or other ungranted consequential operation remains a bounded human decision. No training or external inference is enabled merely by selecting automation.

The atlas preserves independently attributed accounts, copies, transformations, contradictions and unknowns. It does not decide credibility or guilt, or certify a formal theorem from graph structure. Index/tag/atlas information is filtered before disclosure, including counts and relationships. The deposit page does not expose the atlas. Later claim review uses the existing saved-search work, separately from fixed citations and current grants.

## Local-first stages without circular approval waits

1. Prepare the source contract, receipt schema, UI fixtures and synthetic passkey implementation. These can begin without real records or the author's physical enrollment.
2. Integrate actual authorized storage, passkeys and deliberate upload in a loopback-only local facility. Demonstrate durable receipt, restart and export/restore on synthetic sources. Indexing, atlas, provider adapters and model assessment are not prerequisites for a receipt.
3. Present the prepared local screen and recovery packet for N93. The author performs the genuine passkey ceremony. Apply the existing H2 collection policy and K135 lifecycle decision where their actual scope is still missing before real evidence admission.
4. Implement backend indexing, annotations, scoped atlas and their conformance. Unavailable formal/semantic capabilities remain explicitly unsupported; do not wait for the whole mathematical research programme to acknowledge a file.
5. Prepare contributor/provider fixtures and exact policy text, then obtain N96 for the first real external scope. Every concrete provider connection needs its own attributable activation instructions; none is selected by the word provider alone.
6. Prepare a hosted candidate from the tested local facility, inspect actual Railway/proxy configuration and obtain any missing exact operational grant before activation. Localhost credentials and permissions do not silently transfer to grwtsk.com.

The manifest records staged prerequisites, not an executable scheduler or permissions engine. Its acyclicity does not prove all external prerequisites complete. Fetch current issues and actual evidence on every resumed task. There are no new native GitHub dependency objects. Human issue closure, a connector post under the owner login or green checks cannot substitute for an actual instruction or passkey ceremony.

## Human queue and source boundary

N93 and N96 are assigned to @grwtsk. They become actionable only when their specific review/enrollment packets exist. Existing [Huey #2](https://github.com/grwtsk/huey/issues/2) continues source/recipient/processor scope and [kernel #135](https://github.com/grwtsk/noeaaeue-kernel/issues/135) the unresolved retention distinction. Do not reask which site, whether passkeys are desired, whether automatic metadata is wanted, or require narration of every deposited file.

The author's facility instruction does not automatically import attached records, grant all Readers access, accept a witness's assertions, publish a submission, train a model or deploy production. The website's article-publication defaults must never apply to private intake. Provider/depositor/claimed-author/authenticated-subject identities stay distinct. Existing book structure, source attribution, PR-01 and final narrative boundaries remain unchanged.

## Verification boundary

This change adds only this document and its JSON plan. Validate every issue/requirement reference, stage dependency, human assignment and the local-receipt independence invariant. Run the existing Huey suite and inspect the actual PR diff. Record exact executed checks and any environment limitations in the PR, not anticipated future success here. No local website, real passkey, kernel service, runtime upload, monitor or provider test has been performed by creating this handoff.

Implementation references: [W3C WebAuthn](https://www.w3.org/TR/webauthn-3/), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), and [OWASP upload controls](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html). These inform technical checks, not a blanket compliance claim. Recheck the applicable supported specifications when implementing.
