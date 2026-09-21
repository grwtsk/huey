# RF-01 — relational framing

Controlling work: [#98](https://github.com/grwtsk/huey/issues/98).
Implementation: [#99](https://github.com/grwtsk/huey/issues/99).
Current prose and derivative repair: [#100](https://github.com/grwtsk/huey/issues/100).

## The error being corrected

The assistant repeatedly substituted a claim of racism and a demand to prove its
label for the author's description of the geometry. A partial identity repair then
continued the same misframing in its source annotations. The author corrected the
purpose: describe the arrangement faithfully, with truth open to contributions
beyond himself. Current instructions must not revert to the assistant's old frame.

This is an already supplied author direction, not a proposed human decision. It
does not declare every relation independently verified, decide a legal question,
ban the word racism, or require the opposite classification. It does not erase
historical allegations in original sources. Names must answer to the record; the
record is not rearranged to protect a preferred name.

## Preserve before classifying

For a material passage retain the people and supplied identities, the observation
or account, its source/status, its date, the receiving or selecting process, and
known or unknown relations to later representations and decisions. Some relations
are documented, others reported, modeled, contested or unknown. These distinctions
apply to personal and institutional sources alike.

Motive, internal operator and eventual classification are separate questions. An
unknown value in any of them is not permission to erase an otherwise supported
relation. Conversely, an unidentified relation is not filled in because it would
make a coherent story. No identity or credential is a proxy for credibility.

An account can be corrected by another person. A record of good care contributes
what it shows; it is not a vote erasing a different reported encounter. Contrary
material can alter particular propositions without becoming wholesale exoneration.
Preserving a report is not requiring agreement with it. It is also not merely
preserving an opinion whose subject has been removed.

## Source time and current purpose

An original essay may propose a racial mechanism. A letter may make a legal
allegation. Preserve those as the original sources, with their dates and exact
wording. The author's later clarification changes how current narration is
organized; it does not pretend the older source always contained that direction.

Keep the historical IDENTITY-R01 note and source-type map for provenance, but do
not use its claim-centered classifications as current instructions. Apply the
explicit supersession and paragraph lineage prepared under #100. The original
identity/recognition additions remain; a correction must not undo them.

The mathematical sources retain their own definitions, assumptions and proof
status. The author's relational geometry neither requires a numerical metric to
be describable nor supplies a theorem merely by using the word geometry.

## Review before writing and before handoff

Read the live master and latest author instruction. State the actual task in a
working sentence. Check the passage against its sources and ask whether an agent
has added a claim, defense, label-proof prerequisite or repetitive self-disclaimer
that the author did not supply. Check the opposite failure too: did neutrality
remove identity, testimony or known relations? Did a missing motive remove a
known event? Did an official source become the sole truth? Did the author's account?

Record exact affected passages and reasons privately when the text is restricted.
Keep before/after versions. Scope qualifications to the proposition they concern.
Do not rewrite original evidence, demand another approval of this instruction, or
turn a source limitation into a new requirement for personal retelling.

For future chapters and all packaging/export surfaces perform the same review.
Preserve the title, three movements, protected anchors and PR-01. Nothing here
licenses early explanation of the reserved closing connection or an epilogue.

## Local tools and their limits

`framing-handoff.example.json` is a source-free declaration example, not a genuine
authorization or semantic-review certificate. Its relation fields permit unknown
operators and classifications. Source kinds do not rank people. Sixteen synthetic
cases exercise both valid and invalid handoffs.

```sh
python3 -m unittest discover -s tests -p test_framing.py -v
python3 scripts/framing.py cases planning/framing-cases.json
python3 scripts/framing.py check planning/framing-handoff.example.json
python3 scripts/framing.py scan /path/to/authorized-local-manuscript.md
```

`check` and `cases` return 0 for consistent declarations, 2 for invalid input or
violations. `scan` returns 3 when a few known phrasings need review and 0 when none
was found. It never rewrites text. Its output contains fixed codes and positions,
not submitted prose. A historical quotation can legitimately match; an unfamiliar
paraphrase can evade the patterns. Neither exit 0 nor a green test is semantic
approval, source verification, consent, a verdict or a guarantee against recurrence.

Use the full existing repository suite in a complete checkout as well. Record
partial-workspace limitations honestly. Local-first checks do not activate hosted
Actions, publishing, private processing or outside contact.

## Propagation and completion

`framing-coverage.json` records the 77 pre-existing issue dispositions and 20
pre-existing PR correction references. Eight conflicting issue bodies were replaced;
69 other issues and all 20 PRs received scoped corrective comments. These are
textual links, not native dependency objects. Original state and historical test
receipts were not reopened or relabeled by those comments.

The register is a point-in-time write-receipt inventory. It is not a live GitHub
client, evidence that every future issue is covered, or proof of faithful prose.
Refresh live state before consequential work. #98/#100 remain open for the remaining
whole-book, derivative and cross-format review. No current prose acceptance or
public source grant is supplied by this contract.

## Explicit self-attribution is not imposed framing — #105

The latest author instruction supplies a first-person confession and its location
immediately before the closing excursion. Receive this source under the same
provenance discipline as other supplied statements. RF-01 is not a ban on chosen
self-description, and it must not force this statement back into uncertainty or
a euphemism merely because it contains a classification. Its author, referent and
scope are explicit; the global descriptive task and other people's accounts stay
separate. Nothing retroactively changes the earlier source record.

See [capstone-placement.md](capstone-placement.md). The source remains in the
author conversation; the revised insertion is proposed prose. Its question is
addressed to a free reader, not answered for that reader. Recognition and love
do not automatically cancel the account being given, and confession does not
complete repair by declaration. These are source-aware editorial requirements,
not a classifier or evidence about a third party.
