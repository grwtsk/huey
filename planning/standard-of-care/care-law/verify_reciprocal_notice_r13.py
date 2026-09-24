#!/usr/bin/env python3
"""Structural checks for HUEY-CL13 reciprocal notice matrix.

Does not determine legal sufficiency of notice, knowledge, consent, waiver,
estoppel, breach, retaliation, discharge rights or liability.
"""
from __future__ import annotations
import copy, csv, io, json
from pathlib import Path

ROOT=Path(__file__).resolve().parent
DATA=ROOT/"reciprocal-notice-r13.json"
TSV=ROOT/"reciprocal-notice-r13.tsv"
MD=ROOT/"reciprocal-notice-r13.md"

COMM={f"N{i:02d}" for i in range(1,7)}
STATES=["authored","recorded","routed","delivered_or_available","received","accessible","reviewed","understood_or_reasonable_opportunity","acknowledged","agreed_or_authorized"]
STATUSES={"supported_by_source_object","reported_in_patient_source","supported_by_other_party_source","unknown","not_established","expressly_disputed","not_applicable"}
ISSUES={180,181,183,184,187,324,325}

def check(d:dict)->None:
    assert d["repository"]=="grwtsk/huey"
    assert d["work_id"]=="HUEY-CL13"
    assert d["status"]=="case-matrix-partial-evidence-open"
    assert d["notice_states"]==STATES
    assert set(d["evidence_statuses"])==STATUSES
    src={s["id"]:s for s in d["sources"]}
    assert len(src)==7 and all(s.get("name") and s.get("type") and s.get("locator") and s.get("limit") for s in src.values())
    rows={x["id"]:x for x in d["communications"]}
    assert set(rows)==COMM
    for r in rows.values():
        assert set(r["source_ids"])<=set(src)
        assert set(r["states"])==set(STATES)
        for state in STATES:
            assert r["states"][state]["status"] in STATUSES
            assert r["states"][state]["basis"]
        assert r["strongest_supported_conclusion"]
        assert r["contrary_or_unknown"]
        assert r["next_evidence"]
    assert rows["N04"]["states"]["received"]["status"]=="supported_by_other_party_source"
    assert rows["N04"]["states"]["reviewed"]["status"]=="supported_by_other_party_source"
    assert rows["N04"]["states"]["agreed_or_authorized"]["status"]=="expressly_disputed"
    assert rows["N01"]["states"]["received"]["status"]!="supported_by_other_party_source"
    assert rows["N06"]["states"]["received"]["status"]=="unknown"
    assert d["closure"]["case_matrix_created"] is True
    assert d["closure"]["legal_sufficiency_resolved"] is False
    assert d["closure"]["july_identity_resolved"] is False
    assert d["closure"]["institution_review_resolved"] is False

def negative(d:dict)->list[str]:
    cases=[]
    def add(name,fn):
        x=copy.deepcopy(d); fn(x); cases.append((name,x))
    add("wrong-repository",lambda x:x.update(repository="grwtsk/neurology"))
    add("lost-source",lambda x:x["sources"].pop())
    add("lost-source-limit",lambda x:x["sources"][0].update(limit=""))
    add("lost-communication",lambda x:x["communications"].pop())
    add("invented-july-receipt",lambda x:x["communications"][0]["states"]["received"].update(status="supported_by_other_party_source"))
    add("invented-sep17-receipt",lambda x:x["communications"][5]["states"]["received"].update(status="supported_by_other_party_source"))
    add("invented-sep9-agreement",lambda x:x["communications"][3]["states"]["agreed_or_authorized"].update(status="supported_by_other_party_source"))
    add("erase-sep9-review",lambda x:x["communications"][3]["states"]["reviewed"].update(status="unknown"))
    add("resolve-july-identity",lambda x:x["closure"].update(july_identity_resolved=True))
    add("claim-legal-sufficiency",lambda x:x["closure"].update(legal_sufficiency_resolved=True))
    add("duplicate-notice-states",lambda x:x.update(notice_states=["authored"]*10))
    add("missing-basis",lambda x:x["communications"][2]["states"]["authored"].update(basis=""))
    rejected=[]
    for name,x in cases:
        try: check(x)
        except (AssertionError,KeyError):
            rejected.append(name); continue
        raise AssertionError("invalid mutation accepted: "+name)
    return rejected

def main()->int:
    d=json.loads(DATA.read_text(encoding="utf-8"))
    check(d)
    rows=list(csv.DictReader(io.StringIO(TSV.read_text(encoding="utf-8")),delimiter="\t"))
    assert len(rows)==40
    assert [r["unit"] for r in rows]==[f"HUEY-CL13-U{i:03d}" for i in range(1,41)]
    assert all(int(r["issue"]) in ISSUES for r in rows)
    text=MD.read_text(encoding="utf-8")
    for phrase in ("reported delivered","received and reviewed","blanket assent expressly withheld","evidentiary before it is legal","does **not** close #325 or #187"):
        assert phrase in text
    bad=negative(d)
    assert len(bad)==12
    print(json.dumps({"result":"PASS","sources":7,"communications":6,"notice_states":10,"units":40,
        "negative_tests_passed":bad,
        "limits":"Structural evidence-state checks only; not legal sufficiency, breach, knowledge, consent, waiver or liability."},indent=2))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
