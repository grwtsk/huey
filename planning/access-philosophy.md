# Access as agency, material, and accountable relation

Authorial direction: R.A. Jacob Martone.  
Huey tracking: #347, #357, #364.  
Source lineage: `grwtsk/hs` founding manifesto, later author refinements, and NAV-01.

> This document imports the substantial **philosophy of access** developed in
> `grwtsk/hs` into Huey's reader/editor. It imports the governing principles,
> not Hs's literal sphere, 144×144 resting mark, WebGL presentation, `/apple`
> routing example, or any superseded separate intensity control. Huey's current
> minimal reader/editor remains the concrete presentation surface unless a later
> author instruction changes it.

## 1. The interface belongs to the person using it

Hs begins with a human behind a user agent. Huey adopts that boundary.

The interface does not acquire authority merely because it renders the book,
implements an accessibility standard, predicts a preference, observes a repeated
choice, knows a location, has a cache, or has enough computation to make an
inference. Standards, models, institutions, design systems and population
averages may constrain or inform the available presentation. They do not become
the person's agent.

A user-agent instruction is not a default. It is an instruction.

For Huey this means that presentation state, editing state, navigation state,
source state, publication state, and evidence state remain distinguishable.
Assistance may help the person reach an intended act; it may not silently turn
that act into a different one.

The governing test is not engagement. It is the amount of **unwanted work**
between a person and a chosen act.

## 2. Presence is not permission

Hs states the principle directly: presence is not permission.

Huey therefore must not infer permission or intent merely from:

- opening the page;
- hovering, dwelling, scrolling, pausing or returning;
- selecting text without committing a change;
- a cached state or earlier local draft;
- a browser or device capability;
- model confidence;
- the visibility of a control;
- an authenticated identity by itself;
- the existence of additional material that could be shown.

No idle animation, unsolicited personalization, surprise navigation, automatic
publication, evidence mutation, source admission, or permission expansion follows
from those signals.

The interface may make a capability available without demanding that the person
exercise it. Accessibility does not require a configuration ceremony before the
book can be read.

## 3. Silence is an access property, not absence

Hs distinguishes a quiet interface from an inaccessible one. Huey carries that
distinction forward.

A page can remain visually restrained while its purpose, state and available
actions remain programmatically intelligible. Conversely, adding explanation,
badges, helper copy or persistent controls can increase access cost even when each
individual element is technically accessible.

Silence therefore means:

- do not demand attention before the person asks for something;
- do not add explanatory chrome merely to prove a capability exists;
- do not confuse visual minimalism with semantic disappearance;
- do not hide necessary state from assistive technology;
- do not require sight, pointer precision, motion perception or memorized gesture
  knowledge to discover the same essential operation.

Huey's minimal toolbar, native selection/caret and semantic document structure
should remain sufficient without an additional tutorial layer becoming a
prerequisite for use.

## 4. Accessibility belongs to what the material can become

The strongest Hs accessibility rule is structural:

> Do not offer an inaccessible state and call the opportunity to select it agency.

Huey adopts that rule as an implementation constraint.

Accessibility is not a warning displayed after a failure, a separate "accessible
mode", or a cleanup pass applied after arbitrary presentation choices have already
been admitted. The reachable presentation space itself must be constrained so
that the person's operation cannot produce a state that makes the instrument or
the information unusable.

This applies to more than color.

A presentation operation must not be admitted when it would make essential text
unreadable, controls inoperable, focus indiscernible, content unreachable,
navigation ambiguous, or an edit impossible to recover. Where a requested
relation approaches such a boundary, the rendering may compress, normalize,
exchange roles, stage content, or otherwise preserve the requested direction
without crossing into failure.

The constraint belongs to the material. The person should encounter a usable
surface, not a reprimand for having moved a control "too far."

## 5. Equivalent agency must not become a dexterity test

Hs requires equivalent keyboard, assistive-technology and other authorized inputs
to carry the same agency as pointer manipulation. NAV-01 adds a specific caution:
a keyboard alternative alone does not remove every single-pointer dexterity
barrier.

