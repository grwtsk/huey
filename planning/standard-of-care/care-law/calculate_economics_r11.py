#!/usr/bin/env python3
"""Recompute HUEY-CL11 economic scenarios from versioned public inputs.

Scenarios are not observed UCSF expenditures, forecasts, damages, or findings of
avoidable harm. Standard library only.
"""
from __future__ import annotations
import argparse, json
from pathlib import Path

def compute(model: dict) -> dict:
    src={s["id"]:s for s in model["sources"]}
    a=model["assumptions"]
    H=a["oews_hours_per_year"]

    annual={
        "E02":src["E02"]["value"], "E03":src["E03"]["value"],
        "E04":src["E04"]["value"], "E05":src["E05"]["value"],
        "E06":src["E06"]["value"], "E07":src["E07"]["value"],
        "E08":src["E08"]["value"], "E09":src["E09"]["value"],
    }
    rate={k:v/H for k,v in annual.items()}

    wage_institutional=sum(row["hours"]*rate[row["wage_source"]] for row in a["review_role_hours"])
    patient_support=(a["patient_hours"]+a["support_person_hours"])*rate["E09"]

    clinical_hours=sum(row["hours"] for row in a["review_role_hours"] if row.get("clinical_capacity_eligible"))
    other_wage=wage_institutional-clinical_hours*rate["E02"]
    load=(src["E10"]["wages_per_hour"]+src["E10"]["benefits_per_hour"])/src["E10"]["wages_per_hour"]
    loaded_other=other_wage*load

    dox=src["E11"]; ama=src["E12"]
    physician={}
    for name in ("neurology","academic","san_francisco"):
        annual_comp=dox[name]
        physician[name]={
            "all_work":annual_comp/(ama["total_hours_per_week"]*52),
            "direct_care":annual_comp/(ama["direct_patient_care_hours_per_week"]*52),
        }

    review={
        "wage_only":{"institutional":wage_institutional,"patient_support":patient_support,
                     "combined":wage_institutional+patient_support}
    }
    for name in ("neurology","academic","san_francisco"):
        for basis in ("all_work","direct_care"):
            inst=loaded_other+clinical_hours*physician[name][basis]
            review[f"{name}_{basis}_loaded"]={"institutional":inst,"patient_support":patient_support,
                                               "combined":inst+patient_support}

    p=a["prevention"]
    staff_low=rate[p["staff_low_source"]]*load
    staff_high=rate[p["staff_high_source"]]*load
    prevention={}
    for name in ("academic","san_francisco"):
        pr=physician[name]["direct_care"]
        one=pr*p["one_time_physician_minutes"]/60
        physician_rec=pr*p["recurring_physician_seconds"]/3600
        low=physician_rec+staff_low*p["recurring_staff_minutes"]/60
        high=physician_rec+staff_high*p["recurring_staff_minutes"]/60
        prevention[name]={
            "one_time_note":one,"recurring_low":low,"recurring_high":high,
            "forty_year_12_low":one+480*low,"forty_year_12_high":one+480*high,
        }

    c42=a["sensitivity_cycles"]["seven_year_example"]
    c480=a["sensitivity_cycles"]["forty_year_monthly_example"]
    return {
        "rates":rate,"healthcare_employer_load_ratio":load,"physician_opportunity":physician,
        "review":review,"prevention":prevention,
        "forty_two_cycle":{
            "wage_only":review["wage_only"]["combined"]*c42,
            "academic_all_work_loaded":review["academic_all_work_loaded"]["combined"]*c42,
            "academic_direct_loaded":review["academic_direct_care_loaded"]["combined"]*c42,
            "sf_direct_loaded":review["san_francisco_direct_care_loaded"]["combined"]*c42,
            "patient_support_hours":(a["patient_hours"]+a["support_person_hours"])*c42,
        },
        "four_hundred_eighty_cycle":{
            "wage_only":review["wage_only"]["combined"]*c480,
            "academic_all_work_loaded":review["academic_all_work_loaded"]["combined"]*c480,
            "academic_direct_loaded":review["academic_direct_care_loaded"]["combined"]*c480,
            "sf_direct_loaded":review["san_francisco_direct_care_loaded"]["combined"]*c480,
            "patient_support_hours":(a["patient_hours"]+a["support_person_hours"])*c480,
        }
    }

def main() -> int:
    ap=argparse.ArgumentParser()
    ap.add_argument("--model",type=Path,default=Path(__file__).with_name("economics-r11-model.json"))
    ns=ap.parse_args()
    model=json.loads(ns.model.read_text(encoding="utf-8"))
    print(json.dumps(compute(model),indent=2,sort_keys=True))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
