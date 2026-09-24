#!/usr/bin/env python3
"""Bounded regression checks for HUEY-CL11. Does not verify source truth."""
from __future__ import annotations
import copy, json, math
from pathlib import Path
from calculate_economics_r11 import compute

ROOT=Path(__file__).resolve().parent
MODEL=ROOT/"economics-r11-model.json"
UNITS=ROOT/"economics-r11-units.tsv"
SUMMARY=ROOT/"economics-r11.md"

def near(a,b,tol=.015):
    return abs(a-b)<=tol

def check(model: dict) -> dict:
    assert model["repository"]=="grwtsk/huey"
    assert model["work_id"]=="HUEY-CL11"
    assert model["status"]=="reference-economic-audit-not-manuscript-acceptance"
    assert len(model["sources"])==15
    assert all(s.get("limit") for s in model["sources"])
    assert sum(x["hours"] for x in model["assumptions"]["review_role_hours"])==28
    assert model["assumptions"]["patient_hours"]+model["assumptions"]["support_person_hours"]==33
    r=compute(model); e=model["expected_rounded"]
    assert near(r["rates"]["E09"],e["all_occupations_hourly_proxy"])
    assert near(r["healthcare_employer_load_ratio"],e["healthcare_employer_load_ratio"],.00015)
    pairs=[
      (r["review"]["wage_only"],e["review_wage_only"]),
      (r["review"]["academic_all_work_loaded"],e["review_academic_all_work_loaded"]),
      (r["review"]["academic_direct_care_loaded"],e["review_academic_direct_loaded"]),
      (r["review"]["san_francisco_direct_care_loaded"],e["review_sf_direct_loaded"]),
      (r["prevention"]["academic"],e["prevention_academic"]),
      (r["prevention"]["san_francisco"],e["prevention_sf"]),
      (r["forty_two_cycle"],e["forty_two_cycle"]),
      (r["four_hundred_eighty_cycle"],e["four_hundred_eighty_cycle"]),
    ]
    for actual,expected in pairs:
        for k,v in expected.items():
            assert near(actual[k],v,.02), (k,actual[k],v)
    return r

def mutations(model: dict) -> list[str]:
    cases=[]
    def add(name,fn):
        x=copy.deepcopy(model); fn(x); cases.append((name,x))
    add("wrong-repository",lambda x:x.update(repository="grwtsk/neurology"))
    add("invented-observed-status",lambda x:x.update(status="observed-ucsf-cost"))
    add("lost-source",lambda x:x["sources"].pop())
    add("changed-lawyer-wage",lambda x:x["sources"][6].update(value=999999))
    add("changed-patient-hours",lambda x:x["assumptions"].update(patient_hours=100))
    add("changed-role-hours",lambda x:x["assumptions"]["review_role_hours"][0].update(hours=30))
    add("changed-ecec-wage",lambda x:x["sources"][9].update(wages_per_hour=1))
    add("changed-ecec-benefits",lambda x:x["sources"][9].update(benefits_per_hour=100))
    add("changed-ama-hours",lambda x:x["sources"][11].update(direct_patient_care_hours_per_week=1))
    add("changed-doximity-comp",lambda x:x["sources"][10].update(academic=1))
    add("changed-cycle-count",lambda x:x["assumptions"]["sensitivity_cycles"].update(seven_year_example=420))
    add("lost-limit",lambda x:x["sources"][12].update(limit=""))
    rejected=[]
    for name,x in cases:
        try:
            if name=="wrong-repository": assert x["repository"]=="grwtsk/huey"
            elif name=="invented-observed-status": assert x["status"]=="reference-economic-audit-not-manuscript-acceptance"
            elif name=="lost-source": assert len(x["sources"])==15
            elif name=="lost-limit": assert all(s.get("limit") for s in x["sources"])
            else:
                check(x)
        except (AssertionError,KeyError,ZeroDivisionError):
            rejected.append(name); continue
        raise AssertionError("invalid mutation accepted: "+name)
    return rejected

def main() -> int:
    model=json.loads(MODEL.read_text(encoding="utf-8"))
    result=check(model)
    unit_lines=[x for x in UNITS.read_text(encoding="utf-8").splitlines() if x.strip()]
    assert len(unit_lines)==41
    ids=[x.split("\t",1)[0] for x in unit_lines[1:]]
    assert ids==[f"HUEY-CL11-U{i:03d}" for i in range(1,41)]
    text=SUMMARY.read_text(encoding="utf-8")
    for phrase in ("not observed UCSF costs","$2,720.75","$3,960.73","$4,219.55","671,440","15 million"):
        assert phrase in text
    bad=mutations(model)
    assert len(bad)==12
    print(json.dumps({
      "result":"PASS",
      "sources":15,
      "tracked_units":40,
      "negative_tests_passed":bad,
      "limits":"Structural/arithmetic checks only; not source authentication, damages, legal applicability, avoidability, or manuscript acceptance."
    },indent=2))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