Huey therefore treats equivalent operation as a semantic requirement, not an
afterthought.

For every essential operation, test the capability rather than the exact gesture:

- selection and caret placement;
- opening and dismissing formatting controls;
- changing document or local presentation;
- activating a link;
- distinguishing editing from following;
- navigating between reading units;
- exposing evidence/source context;
- restoring or abandoning a local edit.

No essential operation should require a drag, hover, timed gesture, rapid speech,
fine motor precision, color discrimination, animation perception, or a second
input that merely repeats the first intention.

Equivalent paths may differ physically. They must not differ in authority.

## 6. Density is the combined burden of design and content

Hs defines density as the whole demand placed on the person, not merely spatial
compactness. Huey imports that definition.

The burden includes:

- how many choices appear simultaneously;
- how much qualification must be held at once;
- how much explanatory structure is exposed;
- how many visual regions compete for attention;
- how much searching is required to find the next relevant action;
- how much context must be reconstructed before a claim is intelligible;
- how much interface must be understood before the book itself can be read.

A visually sparse interface can still be dense. A hidden control can impose more
burden than a visible one. A short sentence can carry more interpretive demand
than a large image.

Reducing density may stage information, defer optional detail, alter grouping or
permit a slower route. It must not delete material qualifications, sever a claim
from its provenance, convert uncertainty into certainty, or conceal that more
context exists.

Increasing density is not permission to add decoration.

Density is a budget of demand, not a measurement of the reader's mind.

## 7. Stable meanings make access trustworthy

Hs requires that learned movement/consequence relationships remain stable.
Huey's equivalent rule is that a control, gesture, link or edit must not acquire
an undisclosed second effect.

Examples:

- changing font size does not silently admit more content;
- changing document color does not publish a local edit;
- selecting text does not navigate away;
- autosave does not become submission;
- opening evidence does not alter the claim;
- following a link does not silently rewrite the link text;
- a local draft does not become a source amendment;
- an accessibility preference does not authorize unrelated personalization.

The person should not have to reverse-engineer the interface's hidden coupling.

The effect of an operation must remain attributable and inspectable.

## 8. Resistance must have a reason and an end

Hs develops "resistance" as a way for an interface or model to preserve a real
boundary without converting that boundary into domination.

Huey adopts the same distinction.

Resistance is appropriate when a requested state would:

- violate an accessibility invariant;
- obscure a material qualification;
- break source/provenance identity;
- cross a disclosure or permission boundary;
- conflate local expression with publication;
- present an unsupported proposition as established;
- create a navigation ambiguity that the system cannot responsibly resolve.

Resistance should identify the concrete reason and, where possible, offer a usable
alternative. It must preserve the person's permitted edit or local rendering when
that can be done without falsifying source/evidence state.

Resistance must not become repetition until submission. Once the person has
declined an advisory and the requested local action remains permitted, the system
should yield. The objection may remain inspectable without continuing to interrupt.

A boundary can remain firm without making the human win a contest against the
software.

## 9. Color is one materialization of the access philosophy

Huey's color system under #357 is a direct case of the Hs material-boundary rule.

The achromatic points are:

- `#1e1e1e`;
- paper `#ffffff`;
- warm white veil `rgba(255, 254, 253, .87)` over `#ffffff`.

Chromatic choice is restricted to the accessible relational system derived from
Edna's formula: **orange, green and hue**. The intermediate gamut should remain
within the intended human skin/olive continuum rather than becoming an arbitrary
accent rainbow.

The important philosophical requirement is not merely that each final swatch
passes a contrast test. The user should not be led through unreadable intermediate
states or offered a color relation that can only be repaired after selection.

Therefore:

- interpolate in a perceptually appropriate relational space;
- evaluate the rendered foreground/background pair;
- compress or resist before contrast fails;
- let light/dark exchange foreground/background roles rather than crossfade
  through sameness;
