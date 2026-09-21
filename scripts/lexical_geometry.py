"""LG-01 read-only integrity checks. Consistency is not semantic or source certification."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import date
import ipaddress
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'research' / 'lexical-geometry'
MAX_BYTES = 1_000_000
ACCESS = {'text', 'abstract', 'indexed_excerpt', 'publisher_synopsis', 'metadata'}
TERMS = {'race', 'is', '-ism', '-ist', 'racism', 'racist'}
RELATION_KINDS = {'homograph_distinction', 'derivational_relation', 'semantic_comparison',
                  'grammatical_relation', 'etymology_nonidentity', 'grammatical_contrast',
                  'scope_relation', 'framework_contrast', 'legal_comparison',
                  'recognition_relation', 'epistemic_relation', 'historical_relation',
                  'scale_contrast', 'pragmatic_relation'}
TOP = {'profile', 'version', 'work_issue', 'expansion_issue', 'framing', 'retrieved_utc',
       'coverage', 'exhaustive_authorities', 'case_classification', 'private_sources_included',
       'sources', 'senses', 'relations', 'disagreements', 'context_fields', 'gaps', 'limits'}
SOURCE = {'id', 'authority', 'title', 'url', 'version', 'access', 'domain', 'scope', 'summary', 'limit'}
SENSE = {'id', 'term', 'kind', 'text', 'sources'}
RELATION = {'id', 'from_id', 'to_id', 'kind', 'status', 'statement', 'sources'}
COMPARISON = {'id', 'topic', 'kind', 'sources', 'account'}
GAP = {'id', 'status', 'topic', 'progress', 'remaining'}


class Invalid(ValueError):
    """Only fixed non-payload reason codes are emitted by the CLI."""


def require(condition: bool, code: str) -> None:
    if not condition:
        raise Invalid(code)


def unique_pairs(items: list[tuple[str, object]]) -> dict:
    value: dict = {}
    for key, item in items:
        require(key not in value, 'duplicate_json_key')
        value[key] = item
    return value


def nonfinite(_: str) -> None:
    raise Invalid('nonfinite_json')


def load(path: Path) -> dict:
    try:
        with path.open('rb') as stream:
            raw = stream.read(MAX_BYTES + 1)
        require(len(raw) <= MAX_BYTES, 'input_too_large')
        value = json.loads(raw.decode('utf-8'), object_pairs_hook=unique_pairs,
                           parse_constant=nonfinite)
    except (OSError, UnicodeError, json.JSONDecodeError, RecursionError, ValueError) as exc:
        if isinstance(exc, Invalid):
            raise
        raise Invalid('unreadable_json') from None
    require(type(value) is dict, 'object_required')
    return value


def fields(value: object, expected: set[str]) -> None:
    require(type(value) is dict and set(value) == expected, 'fields')


def text(value: object, *, empty: bool = False) -> None:
    require(type(value) is str, 'text')
    require(len(value) <= 12000 and (empty or bool(value.strip())), 'text')
    require(not any(ord(c) < 32 for c in value), 'text_control')


def choices(value: object, allowed: set[str], code: str) -> None:
    require(type(value) is str and value in allowed, code)


def real_date(value: object) -> None:
    text(value)
    try:
        require(date.fromisoformat(value).isoformat() == value, 'date')
    except ValueError as exc:
        if isinstance(exc, Invalid):
            raise
        raise Invalid('date') from None


def records(value: object, expected: set[str]) -> dict[str, dict]:
    require(type(value) is list and 0 < len(value) <= 256, 'records')
    result: dict[str, dict] = {}
    for item in value:
        fields(item, expected)
        text(item['id'])
        require(re.fullmatch(r'[A-Za-z][A-Za-z0-9_.-]*', item['id']) is not None, 'identifier')
        require(item['id'] not in result, 'duplicate_id')
        result[item['id']] = item
    return result


def strings(value: object, maximum: int = 64) -> list[str]:
    require(type(value) is list and 0 < len(value) <= maximum, 'list')
    for item in value:
        text(item)
    require(len(set(value)) == len(value), 'duplicate_value')
    return value


def references(value: object, sources: dict[str, dict]) -> None:
    identifiers = strings(value)
    require(set(identifiers) <= set(sources), 'references')
    require(all(sources[s]['access'] != 'metadata' for s in identifiers), 'metadata_is_not_argument')


def source_url(value: object) -> None:
    text(value)
    require(not any(c.isspace() for c in value), 'source_url')
    try:
        u = urlsplit(value)
        host = u.hostname or ''
        safe = (u.scheme == 'https' and '.' in host and u.username is None
                and u.password is None and u.port is None and not u.query
                and not u.fragment and not host.endswith('.local')
                and not host.endswith('.localhost') and host != 'localhost')
        try:
            ipaddress.ip_address(host)
            safe = False  # This research profile accepts named public sources only.
        except ValueError:
            pass
    except ValueError:
        safe = False
    require(safe, 'source_url')


def validate(atlas: dict, observations: dict) -> dict[str, int]:
    fields(atlas, TOP)
    require(atlas['profile'] == 'LG-01' and atlas['framing'] == 'RF-01', 'profile')
    require(atlas['coverage'] == 'expandable_first_edition'
            and atlas['exhaustive_authorities'] is False, 'coverage_overclaim')
    require(atlas['case_classification'] is None, 'imposed_classification')
    require(atlas['private_sources_included'] is False, 'private_scope')
    require(type(atlas['work_issue']) is int and atlas['work_issue'] == 102
            and type(atlas['expansion_issue']) is int and atlas['expansion_issue'] == 103,
            'owning_issues')
    text(atlas['version'])
    require(re.fullmatch(r'\d+\.\d+\.\d+', atlas['version']) is not None, 'version')
    real_date(atlas['retrieved_utc'])
    sources = records(atlas['sources'], SOURCE)
    fields(observations, {'profile', 'observed_utc', 'observations'})
    require(observations['profile'] == 'LG-01', 'observation_profile')
    real_date(observations['observed_utc'])
    require(observations['observed_utc'] == atlas['retrieved_utc'], 'observation_profile')
    require(type(observations['observations']) is dict
            and set(observations['observations']) == set(sources), 'observation_coverage')
    for sid, entry in sources.items():
        for field in SOURCE - {'summary'}:
            text(entry[field])
        text(entry['summary'], empty=True)
        choices(entry['access'], ACCESS, 'access')
        require(entry['access'] != 'metadata' or entry['summary'] == '', 'metadata_is_not_argument')
        require(entry['access'] == 'metadata' or bool(entry['summary'].strip()), 'missing_summary')
        source_url(entry['url'])
        observed = observations['observations'][sid]
        fields(observed, {'access', 'scope', 'url'})
        require(observed == {k: entry[k] for k in observed}, 'access_or_scope_drift')
    senses = records(atlas['senses'], SENSE)
    for entry in senses.values():
        choices(entry['term'], TERMS, 'term_coverage')
        text(entry['kind']); text(entry['text']); references(entry['sources'], sources)
    require({s['term'] for s in senses.values()} == TERMS, 'term_coverage')
    relations = records(atlas['relations'], RELATION)
    for entry in relations.values():
        text(entry['from_id']); text(entry['to_id'])
        require(entry['from_id'] in senses and entry['to_id'] in senses, 'relation_endpoint')
        choices(entry['kind'], RELATION_KINDS, 'relation_type')
        choices(entry['status'], {'source_statement', 'editorial_synthesis'}, 'relation_status')
        text(entry['statement']); references(entry['sources'], sources)
    for rid, target in [('R09', 'ism.state'), ('R10', 'ist.practitioner')]:
        entry = relations.get(rid, {})
        require(entry.get('from_id') == 'is.inflection' and entry.get('to_id') == target
                and entry.get('kind') == 'etymology_nonidentity', 'etymology_boundary')
    comparisons = records(atlas['disagreements'], COMPARISON)
    for entry in comparisons.values():
        text(entry['topic']); text(entry['kind']); text(entry['account'])
        references(entry['sources'], sources)
    gaps = records(atlas['gaps'], GAP)
    require(set(gaps) == {f'P{i:02}' for i in range(1, 14)}, 'gap_coverage')
    for entry in gaps.values():
        # Closure needs a future versioned evidence record, not a flipped flag.
        require(entry['status'] == 'open', 'gap_resolution_requires_evidence_schema')
        text(entry['topic']); text(entry['progress']); text(entry['remaining'])
    for field in ['context_fields', 'limits']:
        strings(atlas[field])
    require({'identities_supplied', 'evidence_status', 'unknown_relations',
             'revision_lineage', 'predicate_scope', 'classification_authority'}
            <= set(atlas['context_fields']), 'relational_scope')
    return dict(sources=len(sources), senses=len(senses), relations=len(relations),
                comparisons=len(comparisons), research_areas=len(gaps))


def render(atlas: dict) -> dict[str, str]:
    lines = ['# Source register', '',
             'LG-01. Attributed summaries and limitations are in `atlas.json`.', '',
             'Retrieval: ' + atlas['retrieved_utc'] + ' UTC. Text means the stated scope, not the whole work.', '']
    for entry in atlas['sources']:
        lines += [f"## {entry['id']}", '', f"**{entry['authority']} — {entry['title']}**", '',
                  f"Version: {entry['version']}. Access: **{entry['access']}**. Domain: {entry['domain']}.", '',
                  f"Scope: {entry['scope']}.", '', f"[Source]({entry['url']})", '']
    counts = Counter(s['access'] for s in atlas['sources'])
    lines += ['## Access totals', ''] + [f'- {kind}: {n}' for kind, n in sorted(counts.items())]
    coverage = ['# Coverage and continuing work', '',
                'LG-01 is an expandable first edition, not a census of all pertinent authorities.',
                'Continuing research is [issue #103](https://github.com/grwtsk/huey/issues/103).', '',
                'Inaccessible does not mean disproved. Metadata is not an inspected argument.', '']
    for entry in atlas['gaps']:
        coverage += [f"## {entry['id']} — {entry['topic']}", '', f"Status: **{entry['status']}**.", '',
                     'Completed scope: ' + entry['progress'], '', 'Remaining: ' + entry['remaining'], '']
    return {'sources.md': '\n'.join(lines).rstrip() + '\n',
            'coverage.md': '\n'.join(coverage).rstrip() + '\n'}


class Parser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        # Argument contents can themselves be private. Do not echo them.
        self.exit(2, 'LG-01: invalid_arguments\n')


def main(argv: list[str] | None = None) -> int:
    parser = Parser(description=__doc__)
    parser.add_argument('command', choices=['validate', 'check', 'render'])
    parser.add_argument('--data-dir', type=Path, default=DATA)
    args = parser.parse_args(argv)
    try:
        atlas = load(args.data_dir / 'atlas.json')
        observed = load(args.data_dir / 'retrieval-observations.json')
        counts = validate(atlas, observed)
        outputs = render(atlas)
        if args.command == 'check':
            for name, content in outputs.items():
                with (args.data_dir / name).open('rb') as stream:
                    raw = stream.read(MAX_BYTES + 1)
                require(len(raw) <= MAX_BYTES, 'input_too_large')
                require(raw.decode('utf-8') == content, 'generated_document_drift')
        if args.command == 'render':
            print(json.dumps(outputs, ensure_ascii=False, indent=2))
        else:
            print(json.dumps({'status': 'structurally_consistent', **counts,
                              'semantic_review_required': True}, sort_keys=True))
        return 0
    except (Invalid, OSError, TypeError, KeyError, RecursionError, UnicodeError):
        exc = sys.exception()
        code = str(exc) if isinstance(exc, Invalid) else 'invalid_input'
        print('LG-01: ' + code, file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
