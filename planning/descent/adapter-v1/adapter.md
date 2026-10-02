# H447-A01 — a finite source jet and a change of reading focus

**Working draft; claim verification incomplete; not medical/legal advice or adjudicated findings.**

Prepared for Huey #447, consuming #446 and returning a bounded transition to #448.
This exact candidate is held outside public Git pending disclosure disposition.
It is an explanatory adapter and proposed operation comparison, not accepted
manuscript, a numerical model of a person, or an algebraic equivalence between
history and a theta function. The exact private declaration/version/audit ledger
is H447-JET-01/v1; that identifier is not a publication certificate.

## What the adapter takes and produces

Input A is the literal source contract: ordinary derivatives of the theta source,
its coordinate, order, normalization, determinant orientation, domain, and
version-specific proof status. Input B is the existing public literary packet:
C08A paragraph identities and attributed assertions, plus two complete admitted
cards used as separate contextual comparisons. `reading-input.json` pins that
public source and preserves every selected card's statements, qualifications,
relationships and pending editorial status.

Output is a pair of **named operations with their retained data and losses**:
finite mathematical truncation, and a change of reading focus. Each mathematical
term resolves through the restricted contract to an actual declaration. Each
literary record resolves to the source passage or admitted card. The relation
between outputs is explicitly `comparison`; `proves-history` is rejected.

The adapter does not invent a map from words, paragraph offsets, identity,
clinical events or testimony into derivative values. Therefore the stronger
claim that this source uniquely defines a literary center remains unresolved.
The minimum delivered here permits a precise finite mathematical explanation and
a worked reading transition without pretending to have supplied that missing
model. Huey #447 stays open for its broader claim; formal #224 owns any substantive
representation map subsequently consumed. Neither an entire RH program nor a new
human decision is required to continue the independent reading work.

## The actual mathematical input

For real source coordinate t, the literal source is

    Phi(t) = sum over n>=1 of
      pi*n^2*exp(5t)*(2*pi*n^2*exp(4t)-3)*exp(-pi*n^2*exp(4t)).

The maintained natural index m represents n=m+1. These are natural exponentials;
t is not a calendar, a page offset, the narrative center or the centered-xi
coordinate. No physical units or map between those coordinates is supplied here.

Write J_r(t)=d^r Phi(t)/dt^r. The source tape starts at Phi and satisfies the
ordinary derivative successor law for every natural r and every real t. Our
finite consumer keeps J_0(t0),...,J_6(t0), with t0>=0 when using its finite sign
result. It does not numerically evaluate these quantities. It does not replace
missing higher entries by zero. The source's zero-extended seven-entry helper
agrees within orders 0 through 6; its later zeros are not the actual derivatives.

The source determinant is

    D_k(J) = (-1)^(k*(k-1)/2) det [J_(i+j)]_(0<=i,j<k).

Thus D_0=1, D_1=J_0, D_2=J_1^2-J_0*J_2. Rank three has negative orientation;
rank four has positive orientation and exactly the matrix

    J0 J1 J2 J3
    J1 J2 J3 J4
    J2 J3 J4 J5
    J3 J4 J5 J6.

The finite source theorem gives nonnegativity through rank four for t0>=0;
individual ranks one through four are strictly positive. The empty determinant
is not evidence for any positive-rank or historical claim. Seven literary
crossings are not seven derivative entries.

Raw derivatives and Taylor coefficients remain different. The explicit Taylor
polynomial is sum(r=0..6) J_r(t0)*h^r/r!. It is a finite local object, not an
assertion that the polynomial equals the full source away from t0 or determines
a whole history. Feeding these factorial-divided coefficients into the raw
Hankel determinant silently changes the object. For the **synthetic**, non-theta
vector (1,2,7), the raw rank-two determinant is -3, whereas treating (1,2,7/2)
as raw gives +1/2. A convention error can change the sign.

A finite example derived from the actual source uses y=pi*n^2*exp(4t) in each
mode. Its derivative polynomial starts with P0(y)=2y-3, and

    P_(r+1)(y) = (5-4y)P_r(y) + 4y P'_r(y).
    P1(y) = -8y^2 + 30y - 15.
    P2(y) = 32y^3 - 224y^2 + 330y - 75.

If G_(k,c)(t)=sum(n>=1) n^k exp(ct) exp(-pi*n^2 exp(4t)), the source lift yields

    J0 = -3*pi*G_(2,5) + 2*pi^2*G_(4,9)
    J1 = -15*pi*G_(2,5) + 30*pi^2*G_(4,9) - 8*pi^3*G_(6,13)
    J2 = -75*pi*G_(2,5) + 330*pi^2*G_(4,9)
         -224*pi^3*G_(6,13) + 32*pi^4*G_(8,17).

The sums and derivative transport come from the actual source; our Python check
reproduces the finite polynomial recurrence, not the infinite-series proof.
The source's normalized mode representation also retains its common positive
factor pi*exp(5t-pi*exp(4t)); dropping it changes values even where sign survives.
No rescaling, logarithmic change of base, cross-node tail or Grassmannian
coordinate is silently substituted in this adapter.

## A necessary correction to the older summaries

The selected local checkpoint contains a proved **negative rank-five determinant
of the unchanged full source at t=0**, with the strict enclosure

    -4,000,000,000,000,000,000 < D5(J(0)) < -3,000,000,000,000,000,000.

This uses orders zero through eight, including an analytic bound on the infinite
mode tail. It is not a test of the zero-extended prefix or a few sampled modes.
The source also proves uniqueness of the ordinary derivative tape and refutes
the exact all-rank signed-jet criterion. It does not refute RH, a distinct
repeated-tail criterion, or a theorem about the centered-xi object.