- allow forced-colors/high-contrast user-agent modes to override authored color;
- never make hue the only carrier of meaning;
- preserve the person's chosen relation where possible rather than replacing it
  with an unrelated "safe" theme.

The person keeps the relation. The presentation may change orientation.

## 10. Typography, measure and spacing obey the same rule

Typography is not decoration added after access is solved.

Local and document typography must remain relational so that global changes
preserve hierarchy rather than freezing inaccessible absolute values. Size,
measure, line-height, weight, tracking and type role must be normalized against
the document basis and current viewport/user-agent conditions.

A local style request must not:

- make text effectively disappear;
- collapse readable line-height or measure;
- make focus/caret/selection impossible to perceive;
- require horizontal scrolling for ordinary reflowed prose without a material
  reason;
- compound nested relative spans into an unusable extreme;
- rewrite lexical identity merely to achieve presentation.

Presentation may adapt. Inscription remains separately accountable.

## 11. Editing is access to expression; evidence remains accountable

Hs says that the person may edit presented text, but editing a claim does not make
the edited claim demonstrated. Huey's existing local-editor/source boundary is
therefore part of access, not merely provenance infrastructure.

The person must be able to alter local wording, organization and presentation
without the interface pretending that the canonical source, evidence ledger or
publication state changed with it.

Maintain visible distinctions among:

- source inscription;
- local draft;
- proposed correction;
- admitted/publication wording;
- evidence or proof attached to a claim;
- personal rendering or annotation.

Evidence is not protected from challenge. It is protected from silent
substitution.

A lower-density rendering may stage the evidence. It may not make the evidence
disappear or imply that no qualification exists.

## 12. Editing and following are both real capabilities

NAV-01 makes the page itself an input rather than requiring the human to restate
an intention in a second control. Huey should inherit the access principle without
copying Hs's URL-routing implementation.

Text may be both editable and navigable. Those capabilities must be visibly and
programmatically distinguishable without relying only on color.

Do not turn the same undifferentiated action into both caret placement and
navigation.

Selection, incomplete typing, IME composition, dictation correction, autosave and
local formatting must not unexpectedly navigate away. Following a link should be
an intentional activation. A local preview may refine what is shown without
discarding the active edit.

The interface's internal organization must not require the person to express the
same intention twice.

## 13. Missing, restricted and redacted are not "nothing"

Hs's author refinement on redaction rejects the false claim that no information
exists merely because the current user agent may not receive it.

Huey's inventory/traversal already represents unavailable and partial material.
The access philosophy makes that distinction normative.

Where material is unavailable, restricted, withheld, pending, offline, not
admitted, or not yet examined, the system must preserve the correct state rather
than collapse it into absence or fabricate substitute content.

Redaction may conceal content. It must not falsify existence.

A placeholder should communicate only what the current permission/source state
actually supports. It should not leak restricted content in order to prove that
something is present.

## 14. Locality may assist; it may not classify the person

Hs allows locality and caches to improve delivery and orientation while refusing
to treat proximity, popularity or accumulated use as authority over the person.

Huey adopts the same limit.

Cached or local information may reduce latency, preserve a permitted draft, or
help return to a chosen place. It does not establish:

- truth;
- preference;
- identity;
- ability;
- belief;
- permission to publish;
- permission to profile;
- permission to disclose a precise location;
- permission to expand the scope of an earlier grant.

A suggestion does not silently become a preference. A remembered state does not
silently become consent.

The cache may assist. It may not decide.

## 15. User-agent authority survives fallback and adaptation

A particular rendering technology is never the source of legitimacy.

Huey's accessible contract must survive:

- forced-colors/high-contrast modes;
- reduced motion;
- zoom/reflow;
- keyboard-only use;
- touch and single-pointer use;
- screen readers and other assistive technology;
- unavailable scripts or richer visual effects;
- narrow or enlarged viewports.

A fallback may simplify presentation. It must not replace the person's state with
different semantics, different permissions, or a reduced authority model.

The metaphor does not outrank the person.

