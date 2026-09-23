#!/usr/bin/env python3
"""Validate Huey public evidence certificates and index.

This checks public structure and privacy invariants. It does not authenticate
sources, verify claims, or inspect a private repository.
"""
from __future__ import annotations
import csv, hashlib, io, json, re, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
EVID=ROOT/"evidence"
CERT=EVID/"certificates"
INDEX=EVID/"index.tsv"
CLASSES={"PUBLIC_OPEN","PUBLIC_ALREADY_DISCLOSED","PRIVATE_RAW_PUBLIC_DERIVATIVE","PRIVATE_SENSITIVE"}
REL={"supports","contradicts","limits","context","duplicate","same_source_family","supersedes","provenance_only","unresolved"}
PRIVATE_FORBIDDEN=("private_repository","private_path","raw_salt","original_filename","credential","token")

def fail(msg):
    raise ValueError(msg)

def main()->int:
    rows=list(csv.DictReader(io.StringIO(INDEX.read_text(encoding="utf-8")),delimiter="\t"))
    seen=set()
    for r in rows:
        eid=r["evidence_id"]
        if not re.fullmatch(r"HUEY-EV-[0-9a-fA-F-]{36}",eid): fail(f"bad id {eid}")
        if eid in seen: fail(f"duplicate {eid}")
        seen.add(eid)
        if r["classification"] not in CLASSES: fail(f"bad classification {eid}")
        cp=ROOT/r["certificate"]
        if not cp.is_file(): fail(f"missing certificate {eid}")
        c=json.loads(cp.read_text(encoding="utf-8"))
        if c["evidence_id"]!=eid: fail(f"id mismatch {eid}")
        if c["classification"]!=r["classification"]: fail(f"class mismatch {eid}")
        raw=c["custody"]["raw_custody"]
        integ=c["integrity"]
        serialized=json.dumps(c).lower()
        if raw=="private_repository":
            if integ["mode"]!="private_salted_commitment" or integ.get("raw_sha256") is not None: fail(f"private hash leak {eid}")
            if not re.fullmatch(r"[0-9a-f]{64}",integ.get("public_commitment") or ""): fail(f"bad commitment {eid}")
            for word in PRIVATE_FORBIDDEN:
                if word in serialized: fail(f"forbidden private field token {word} in {eid}")
        elif raw=="huey_public":
            if integ["mode"]!="public_sha256": fail(f"public mode {eid}")
            digest=integ.get("raw_sha256") or ""
            if not re.fullmatch(r"[0-9a-f]{64}",digest): fail(f"public sha {eid}")
            p=c["custody"].get("public_raw_path")
            if not p: fail(f"missing public path {eid}")
            fp=ROOT/p
            if not fp.is_file(): fail(f"missing public raw {eid}")
            if hashlib.sha256(fp.read_bytes()).hexdigest()!=digest: fail(f"raw digest mismatch {eid}")
        else:
            fail(f"bad custody {eid}")
        for rel in c.get("relationships",[]):
            if rel["relationship"] not in REL: fail(f"bad relationship {eid}")
            if not rel["locator"] or not rel["contribution"] or not rel["does_not_establish"]: fail(f"incomplete relationship {eid}")
        if not c.get("limits"): fail(f"missing limits {eid}")
    print(json.dumps({"result":"PASS","index_rows":len(rows),"certificates":len(seen),
                      "limits":"Structure/privacy/integrity checks only; not authenticity, truth, receipt/review or legal sufficiency."},indent=2))
    return 0

if __name__=="__main__":
    try: raise SystemExit(main())
    except (OSError,ValueError,KeyError,json.JSONDecodeError) as exc:
        print(f"FAIL: {exc}",file=sys.stderr); raise SystemExit(1)