The prior public coordination summary's description of all-rank signs as simply
open is historical and inadequate for this particular criterion. The current
formal packet preserves that history and records the local correction. The
finite rank-four result remains usable. Existence of every derivative remains
separate from the signs of determinants formed from them.

Evidence state: the existing local full-verifier log passed on the identical
committed tree; a subsequent warning-fatal root build and new-terminal axiom
audits also passed. Those logs and their recorded hashes have now been inspected.
The audited new terminal results use propext, Classical.choice and Quot.sound.
No new Lean run occurred for this adapter. The local checkpoint is newer than
the inspected remote candidate and is not accepted main or released mathematics.
A separate printed axiom audit of the all-order constructor was not located;
its module is included in the recorded root build. Do not upgrade that narrower
observation into an independently repeated audit.

## The literary carrier and allowed operation

The literary carrier is a finite set of immutable **attributed assertion
records**, with source version, paragraph/context locator, source-group locator,
status, text and limiting qualification. It is not a numerical vector of people. Grouping assertions by a narrative or
card is navigation; actual source-family relationships remain inside the cards
and are not inferred from the number of groups.
A focus operation orders selected record IDs first and renders every remaining
record as visible context. No source disappears when attention moves.

The prepared-transfer paragraph is
`he_aea5e89a-f270-4eb7-b26d-a5bfc91872f6`, in C08A's lines 83–139. Its two views are:

| View | Foreground | Retained counterpressure and limit |
| --- | --- | --- |
| Sender's preparation | The narrated preparation of papers and arrangements; notice to the wife; the apology | The narrator's continuing lack of access remains visible. Preparation is not labelled completed care. |
| Recipient's access | The narrator's report of remaining without a primary-care physician | The preparation and apology remain visible. No unseen internal step or motive is invented. |

These assertions belong to the same authored source. Three assertions do not
become three witnesses. The separately admitted source-family card tests that
representation variants do not create independent corroboration. It supports
that methodological comparison, not the narrated transfer as an event.

The next focus is paragraph `he_56dbed58-0d0e-48a7-9bdc-98c165d3ecc9`, with lines
141–175 retained. It makes the proposed receiving action specific: record the
patient's report as his report and route it to someone who can respond. Unknown
staff authority remains unknown. Reception, adjudication, and performed care
have different completion conditions.

The measurement-correction card remains a separate contextual comparison. Its
printed 6 cm, attributed correcting reply to 6 mm, and missing original amendment
all render. An available correction cannot be removed to make a closed descent
of perpetuated error. None of these statements proves the C08A telephone event.

## Exact comparison and its limit

Mathematical truncation preserves the selected derivative entries. It discards
higher-order information and cannot retain a sign conclusion for every rank.
The source's actual rank-five refutation demonstrates the failed extension.
Literary refocusing preserves each selected assertion's identity, attribution
and qualifications; it changes what the reader notices first. An unanswered
question stays a question. These are two distinct operations with inspectable
information boundaries, not interchangeable carriers or inverse maps.

The reader-facing connection is therefore **scope at an actual cut**: which
result survives this representation, and which proposed conclusion requires
something the representation does not supply? This comparison does not infer a
historical judgment from the determinant's sign. The different kinds of source
answer different propositions.

## Proposed reading bridge for #448

Placement remains provisional: a companion beside the prepared-transfer crossing,
then a return to the existing receiving-report passage. This is newly authored
editorial explanation, not a quotation, recovered memory or accepted narrator text.

A transfer can be real in the work that prepared it and unfinished in the life
that was meant to receive it. The account preserves the doctor's arrangements,
her new child, and the apology. It also preserves the narrator's continuing lack
of access to primary care. Moving attention from the papers to the patient
changes the question. It does not require either account of the work to vanish.
What, exactly, reached him?

The mathematical source supplies a disciplined example of a different kind of
limit. Seven ordinary derivative values determine the stated rank-four matrix.
They do not determine the next matrix, which needs two more derivatives. In the
full source, that next signed determinant is negative at zero. The earlier
finite result was not thereby false. Extending its conclusion without its missing
data was the failed move. The comparison concerns what a representation permits
one to conclude; the sign is not a verdict about anyone in the story.

Return now to the telephone. The narrator does not need its recipient to settle
the whole history before receiving his report. He needs the report to remain
attributable to him and to reach someone who can act. The passage leaves her
training and authority unknown; it does not leave his stated request unknown.
This gives the descent a concrete next action instead of another layer standing
in for an answer. Preparation, receipt, review, correction and care can each be
asked about separately, while the apology remains an apology and a supplied
correction remains part of the record.

For #448's practical return, SOC-I057 (advance names/roles), SOC-I056 (agenda and
routing), and SOC-I073 (performed preparation) remain separate. A proposed chart
flag is a fourth proposed action. The analogy establishes none of their receipt
or completion. No new dialogue, clinical finding, motive or ending is supplied.

## Verification and remaining work

Run `python3 -m unittest discover -s candidate -v` from the packet root. Tests
cover exact recurrence coefficients, determinant orientation, factorial drift,
finite-order limits, source/status/guard drift, missing-as-zero, preparation
promoted to completion, copied-source-as-new-witness, lost qualification,
suppressed apology/correction, and theorem-to-history implication. These are
adapter behavior tests, not Lean proofs or source authentication.

The rendering contract keeps whole records; it cannot detect arbitrary false
prose written outside the adapter or authenticate a changed input bundle. Pin
verification and actual semantic reading are separate checks. Hashes bind bytes,
not truth, authorship or consent.

The intended 1/(2*pi) gap remains a distinct source-reconciliation obligation
under formal #223; C08A's remembered fractional stroke does not define it.
No $10.46 calculation is consumed. #441 retains the existing build repair.
Public staging of this exact explanatory derivative, manuscript acceptance,
main promotion and release remain separate dispositions.