## 16. Rigor and gentleness are not opposites

Access does not require euphemism, false balance or the deletion of difficult
material.

Hs's later NAV-01/RG-01 work makes a useful distinction: gentleness changes the
manner of address, not which identities, counterevidence, limitations or
uncertainties survive it.

For Huey this means that an accessible rendering may change pacing, grouping,
density and presentation while retaining the underlying record distinctions
required by RF-01 and the evidence model.

The interface should not make the person perform additional investigative work
because the software replaced a concrete limitation with vague caution. Where a
boundary or uncertainty matters, name the actual boundary or uncertainty.

Accessibility must not become another way to conceal what the book is saying.

## 17. The human remains at every boundary

Huey should be able to account for why each boundary exists.

- A color boundary protects usable distinction.
- A typography boundary protects readability and operation.
- A density boundary protects the person's chosen level of demand.
- An evidence boundary protects assertion from silent promotion into proof.
- A source boundary protects provenance and rights.
- A permission boundary protects the human represented by the user agent.
- A publication boundary protects local expression from unintended dissemination.

None of these boundaries exists to make the system more important.

The interface must not convert assistance into authority, convenience into
consent, prediction into instruction, or implementation complexity into work the
person must perform.

There is a human behind the user agent.

## 18. Huey-specific acceptance obligations

The reader/editor work should be rejected when an implementation:

1. offers an authored presentation state that fails the applicable accessibility
   invariant and merely warns afterward;
2. makes an essential operation depend on color, motion, fine dragging, rapid
   input, or a pointer-only path;
3. creates a keyboard path but leaves an otherwise avoidable single-pointer
   dexterity barrier;
4. changes the meaning of a control or gesture based on hidden prediction,
   popularity or experiment;
5. treats hover, dwell, visit, cache presence, silence or model confidence as
   permission;
6. conflates local editing, navigation, autosave, publication or evidence
   mutation;
7. lowers density by deleting material qualifications or source/evidence routes;
8. claims unavailable, restricted, redacted or unadmitted material does not
   exist;
9. converts forced-colors/reduced-motion/fallback rendering into a loss of state
   or agency;
10. requires the person to repeat an already expressed intention in an additional
    configuration surface without a real independent choice;
11. repeatedly pressures the person to accept an advisory after a permitted local
    choice has been made;
12. uses accessibility adaptation to rewrite inscription, source identity,
    evidentiary status or RF-01 distinctions;
13. encodes meaning only through the Edna color relation or any other visual
    channel;
14. silently turns a remembered state or local edit into a preference, profile,
    shared contribution or permission expansion.

Tests should cover the capability and the boundary, not merely the presence of a
particular widget.

## 19. Provenance of this import

This contract is derived principally from:

- `grwtsk/hs:sources/conversation/01-founding-manifesto.md`, especially
  "Be silent until chosen," "Treat density as the whole burden," "Make
  accessibility a property of the material," "Let resistance deform the shape,
  not the contract," "Change faces without passing through unreadability,"
  editable expression/evidence, locality/cache limits, and "Keep the human at
  the boundary";
- `grwtsk/hs:sources/conversation/02-author-refinements.md`, particularly the
  redaction/no-false-absence rule and the insistence that access must not become
  hiding;
- `grwtsk/hs:sources/conversation/03-edit-navigation.md` and
  `research/interaction/editing-navigation.md`, where the page itself becomes
  the input, a duplicate intensity-setting burden is removed, editing and
  following remain distinct, equivalent input includes a single-pointer
  alternative, and advisory resistance yields to permitted human agency.

The later NAV-01 correction controls over incompatible earlier Hs operational
wording. Huey does **not** import Hs's separate intensity control.

This document is a Huey-specific access contract. It does not claim that Hs is a
finished or universally accepted philosophy, does not certify WCAG conformance,
and does not replace implementation-specific testing.

It does establish the governing design premise for #357/#364:

**access is the condition under which the person can act without the interface
acquiring the person's agency.**
