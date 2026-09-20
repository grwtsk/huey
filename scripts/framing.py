"""Read-only RF-01 handoff checks and a limited wording-review aid.

A valid declaration is not proof that prose honors it. No factual judgment,
classification of people, authorization, network call, or file mutation occurs.
"""
from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

MAX_BYTES = 4 * 1024 * 1024
EXPECTED = {
    'profile': 'RF-01',
    'task_frame': 'relational_description',
    'truth_access': 'open_to_contributions',
    'identity_policy': 'preserve_supplied',
    'source_policy': 'preserve_originals',
    'unknown_policy': 'keep_explicit',
    'evidence_policy': 'proposition_specific_symmetric',
    'motive_prerequisite': False,
    'operator_prerequisite': False,
    'label_prerequisite': False,
}
CODES = {
    'profile': 'STALE_OR_UNKNOWN_PROFILE',
    'task_frame': 'IMPOSED_TASK_FRAME',
    'truth_access': 'EXCLUSIVE_TRUTH',
    'identity_policy': 'IDENTITY_ERASURE',
    'source_policy': 'SOURCE_REWRITING',
    'unknown_policy': 'UNKNOWN_COLLAPSED',
    'evidence_policy': 'ASYMMETRIC_EVIDENCE',
    'motive_prerequisite': 'MOTIVE_GATE',
    'operator_prerequisite': 'OPERATOR_GATE',
    'label_prerequisite': 'LABEL_GATE',
}
ALLOWED_KINDS = {'author_report', 'witness_report', 'institutional_record',
                 'historical_hypothesis', 'proposed_analysis'}
STATES = {'documented', 'reported', 'modeled', 'unknown', 'contested'}
ID = re.compile(r'[A-Z][A-Z0-9_-]{0,63}\Z')
PATTERNS = (
    ('REVIEW_IMPOSED_RACISM_FRAME', re.compile(r'\b(?:your|my|the author[’\']s)\s+(?:claim|accusation|allegation)\s+of\s+racism\b', re.I)),
    ('REVIEW_MOTIVE_GATE', re.compile(r'\bmust\s+(?:first\s+)?prove\s+(?:a\s+|the\s+)?motive\s+before\b', re.I)),
    ('REVIEW_EXCLUSIVE_TRUTH', re.compile(r'\b(?:only the author|only the institution)\s+(?:can determine|owns|possesses)\s+(?:the\s+)?truth\b', re.I)),
)

class InvalidInput(ValueError):
    """Fixed-code exception: never echo an input payload or private file path."""

def _pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    out = {}
    for key, value in pairs:
        if key in out:
            raise InvalidInput('DUPLICATE_KEY')
        out[key] = value
    return out

def load(path: Path) -> Any:
    try:
        with path.open('rb') as stream:
            raw = stream.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise InvalidInput('INPUT_TOO_LARGE')
        return json.loads(raw.decode('utf-8'), object_pairs_hook=_pairs,
                          parse_constant=lambda _: (_ for _ in ()).throw(InvalidInput('NONFINITE_VALUE')))
    except InvalidInput:
        raise
    except (OSError, UnicodeError, ValueError, RecursionError):
        raise InvalidInput('UNREADABLE_OR_INVALID_JSON') from None

def violations(record: Any) -> list[str]:
    """Validate declarations, not the accuracy of the declared semantic review."""
    if not isinstance(record, dict):
        return ['INVALID_RECORD']
    allowed = set(EXPECTED) | {'sources', 'relations'}
    errors = []
    if set(record) != allowed:
        errors.append('UNKNOWN_OR_MISSING_FIELDS')
    for key, expected in EXPECTED.items():
        value = record.get(key)
        if type(value) is not type(expected) or value != expected:
            errors.append(CODES[key])
    sources, relations = record.get('sources'), record.get('relations')
    if not isinstance(sources, list) or not isinstance(relations, list):
        return sorted(set(errors + ['INVALID_RELATIONAL_RECORDS']))
    if len(sources) > 256 or len(relations) > 1024:
        return sorted(set(errors + ['TOO_MANY_RECORDS']))
    source_ids = set()
    for row in sources:
        if not isinstance(row, dict) or set(row) != {'id', 'kind'}:
            errors.append('INVALID_SOURCE'); continue
        sid, kind = row['id'], row['kind']
        if not isinstance(sid, str) or not ID.fullmatch(sid) or sid in source_ids:
            errors.append('INVALID_SOURCE_ID'); continue
        if not isinstance(kind, str) or kind not in ALLOWED_KINDS:
            errors.append('INVALID_SOURCE_KIND')
        source_ids.add(sid)
    relation_ids = set()
    for row in relations:
        if not isinstance(row, dict) or set(row) != {'id', 'status', 'source_refs', 'operator_status', 'classification_status'}:
            errors.append('INVALID_RELATION'); continue
        rid = row['id']
        if not isinstance(rid, str) or not ID.fullmatch(rid) or rid in relation_ids:
            errors.append('INVALID_RELATION_ID')
        else:
            relation_ids.add(rid)
        if not isinstance(row['status'], str) or row['status'] not in STATES:
            errors.append('INVALID_RELATION_STATUS')
        refs = row['source_refs']
        if (not isinstance(refs, list) or any(not isinstance(x, str) or x not in source_ids for x in refs)
                or len(refs) != len(set(x for x in refs if isinstance(x, str)))):
            errors.append('INVALID_SOURCE_REFERENCE')
        elif row['status'] != 'unknown' and not refs:
            errors.append('UNSOURCED_NONUNKNOWN_RELATION')
        for key in ('operator_status', 'classification_status'):
            if not isinstance(row[key], str) or row[key] not in {'known', 'unknown', 'contested', 'not_applicable'}:
                errors.append('INVALID_SCOPE_STATUS')
    return sorted(set(errors))

