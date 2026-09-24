# Pre-release staging and journalistic-integrity promotion

Author: R.A. Jacob Martone. Operative instruction: [#310](https://github.com/grwtsk/huey/issues/310), 2026-09-22.

## Purpose and branch roles

`pre-release` is the long-lived working and evidence-review branch. `main` is the
promotion destination, not the ordinary intake queue. The default branch remains
`main`. A staging merge records work in progress; a promotion merge records the
specific presentation that passed review, not universal proof of its sources.

The branch was initialized from main commit
`690774b4903355e0b3269f85e037d57ed0389717`. Inherited content, including the chapter
previously admitted under #308/#309, retains its existing verification status.
Nothing is removed, renamed, rewritten or retrospectively certified by this setup.
A complete-edition review must still account for inherited content.

Both branches, their histories and PR discussions are public. Staging is not a
confidential evidence room. Existing scoped grants under #2 remain in force;
private clinical records, confidential locators and unapproved prose stay on their
permitted restricted surfaces. Use approved opaque source IDs in public review
records where necessary. Creating a branch grants no additional disclosure rights.

## Source basis and repository-specific implementation

The [SPJ Code of Ethics](https://www.spj.org/spj-code-of-ethics/) calls for accuracy,
context, source verification, fair opportunities to respond, harm awareness,
independence and transparent correction. SPJ describes its code as ethical
principles, not a legally enforceable certification scheme.

AP's [Telling the Story](https://www.ap.org/about/news-values-and-principles/telling-the-story/)
sets out attribution and quotation practices, source vetting, reasonable response
opportunities, prohibition of fabrication and visible corrections. These are
external reference standards, not evidence about any participant in Huey.
Both pages were inspected on 2026-09-22. No organizational endorsement is claimed.

The branch names, review record, issue links, dispositions and merge procedure below
are Huey's implementation of the author's instruction, not rules quoted from SPJ
or AP. Existing RF-01, PR-01 and source/author-agency requirements remain controlling.

## Work, review and promotion

1. Branch new work from the current `pre-release`. Open the bounded work PR against
   `pre-release`, preserving the one-response/one-PR practice. Check public-source
   permission before the first push, not only before promotion. Keep unresolved
   assertions and verification issues visibly pending.
2. Prepare the [promotion review record](pre-release-review.template.md) for the
   exact candidate. Reuse existing claim IDs, source records and verification issues
   under #18/#65 instead of creating a parallel claim universe. Map every material
   changed assertion and exhibit, including factual claims in notes or metadata.
3. Obtain actual human editorial clearance from the author or an explicitly
   designated editor. Record who reviewed what, when, with what source access and
   limitations. Independent checking is distinct from the author's acceptance;
   record conflicts and any required qualified review under #5/#65. Do not claim
   independent review when only the author or an agent has reviewed the material.
4. Open a promotion PR from `pre-release` to `main` only when its entire diff is
   cleared. When other staged work remains unresolved, branch `promote/<issue>`
   from current `main` and bring across only the cleared staged commits or exact
   files. Record their pre-release provenance and compare the complete resulting
   diff; dependencies cannot silently import uncleared claims.
5. Before merge, reread the live PR, base/head, effective repository rules, comments,
   review record and changed files. Every blocking issue must be resolved for the
   precise presentation being merged. A changed head, base or material source
   invalidates reliance on an earlier review until the new candidate is checked.
   Merge through the PR with the inspected expected head SHA, never by force push
   or by bypassing a required review. Record the actual merge result afterward.
6. Keep `pre-release` for continuing work. Bring accepted main changes back through
   a reviewed synchronization that preserves staged work; do not reset the branch
   to discard pending changes. No scheduled synchronization is configured.

Older PRs do not gain clearance from their existing `main` target. Before resuming
an unfinished work PR, inspect and retarget it to `pre-release` when it is staging
work; preserve its discussion and head commits. This setup does not bulk-retarget
or merge existing PRs, including #122.

## What must be resolved for a promotion

A review packet must answer the following concrete questions. An unchecked box,
missing source, pending inquiry or failed access is not a passing result.

| Gate | Required review record |
|---|---|
| Exact proposition and source | Claim ID, exact location and proposed wording, source ID/version/locator, what was actually inspected and what it supports. Originals and derivatives stay distinguishable. |
| Source independence and limits | Identify firsthand observation, recollection, received record, inherited/copy-derived assertion, analysis, hypothesis and any adjudicated finding. Record corroboration actually obtained and dependencies among sources. |
| Fidelity and reproducibility | Match quotations and translations to their source; retain material context. Record data coverage, denominators, method, assumptions and recomputation for quantitative claims. Distinguish missing inputs from zero. |
| Competing material | Preserve evidence that weakens or contradicts the proposed claim, including institutional replies and separately attributed witnesses. Explain its effect on the exact wording and remaining uncertainty. |
| Response opportunity | For material adverse allegations, record appropriate authorized outreach and reasonable response time, the actual reply or nonresponse, or a reasoned editorial exception. Unsent drafts and lack of authorization are not completed outreach. |
| Rights, privacy and portrayal | Record the specific disclosure grant, necessary redactions, attribution, source conditions, participant considerations and foreseeable harm. Keep raw restricted evidence outside public Git. |
| Framing and accountability | Apply RF-01 without erasing identity or imposing a label. Preserve authorial voice and distinguish metaphor from factual assertion. Record actual editor decisions and a correction route under #71. |

No universal source count or numerical confidence score substitutes for this
review. A copied note repeated in several places is not several independent
observations. An institutional document is not automatically the whole truth;
first-person testimony is not automatically disqualified because it lacks such a
document. Missing corroboration must be described rather than invented.

Use one of these explicit dispositions for each material proposition:

- **Cleared as supported fact:** the evidence and wording support that presentation
  at the stated scope; record limitations rather than implying infallibility.
- **Cleared as attributed account:** the account is faithfully and responsibly
  presented as someone's testimony, recollection, disputed record or allegation.
  This does not certify the underlying event independently. Attribution alone is
  insufficient when the resulting presentation remains materially misleading.
- **Cleared as analysis:** the premises, reasoning and uncertainty are visible;
  no conditional mechanism is promoted into an observed event or finding.
- **Hold:** a material support, fairness, disclosure or editorial issue remains.
  Keep the affected change out of main, or revise the presentation and review it
  again. Do not rewrite the original source to make the derivative pass.

A narrowly scoped hold does not suppress a separately supportable observation or
block unrelated work. Personal reflection and metaphor need faithful authorship
and portrayal review, not invented external proof. The review concerns what the
reader is being told; it is not a requirement to win a legal case before writing.
No agent may fabricate another person's thoughts, a conversation, response, consent,
clinical finding, investigation or adjudication to complete a packet.

Right-of-reply preparation remains available under #31. Actual outside contact
requires its existing authorization under #9. When contact is necessary but not
approved, hold the affected promotion; do not contact someone automatically or
pretend silence supplied an answer. Any exception requires the responsible human
editor's explicit rationale, not an agent's convenience.

## Administrative changes and existing approvals

A PR confined to workflow documentation, code or operational maintenance can be
reviewed under the standing checked-work authority, with an explicit explanation
of why evidence gates are not applicable to its actual diff. It cannot import new
manuscript, source claims or factual endorsements through a governance label.
This policy-only setup is such a change; it clears no narrative evidence.

Chapter acceptance, publication permission and evidence review remain distinct.
The present instruction does not rescind the earlier chapter check-in or accept
another chapter. The three movements, protected closing, source grants and
separate final-edition release gate remain unchanged. Required draft disclaimers
remain in README and new relevant commit messages.

## Enforcement status and corrections

**The editorial gate is manual. New server-side enforcement is not installed.**
The inspected existing main ruleset `23806528` protects against deletion and
non-fast-forward updates. The connected tool surface has no administration-write
action for new rulesets or branch protection. [#311](https://github.com/grwtsk/huey/issues/311)
tracks PR-only protection, an eligible human review arrangement, stale-review
handling and long-lived staging-branch protection. Its acceptance requires live
read-back and behavior verification, not merely committing a configuration file.
See [GitHub's branch-protection documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
for the distinct server-side controls.

Until that task is complete, follow this review policy manually; do not claim
GitHub will reject every uncleared merge. Software checks establish only what they
test. A hash identifies bytes; a green check or owner-account comment does not
authenticate a human editorial decision. No auto-merge or truth-scoring system is
activated. Local-first checks remain primary. The original policy setup added no
hosted Actions spending. The author's later explicit request adds
[hosted repository checks](../.github/README.md) for staging work, without changing
billing settings or making software results an editorial promotion decision.

New counterevidence after promotion reopens the affected claim/review, with a
visible correction and scoped follow-up PR. Do not hide a substantive correction
as a typographical edit or silently change an original source. No source-service,
replication destination, external notification, deployment or finished-edition
release is activated by a merge under this policy.
