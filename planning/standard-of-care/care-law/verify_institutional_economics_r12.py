#!/usr/bin/env python3
"""Structural checks for HUEY-CL12 institutional responsibility matrix.

Does not verify historical facts, jurisdiction, legal applicability, cost, breach,
or manuscript acceptance. Standard library only.
"""
from __future__ import annotations
import copy, csv, io, json
from pathlib import Path

ROOT=Path(__file__).resolve().parent
DATA=ROOT/"institutional-economics-r12.json"
TSV=ROOT/"institutional-economics-r12.tsv"
MD=ROOT/"institutional-economics-r12.md"

LEVELS={"L1","L2","L3","L4"}
ISSUES={183,184,185,324,325,326,327}

def check(data:dict)->None:
    assert data["repository"]=="grwtsk/huey"
    assert data["work_id"]=="HUEY-CL12"
    assert data["status"]=="framework-complete-case-application-open"
    assert len(data["notice_states"])==10
    assert len(set(data["notice_states"]))==10
    sources={s["id"]:s for s in data["sources"]}
    assert len(sources)==14
    assert all(s.get("name") and s.get("type") and s.get("locator") and s.get("limit") for s in sources.values())
    assert {x["id"] for x in data["levels"]}==LEVELS
    for level in data["levels"]:
        assert set(level["authority"])<=set(sources)
        assert level["actual_functions"]
        assert level["excluded_functions"]
        assert level["contrary_or_limit"]
        assert level["repair"]
        assert level["forum"]
        assert level["unresolved"]
        assert level["notice_application"]
        assert level["narrative_destination"]
    assert data["closure"]["framework_complete"] is True
    assert data["closure"]["case_application_complete"] is False

def negative(data:dict)->list[str]:
    cases=[]
    def add(name,fn):
        x=copy.deepcopy(data); fn(x); cases.append((name,x))
    add("wrong-repository",lambda x:x.update(repository="grwtsk/neurology"))
    add("invented-case-completion",lambda x:x["closure"].update(case_application_complete=True))
    add("lost-source",lambda x:x["sources"].pop())
    add("lost-source-limit",lambda x:x["sources"][0].update(limit=""))
    add("missing-level",lambda x:x["levels"].pop())
    add("unknown-authority",lambda x:x["levels"][0].update(authority=["I99"]))
    add("lost-excluded-functions",lambda x:x["levels"][1].update(excluded_functions=[]))
    add("lost-counterevidence",lambda x:x["levels"][2].update(contrary_or_limit=""))
    add("lost-repair",lambda x:x["levels"][3].update(repair=""))
    add("notice-state-promotion",lambda x:x.update(notice_states=["agreed_or_authorized"]*10))
    rejected=[]
    for name,x in cases:
        try: check(x)
        except (AssertionError,KeyError):
            rejected.append(name); continue
        raise AssertionError("invalid mutation accepted: "+name)
    return rejected

def main()->int:
    data=json.loads(DATA.read_text(encoding="utf-8"))
    check(data)
    rows=list(csv.DictReader(io.StringIO(TSV.read_text(encoding="utf-8")),delimiter="\t"))
    assert len(rows)==40
    assert [r["unit"] for r in rows]==[f"HUEY-CL12-U{i:03d}" for i in range(1,41)]
    assert all(int(r["issue"]) in ISSUES for r in rows)
    assert all(r["level"] in LEVELS|{"ALL"} for r in rows)
    text=MD.read_text(encoding="utf-8")
    for phrase in ("UCSF / UCSF Health","University of California","Medical Board of California","California's distributed public architecture","does not close #327"):
        assert phrase in text
    bad=negative(data)
    assert len(bad)==10
    print(json.dumps({"result":"PASS","sources":14,"levels":4,"units":40,"negative_tests_passed":bad,
        "limits":"Structural checks only; not factual verification, jurisdiction, liability, cost or manuscript acceptance."},indent=2))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
