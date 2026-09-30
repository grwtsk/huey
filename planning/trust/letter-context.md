# September 30 letter: context and source boundaries

Task: [#464](https://github.com/grwtsk/huey/issues/464). Governing integration: [Trust in Huey](../../TRUST.md). Literary application: [weaving.md](weaving.md).

**This is a source-derived editorial map, not a replacement for the original letter.** It records the meaning to be carried into Huey and the distinctions that must travel with it. No new patient testimony, clinician endorsement, factual clearance, legal determination or manuscript acceptance is supplied by this document.

## Source and present authority

The source is R.A. Jacob Martone's September 30, 2026 letter, **$8.76 of Trust—Billing Integrity, Immediate Safety Documentation, Disability-Accessible Care, Independent Investigation, and California-Wide Accountability**, prepared in the Huey conversation and emitted there as a 15-page PDF. The letter is patient-authored and AI-assisted. The author's current instruction expressly requests its trust context in the repository's issues and standards. [#2's receipt](https://github.com/grwtsk/huey/issues/2#issuecomment-5917439623) records the bounded public derivative/annotation scope.

The original PDF remains on its supplied conversation surface; no raw clinical archive or private evidence is uploaded with this map. References below identify sections and PDF pages so the author and authorized reviewers can return to the actual source. A source's citation list is a set of research leads and prior attribution, not a claim that this integration independently reread every external authority.

The letter is distinct from the earlier safety-response letter tracked in #386. Neither is a receipt proving mailing, payment, record entry, an accepted referral, a completed investigation or an implemented training program.

## 1. A small cost opens a large responsibility question

Source: Three minutes, three safety instructions, and an accounting, pp. 1–2; What $8.76 means to me, pp. 5–6.

The letter uses a cited San Francisco regional neurologist salary estimate of $364,300 annually and an assumed 2,080-hour working year. It assigns an illustrative minute to reviewing/documenting each of three already-supplied safety instructions. None of these assumptions measures Dr. Bledsoe's actual salary, a billable rate, actual documentation time, institutional marginal cost, benefits, overhead or payer rules. Three minutes is not a ceiling on clinically necessary work.

The numerical inputs are source-letter inputs. Arithmetic was recomputed in this integration; the regional salary source and reported tax information were not independently authenticated here.

| Quantity | Input or arithmetic result | Status and limit |
| --- | --- | --- |
| Regional annual salary | $364,300 | Letter-cited estimate, not a named physician's compensation |
| Annual working time | 2,080 hours | Express assumption |
| Salary-equivalent hour | $175.144230769… | Annual estimate divided by assumed hours |
| Salary-equivalent second | $0.048651175213675… | Hourly equivalent divided by 3,600 |
| Each instruction | 60 assumed seconds; $2.9190705128… → $2.92 | Unmeasured documentation illustration |
| Three instructions | 180 assumed seconds; $8.7572115384… → $8.76 | Not a proposed clinical fee schedule |
| Author's reported 2025 AGI | $10,509 | Author-supplied income measure, not a bank-derived finding |
| $8.76 as a share of that AGI | 0.083357122466…% | A relative-burden illustration |
| Same share of regional gross salary | $303.6699971453… → $303.67 | Different income bases; not an amount another person owes |

Recompute using decimal arithmetic and rounding to cents only where displayed:

```python
from decimal import Decimal, localcontext, ROUND_HALF_UP
with localcontext() as ctx:
    ctx.prec = 36
    salary = Decimal('364300')
    hours = Decimal('2080')
    agi = Decimal('10509')
    offered = Decimal('8.76')
    per_second = salary / (hours * Decimal('3600'))
    cents = lambda value: value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    assert cents(per_second * Decimal('180')) == offered
    assert cents(offered / agi * salary) == Decimal('303.67')
```

The prior $10.46 benchmark in #445/#453 is a different, historical source scenario whose derivation remains with #30. Do not overwrite its amount, retrofit this formula to it, or silently label it an error. Future comparisons need separate scenario IDs, tasks, inputs, dates and rounding methods under the existing computation owner.

The letter offers a conditional, good-faith tender and asks for lawful billing treatment. It does not establish that a check was sent or cashed, that a contract was formed, that a particular charge is permissible, or that an existing duty can be sold to the person entitled to it. Its no-disability-surcharge position belongs to legal review under #184, not to the salary calculation. Preserve the distinction between ordinary treatment charges, a required accommodation and a separately identified optional service.

The literary force is the change of scale: a few seconds on one ledger become a meaningful fraction of a disabled person's income and an extended burden in a family's life. That comparison does not require making human worth commensurable with wages.

## 2. The three safeguards are different acts

Source: proposed chart language, p. 2.

**People.** Identify the physicians and other expected participants, their roles and reasons for being present before a non-emergency examination, to the extent reasonably known; explain changes before participation. This is preparation and informed participation, not a demand for an impossible guarantee about every contingency.

**Exit and pause.** Orient the patient to the room, an accessible exit and an appropriate place to pause; establish assistance in light of mobility limitations. Permission to stop should not first have to be negotiated when panic has already impaired communication.

**A usable signal.** Establish and confirm a reliable written or nonverbal way to communicate panic, request a pause or withdraw consent. The source reports impaired deliberate expression under stress even where little outward change is apparent. Preserve the distinction between awareness and rapid outward agency; do not turn silence into consent or absence of distress.

These requests are not identical to the presence of a clinician, an offered appointment, an initial explanation of touch or a device the patient owns. Existing owners #250/#251/#252/#257/#266–#268 should distinguish the request, clinical review, record entry, discoverability, pre-visit preparation and use during an encounter. No proposed note in this repository is a clinician-signed care plan.

## 3. The room, testimony and continuing consequences

Source: The room has not fallen silent, pp. 2–3.

The letter presents the author's account of the Stanford encounter, his wife's presence, hostile speech, unwanted continued physical contact, a look he understood as racial hostility toward his wife, and continuing traumatic memory. It alleges racially hostile abuse and medical battery and requests investigation as a hate crime. Do not substitute a benign bedside-manner disagreement for that actual allegation. Do not convert the allegation into an adjudicated crime either.

The remembered room's continuing sound is presented as traumatic memory, not a claim that the physician is presently in the author's room or currently speaking. The letter's testimony about experience and consent remains distinct from clinical causation, discriminatory motive, statutory elements and adjudication.

Its authority claim concerns the author's intended testimony and consent, not the erasure of other competent roles. Failure to investigate supplies neither an institutional answer nor a finding that the author's account is false. Conversely, source-preservation does not require another participant to adopt all of his conclusions.

The letter uses January 24, 2019. That is its dated source wording. #442 separately requires direct inspection of the actual AVS's encounter-date field before revising the active narrative. This new source must not silently decide that pending source-specific task. #443's rejected interpretation of The Distance is likewise not rehabilitated by thematic resemblance to this letter.

## 4. Standards must reach the encounter

Source: Determine the standard—and distinguish it from a billing code, pp. 3–5.

The letter invokes AMA patient-welfare priority; UCSF patient-rights language; UC ethical accountability for acts and decisions not to act; clinical-record adequacy; effective communication; reasonable modification; and California nondiscrimination provisions. Those are differently situated authorities, not interchangeable certifications of this patient's history.

The institutional question is operational: which measure is ordinary preparation, clinically necessary safety documentation, a required accommodation, an optional service, or a measure for which an effective alternative is offered? Who decides, on what basis, with what review route? Preserve that question rather than substituting either a fee calculation or a list of statutes for its answer.

#184 owns current/historical law and applicability; #192/#450 own exact primary institutional/authority language; #325 owns notice-state verification; #327 and #452 own actor-level responsibility and narrative application. This integration does not independently refresh cited laws, deadlines, policies or professional standards. It creates no new research monopoly or prerequisite to present care.

## 5. Communication and trust preceded the complaint

Source: I have been communicating for years, pp. 5–7; An interface is not accessible because the institution prefers it, pp. 7–8.

The author recounts a circa-2018 letter to Christopher Chin at Palo Alto Medical Foundation describing symptoms and requesting coordination, after earlier disclosures concerning inherited disease. He also describes books carried and lent, more than thirty-five years of study, art used with deliberate expressive precision, research shared to begin mathematical discussion, a career in accessible interfaces, and financial/family lessons about trust.

These are established forms of attempted relation in the source. They are not a late demand that medicine become an unlimited correspondence service. Nor does professional achievement, intellectual ability or reach confer a greater right to dignity than anyone else possesses.

The original Chin letter has not been supplied in this reviewed letter packet. Obtain it and its routing/response history through the existing evidence owners. Reading it might have changed parts of a diagnostic or coordination pathway; the letter does not establish that it would have prevented every later loss.

Books and art are not payment for agreement. Mathematical research is not automatically endorsed or clinically validated because it was given to a neurologist. Family recollections, financial-sector roles and the Weill name are not evidence of an institutional command chain or conspiracy. Preserve the distinct source histories already tracked by #330/#331 rather than reconciling dates, ages or relationships through association.

The communication problem includes reception, comprehension, integration, qualification and response, not only the mechanics of speech output. WCAG references belong to digital-access specifications and their actual versions; they do not exhaust individualized clinical communication. No conformance certificate is created here. A stable portal can remain unusable, and a usable interface can remain an unreliable sole route. Existing #123/#138/#191/#244–#255 and #357/#383 own the relevant work.

## 6. Evidence collection should reduce, not multiply, unsupported retelling

Source: Obtain the originals; preserve the distinctions, p. 8 and following.

The letter expressly identifies unavailable original material: the circa-2018 Chin letter, the particular public reports of abusive conduct or racism, and the original private disclosures. Record the exact requested object, likely custodian or existing source owner where known, retrieval status, permitted scope and unresolved question. Do not report that this pass obtained any of them.

Preserve contrary evidence, the separately attributed witness account, disputed clinical records, versions, source measurements and relevant routing information. A later patient letter is evidence of what was reported, not independent authentication of everything it refers to. Copies do not multiply witnesses. A record-preservation request is not proof that a litigation hold or amendment was implemented.

Use #18/#25/#145/#176/#193/#306/#307 and the existing private-vault/public-derivative boundary. Do not expose restricted raw material to demonstrate zeal. The patient's ability to repeat trauma is not the appropriate measure of a coordinator's diligence.

## 7. Reciprocity becomes coordination and public accountability

Source: Do the coordination work that disability prevents me from doing alone, pp. 8–10; California must be able to examine California, pp. 10–11; Copies and affirmative routing requested, pp. 11–12.

The letter asks for a named coordinator to carry record retrieval, accessibility, clinical input, review and appropriate referrals across institutional boundaries. It asks for recipient-specific consent review before additional medical records are transmitted. The requested outcome is a completed, attributable handoff, not another directory of numbers the patient must call.

The ten-business-day and thirty-calendar-day periods are requested response periods. The letter does not make all obligations subject to one statutory deadline. Preserve the difference between proposed routing, authorized transmission, actual receipt, casework acceptance and completed action. This repository task sends no letters or emails and opens no casework or complaint outside GitHub.

Its six-county distribution request and class-wide-remedy inquiry enlarge the public question without identifying a certified class or proving a statewide prevalence. California v. California is the letter's rhetorical description of public responsibility examining itself, not an actual case caption. Historical claims require qualified, jurisdiction-specific review; present accessible care proceeds on its own clinical/access footing. #184/#325/#327/#452 retain these questions.

## 8. The final object is smaller than the argument

Source: This is not a demand for money or silence, pp. 12–13; My final request is something I can carry, p. 13.

The letter requests no payment in exchange for silence or withdrawal. It distinguishes willingness to pay a lawful optional expense from waiving existing rights, asks the institution to carry its responsibilities, and proposes investment in medical-trauma education. Those are requests and positions, not evidence of a payment, settlement, donation or implemented program.

Its final request is a durable communication aid, potentially a wallet card with a discreet wearable pointer, backed by a dated clinician-reviewed plan. It should identify communication and examination needs without exposing the entire history or allegations about another physician. It must not imply a DNR, incapacity from limited speech, or an instruction to attribute every new symptom to PTSD. It is proposed for individual clinical review, not an agent-issued medical ID.

That small object connects safety, reliable representation, privacy, accountable expertise, emergency continuity and trust in a future reader. In Huey, its function belongs within the continuing flow before the protected close. It must not become an explanatory epilogue after Edna.

## What this context does not settle

Original-source retrieval; historical/current clinical or legal standards; contested motive and causation; AVS date; actual care, payment, mailing, receipt or referral; the older $10.46 derivation; source clearances; human review of new prose; and the availability of the requested medical aid remain distinct work. The letter's force is preserved by keeping those questions answerable, not by claiming this map answered them.
