"""Check claim routing and notices; never certify evidence or human permission."""
from __future__ import annotations
import argparse
import csv
import json
from pathlib import Path
from check_registry import validate as validate_registry

MARKER = 'Disclaimer: Working draft; claim verification incomplete; not medical/legal advice or adjudicated findings.'


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def validate(registry: dict, rows: list[dict], policy: dict, approval: dict) -> dict:
    validate_registry(registry)
    require(policy.get('schema_version') == 1, 'support schema')
    require(policy.get('automatic_verification') is False, 'automatic verification prohibited')
    require(policy.get('atomic_corpus_review_complete') is False, 'atomic review not complete')
    require(policy.get('disclaimer_marker') == MARKER, 'disclaimer changed')
    require(policy.get('substantial_support_issue') == 176, 'support issue')
    owners = {}
    for _, issue, _, first, last in registry['verifications']:
        for n in range(first, last + 1):
            owners[f'SOC-C{n:03d}'] = issue
    seen = set()
    for row in rows:
        cid = row.get('claim_id')
        require(cid in owners and cid not in seen, 'missing, duplicate or unknown claim')
        seen.add(cid)
        require(isinstance(row.get('target'), str) and bool(row['target'].strip()), 'empty target')
        require(int(row.get('verification_issue', 0)) == owners[cid], 'wrong verification issue')
        require(row.get('support_level') in policy['levels'], 'unknown support level')
        require(not any(k in row for k in ('verified', 'evidence_verified')), 'unreviewed status promotion')
    require(seen == set(owners), 'claim coverage gap')
    nsub = sum(r['support_level'] == 'substantial' for r in rows)
    require(len(rows) == policy.get('initial_claim_count'), 'claim count')
    require(nsub == policy.get('substantial_count'), 'substantial count')
    require(approval.get('id') == policy.get('approval') == 'SOC-PUBLIC-01', 'approval identity')
    require(approval.get('status') == 'granted', 'scoped grant not recorded')
    require(approval.get('destination_repository') == 'grwtsk/huey', 'destination')
    require(approval.get('destination_visibility') == 'public', 'visibility')
    require(approval.get('another_approval_required_for_this_scope') is False, 'do not reopen approval')
    require(approval.get('research_completion_required_for_draft_transfer') is False, 'research is not a copy gate')
    require(approval.get('approval_is_not_factual_verification') is True, 'approval is not verification')
    require('raw clinical PDFs and records' in approval.get('excluded', []), 'clinical-record exclusion')
    require('unrelated private material' in approval.get('excluded', []), 'unrelated-source exclusion')
    require(approval.get('authority_type') == 'explicit-user-message', 'authority type')
    require(bool(approval.get('exact_user_message')), 'missing source instruction')
    return {'initial_targets': len(rows), 'substantial_support_targets': nsub,
            'substantial_support_issue': 176, 'substantive_verification': 'not performed by this checker'}


def check_message(text: str) -> None:
    require(MARKER in text.splitlines(), 'missing exact disclaimer trailer')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=Path(__file__).parent)
    parser.add_argument('--message-file', type=Path)
    args = parser.parse_args()
    try:
        d = args.directory
        with (d / 'claims.tsv').open(encoding='utf-8', newline='') as f:
            rows = list(csv.DictReader(f, delimiter='\t'))
        load = lambda name: json.loads((d / name).read_text(encoding='utf-8'))
        result = validate(load('registry.json'), rows, load('support-policy.json'), load('approval.json'))
        if args.message_file is not None:
            check_message(args.message_file.read_text(encoding='utf-8'))
    except (OSError, ValueError, TypeError, KeyError) as error:
        parser.exit(1, f'FAIL: {error}\n')
    print(json.dumps({'result': 'PASS', **result}, indent=2))


if __name__ == '__main__':
    main()
