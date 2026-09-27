"""Validate issue links, not clinical truth, disclosure permission or semantic coverage."""
import argparse
import json
import re
from pathlib import Path


def expand(ranges):
    result = set()
    for part in ranges.split(','):
        if not re.fullmatch(r'[1-9][0-9]*(?:-[1-9][0-9]*)?', part):
            raise ValueError('invalid claim range')
        ends = list(map(int, part.split('-')))
        if not 1 <= ends[0] <= ends[-1] <= 188:
            raise ValueError('claim range out of bounds')
        result.update(range(ends[0], ends[-1] + 1))
    return result


def validate(data):
    def require(condition, message):
        if not condition:
            raise ValueError(message)
    require(data.get('schema_version') == 1, 'schema version')
    require(data.get('repository') == 'grwtsk/huey', 'repository')
    require(data.get('source_permission_issue') == 2, 'source boundary')
    coverage = data.get('coverage', {})
    require(coverage.get('level') == 'initial-topic-decomposition', 'scope')
    for key in ('source_unit_audit_complete', 'verification_complete', 'full_text_transfer_complete'):
        require(coverage.get(key) is False, 'completion requires a reviewed schema transition')
    require(coverage.get('remaining_audit_issue') == 145, 'remaining audit')
    require(data.get('default_status') == 'open-unverified', 'default status')
    vs, args = data.get('verifications', []), data.get('arguments', [])
    require(len(vs) == 19 and len(args) == 30, 'initial inventory')
    owners = {}
    for i, row in enumerate(vs, 1):
        require(len(row) == 5, 'verification columns')
        vid, issue, title, first, last = row
        require(vid == f'SOC-V{i:02d}' and issue == 126 + i, 'verification identity')
        require(isinstance(title, str) and title.strip(), 'empty target group')
        require(isinstance(first, int) and isinstance(last, int) and 1 <= first <= last <= 188, 'claim bounds')
        for number in range(first, last + 1):
            require(number not in owners, 'duplicate claim')
            owners[number] = issue
    require(set(owners) == set(range(1, 189)), 'claim coverage gap')
    for i, row in enumerate(args, 1):
        require(len(row) == 5, 'argument columns')
        aid, issue, nid, links, ranges = row
        require(aid == f'SOC-A{i:02d}' and issue == 145 + i and nid == f'SOC-N{i:03d}', 'argument identity')
        require(links and len(set(links)) == len(links), 'verification links')
        require(all(isinstance(n, int) and 127 <= n <= 145 for n in links), 'unknown verifier')
        for number in expand(ranges):
            require(owners[number] in links, 'claim verifier not linked')
    # Tripwire only; actual source-aware privacy review remains necessary.
    for pattern in (r'/mnt/data/', r'\?token=', r'turn\d+file\d+', r'file_0000'):
        require(re.search(pattern, json.dumps(data)) is None, 'source-only locator')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('path', nargs='?', type=Path, default=Path(__file__).with_name('registry.json'))
    args = parser.parse_args()
    try:
        validate(json.loads(args.path.read_text(encoding='utf-8')))
    except (OSError, ValueError, TypeError, KeyError) as error:
        parser.exit(1, f'FAIL: {error}\n')
    print('PASS: 30 arguments, 19 verification issues, 188 initial targets; substantive review remains open.')


if __name__ == '__main__':
    main()
