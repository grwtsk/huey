# Explicit source correspondence v1

This bounded [#353](https://github.com/grwtsk/huey/issues/353) increment checks
ordinary revisions of an already selected source while preserving literary
identity and page boundaries. It supplies a compiler API, not an editing UI,
source intake command, manuscript writer or automatic reconciliation heuristic.
The initial page plan and strict normal compiler remain unchanged.

## Problem and boundary

An insertion within one paragraph can shift every later source range. The normal
compiler correctly rejects that drift. Reinitializing the plan would give existing
occurrences new IDs and repartition their pages. Instead, a caller now supplies a
complete explicit correspondence between the old entities and newly parsed source
ranges. The checker returns a candidate metadata plan for review.

Supported changes are ordinary inscription revisions, supported inline-markup
changes, whitespace/range shifts and source-file relocation within the permitted
manuscript tree. Existing block kinds, count and order must stay the same. All
ReadingPage IDs, memberships, boundaries and book/workspace sequences stay exact.
Literary moves, new/removal/replacement identities, split/join and changed page
boundaries remain separate work under #356/#358/#368. This API does not make those
operations impossible; it refuses to infer them as ordinary range reconciliation.

Structural checks cannot determine whether an author intends a substantial text
change as a revision of the same occurrence or a replacement by a new entity.
Nor can they distinguish swapped inscriptions from two intentional revisions
when the submitted identity order stays fixed.
The explicit correspondence is a proposal of continuity, subject to source-aware
review. Text similarity, equality, parser position and Git ancestry supply no
such decision. A valid request is not authenticated authority or literary truth.

## Inputs and exact binding

`scripts/editorial_reconcile.mjs` exports:

```js
planDigest(plan);
reconcileSource({
  before: { inventory, plan, sourceTexts },
  after: { inventory, sourceTexts },
  correspondence,
});
```

The inventories must be checked snapshots supplied by the inventory layer.
`sourceTexts` is keyed by the existing public source key, just as in assembly.
The caller is responsible for inspecting the applicable scope and supplying only
authorized before/after material. The API performs no Git lookup, directory scan,
network request or file write, and does not authenticate `scopeRefs`. A grant for
an earlier source version must not be silently extended to a new disclosure.

The correspondence document is closed: unknown or missing fields fail. It has
exactly these fields:

| Field | Meaning |
| --- | --- |
| `schema` | `huey.source-correspondence.v1` |
| `sourceKey` | One existing selected canonical/unplaced source; no new or candidate source selection. |
| `basePlanSha256` | Lowercase SHA-256 of the canonical JSON representation of the complete before-plan. |
| `before` | Exact `{revision, path, blob}` from the selected before-source. |
| `after` | Exact `{revision, path, blob}` from the selected after-source. |
| `blocks` | Complete ordered array of `{entityId, baseVersion, start, end}` assignments for that source. |

`entityId` and `baseVersion` bind an already materialized Block/Paragraph and its
exact before EntityVersion. `start`/`end` are half-open UTF-16 offsets in the exact
after Markdown. They must equal the new parser's whole-block source range; they
are not arbitrary editing boundaries or offsets into rendered text. Fine textual
editing remains grapheme-aware under the literary model; this API never splits
an inscription at the submitted offset.

The plan digest detects stale metadata, including concurrent page changes. Object
key order does not affect it; array order does. This is a metadata concurrency
guard, **not EntityVersion**, literary revision lineage, acceptance or permission.
The source Git blob checks exact Markdown bytes; it is also not EntityVersion.

## Checks and output

The checker rejects a denied/unavailable source or slot before inspecting its
supplied text. It validates both assemblies with the existing compiler and model,
including exact source pins, supported parsing and canonical ownership. The same
source key, role, target slot identity, ownership, source selection, state labels,
scope references and all unrelated inventory data must remain unchanged. Only
inventory basis/digest, the selected source's revision/path/blob and its slot's
corresponding canonical path may differ. Path changes must stay within the public
manuscript path boundary.

Every old block must appear exactly once, in its existing order, with its exact
before version. New IDs, duplicate IDs, missing assignments, stale versions,
ambiguous or partial ranges, unsupported syntax, kind/count/order changes and
unrelated inventory drift fail. Repeated equal wording remains separately
identified. The checker does not choose a range by matching its text or ordinal.

The result has this shape:

```text
{
  schema: "huey.source-reconciliation.v1",
  plan,
  changes: [{entityId, kind, beforeVersion, afterVersion, state}]
}
```

`state` is `unchanged` or `revised`, reporting exact local EntityVersion equality,
not approval or a publication state. `plan` is an independent copy of the original
plan with only the selected source pins and ranges replaced. All stable IDs,
other sources and page metadata are preserved. Neither input is mutated; the API
does not persist the result or update the registry, Markdown or browser.

The result contains metadata rather than copied prose. A changed paragraph keeps
its proposed stable ID and gets a new EntityVersion. Later shifted paragraphs keep
their versions when local state is unchanged. A file move changes provenance,
not inscription. A delimiter-only edit may change raw Markdown and source mapping
while retaining the same paragraph inscription version; presentation/source
changes must not be silently called literary revision lineage.

## Evidence and review handoff

Publication admission and evidence remain independently governed. The reconciler
does not alter their manifests or copy claim mappings. An edited working source
does not inherit the old source's evidence binding. The existing
[#352 bridge](../routes/paragraphs.md) independently requires exact selected
source path/blob, source range, raw paragraph hash and EntityVersion before
emitting correspondence. Even a markup-only edit with the same inscription
version must pass that separate source check.

A future caller can review the returned plan with the proposed authorized Markdown
and registry changes in one bounded PR. This PR supplies no apply command, host
write path, authenticated EditorialOperation, queue, reconciliation service,
historical archive or Construct bridge. It changes no current source pin or ID.
Backing out this increment removes the helper and its checks; the existing plan,
compiler, browser and admitted source/evidence pipeline continue unchanged.

## Verification and remaining work

Run `npm run test:reconcile` on the assembly's Unicode-17 runtime (tested Node
22.23.2 / ICU 78.2). Synthetic checks cover variable-length revisions, shifted
ranges, file moves, equal-valued occurrences, markup/Unicode/CRLF fidelity,
stale metadata/versions, denied reads and rejected structural changes. Real-source
compatibility uses an unchanged before/after snapshot of the selected C08A and
unplaced sources; it does not revise or newly authorize either manuscript.
Hosted checks run this suite separately from the reader's broader Node range.

#353 and #370 remain open for further authorized-source ingestion and
reconciliation. The other public candidate/support references are not adopted
or materialized by this API. A separately scoped candidate workspace projection
can expose authorized alternative material without replacing canonical chapter
ownership, inheriting admission or claiming unavailable full chapters exist.
Full literary lineage, editor migration and final typesetting remain later work.

No manuscript acceptance, evidence clearance, new source disclosure, private
material test, main promotion, deployment or edition release is performed.
RF-01, PR-01, strict Body -> Movement ownership and the three movements remain
unchanged. Software consistency does not establish factual or literary truth.