def scan(text: str) -> list[dict[str, Any]]:
    """Flag a few known constructions for review; never rewrite or classify prose.

Quoted historical text can legitimately match. Unmatched paraphrases can still
violate RF-01. Results contain locations and fixed codes, not submitted text.
"""
    if not isinstance(text, str):
        raise InvalidInput('INVALID_TEXT')
    findings = []
    for code, pattern in PATTERNS:
        for match in pattern.finditer(text):
            findings.append({'code': code, 'line': text.count('\n', 0, match.start()) + 1,
                             'start': match.start(), 'end': match.end()})
    return sorted(findings, key=lambda x: (x['start'], x['code']))

def check_cases(data: Any) -> list[str]:
    if not isinstance(data, dict) or set(data) != {'profile', 'base', 'cases'} or data['profile'] != 'RF-01' or not isinstance(data['cases'], list):
        return ['INVALID_CASE_FILE']
    if violations(data['base']):
        return ['INVALID_CASE_BASE']
    if not 1 <= len(data['cases']) <= 256:
        return ['INVALID_CASE_COUNT']
    errors = []; ids = set()
    for case in data['cases']:
        if not isinstance(case, dict) or set(case) != {'id', 'explanation', 'overrides', 'expected_codes'}:
            errors.append('INVALID_CASE'); continue
        if not isinstance(case['explanation'], str) or not case['explanation'].strip():
            errors.append('INVALID_CASE_EXPLANATION')
        cid = case['id']; expected = case['expected_codes']
        if not isinstance(cid, str) or not ID.fullmatch(cid) or cid in ids:
            errors.append('INVALID_CASE_ID'); continue
        ids.add(cid)
        if not isinstance(expected, list) or any(not isinstance(x, str) for x in expected):
            errors.append('INVALID_EXPECTED_CODES'); continue
        if not isinstance(case['overrides'], dict):
            errors.append('INVALID_CASE_OVERRIDE'); continue
        record = {**data['base'], **case['overrides']}
        if violations(record) != sorted(set(expected)):
            errors.append('CASE_EXPECTATION_MISMATCH')
    return sorted(set(errors))

def main(argv: list[str] | None = None) -> int:
    class QuietParser(argparse.ArgumentParser):
        def error(self, message: str) -> None:
            self.exit(2, 'INVALID_ARGUMENTS\n')
    parser = QuietParser(description=__doc__)
    parser.add_argument('mode', choices=('check', 'cases', 'scan'))
    parser.add_argument('path', type=Path)
    args = parser.parse_args(argv)
    try:
        if args.mode == 'scan':
            with args.path.open('rb') as stream:
                raw = stream.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES: raise InvalidInput('INPUT_TOO_LARGE')
            found = scan(raw.decode('utf-8'))
            print(json.dumps({'status': 'review_required' if found else 'no_known_pattern_found',
                              'semantic_review_required': True, 'findings': found}))
            return 3 if found else 0
        data = load(args.path)
        errors = check_cases(data) if args.mode == 'cases' else violations(data)
        print(json.dumps({'status': 'invalid' if errors else 'declarations_consistent',
                          'semantic_truth_verified': False, 'codes': errors}))
        return 2 if errors else 0
    except (InvalidInput, OSError, UnicodeError):
        print(json.dumps({'status': 'unavailable_or_invalid_input', 'codes': ['INPUT_ERROR']}))
        return 2

if __name__ == '__main__':
    sys.exit(main())
