#!/usr/bin/env python3
"""Read-only checks for nine pinned incident-register files and navigation lineage.

Source aliases are documentary references, never paths to open. This does not
collect evidence, inspect live issues, establish findings or grant authority.
The cumulative SOC checker separately requires every selected source/review slice.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location('incident_predecessor', Path(__file__).with_name('soc_authority.py'))
predecessor = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(predecessor)
Invalid = predecessor.Invalid
require, read, blob, json_data, git = (predecessor.require, predecessor.read, predecessor.blob,
                                     predecessor.json_data, predecessor.git)
MANIFEST = 'planning/consolidation/soc-incident.json'
CORE_MANIFEST = 'planning/consolidation/soc-core.json'
REVIEW = 'planning/standard-of-care/incident-register/'
SOURCE_COMMIT = 'ff0499bd341de12a31b355b79867b547f19d9b16'
BASIS = '4156b4fba4a57394b9aae54e5104694d622861b5'
EXPECTED = {'planning/standard-of-care/incident-register/README.md': 'da427355843b097398cac1ae54eeaa934008d87c',
 'planning/standard-of-care/incident-register/checks.json': '040e24fb5a629d9b22dfadc81adb94208ed1093f',
 'planning/standard-of-care/incident-register/coverage.md': '7692b71f0429224f1559f8d9538427f2cfce4ad3',
 'planning/standard-of-care/incident-register/evidence-intake.md': 'bf7bdd58ffe45cfaf62104d20db5b24eba1045bf',
 'planning/standard-of-care/incident-register/index.md': 'b527766413d0136af80c827216d3ed70c1009d5c',
 'planning/standard-of-care/incident-register/register.json': '923bd664d4415a270787f7345e08cfc36c9656ed',
 'planning/standard-of-care/incident-register/sources.json': '74b6c77a388117d7fb615460c042fa378857e342',
 'planning/standard-of-care/incident-register/test_verify.py': '27874b499647cfd118983f01b44c50d15fb752d2',
 'planning/standard-of-care/incident-register/verify.py': '1d87b082528e9541519660666a30092be5b16b01'}
NAVIGATION = {'planning/standard-of-care/README.md': ('8b0980ce6e7b0835829ebbd8ab64d194d42b9380',
                                         'a0cb5b02f4c23d282966ebc8e0fb2062193ca059'),
 'sources/standard-of-care/README.md': ('ab5be50cb8658598ddec064424aaf38e554ea39a',
                                        '89a114487af1cfb4da2826658092ec4d47a588fe')}
FLAGS = {'sourceCopyOnly': True,
 'manuscriptAdmission': False,
 'sourceMetadataActive': False,
 'newEvidenceReceived': False,
 'newExternalCollectionPerformed': False,
 'substantiveVerificationPerformed': False,
 'liveIssueBodiesVerified': False,
 'allIncidentsEnumerated': False,
 'fullCorpusTransferComplete': False,
 'authorityFromReferences': False}
SCOPE_REFS = ['https://github.com/grwtsk/huey/issues/2#issuecomment-5771600544',
 'https://github.com/grwtsk/huey/issues/125',
 'https://github.com/grwtsk/huey/issues/145',
 'https://github.com/grwtsk/huey/issues/176',
 'https://github.com/grwtsk/huey/issues/193',
 'https://github.com/grwtsk/huey/issues/306',
 'https://github.com/grwtsk/huey/issues/307',
 'https://github.com/grwtsk/huey/issues/425']
NOTICE = ('This selection preserves the public initial incident register and its historical preparation '
 'records. Entries, classes, source aliases and issue links are documentary registration, not '
 'findings, independently established events or current live-issue certification. Source locations '
 'are not opened; reference URLs and approval labels do not authenticate or grant authority. No '
 'evidence collection, source verification, manuscript admission, exhaustive coverage or promotion '
 'is supplied.')
PREDECESSOR = {'path': 'planning/consolidation/soc-authority.json',
 'blob': '135e3cea37bd629e46e21e5c49b635aa0e1f86ad'}
SHA = re.compile(r'[0-9a-f]{40}\Z')
DOCUMENTARY_ALIASES = {'JUL26', 'AUG04', 'SOURCE-NOTICE', 'SEP10', 'SEP17', 'OVERVIEW'}
STAGED_ALIASES = {'CHAT', 'STANDARD', 'TRUST', 'PROLOGUE-BEFORE', 'PROLOGUE-ORIGIN',
                  'PROLOGUE-TRANSFER', 'PROLOGUE-EVIDENCE', 'PROSE-WRITING', 'PROSE-THREAT',
                  'PROSE-GOODNESS', 'PROSE-PERSISTENCE', 'PROSE-AWARENESS', 'PROSE-COMMUNICATION',
                  'PROSE-COMPARISON', 'PROSE-LAURELS'}
USED_ALIASES = {'AUG04', 'CHAT', 'JUL26', 'OVERVIEW', 'PROLOGUE-EVIDENCE', 'PROLOGUE-TRANSFER',
                'PROSE-AWARENESS', 'PROSE-COMMUNICATION', 'SEP10', 'SEP17', 'SOURCE-NOTICE'}
SUMMARY = {'entries': 112, 'classes': {'R': 43, 'S': 40, 'Q': 14, 'C': 10, 'X': 5},
           'finding_status': 'not-determined', 'new_collection_status': 'planned-not-started',
           'limits': 'Index consistency only; no substantive or live-issue-body certification.'}
LIMITS = ('Pinned initial register bytes, documentary alias membership, historical incomplete states '
          'and navigation lineage only; no source-location access, live-issue-body verification, '
          'external collection, source authentication, clinical/legal findings, disclosure authority, '
          'exhaustive incident coverage or manuscript admission. Counts are registration classes, '
          'not proven violations or independently established events.')


def validate_manifest(value):
    fields = {'schema', 'basisRevision', 'sourceRepository', 'sourcePR', 'sourceCommit',
              'scopeRefs', 'notice', 'files', 'predecessorManifest', 'navigationChanges'} | set(FLAGS)
    require(type(value) is dict and set(value) == fields, 'manifest-fields')
    require(value['schema'] == 'huey.soc-incident.v1', 'manifest-schema')
    require(value['basisRevision'] == BASIS, 'basis-pin')
    require(value['sourceRepository'] == 'grwtsk/huey' and
            type(value['sourcePR']) is int and value['sourcePR'] == 122 and
            value['sourceCommit'] == SOURCE_COMMIT, 'source-pin')
    require(value['scopeRefs'] == SCOPE_REFS and value['notice'] == NOTICE, 'scope-limits')
    require(all(value[key] is expected for key, expected in FLAGS.items()), 'completion-or-authority-claim')
    require(value['predecessorManifest'] == PREDECESSOR, 'predecessor-pin')
    rows = value['files']
    require(type(rows) is list and len(rows) == 9, 'file-count')
    seen = set()
    for row in rows:
        require(type(row) is dict and set(row) == {'path', 'sourceBlob', 'stagedBlob', 'representation'},
                'file-fields')
        path = row['path']
        require(type(path) is str and path in EXPECTED and path not in seen, 'file-selection')
        seen.add(path)
        require(row['sourceBlob'] == row['stagedBlob'] == EXPECTED[path] and
                row['representation'] == 'exact', 'exact-copy-pin')
    require(seen == set(EXPECTED), 'file-selection')
    rows = value['navigationChanges']
    require(type(rows) is list and len(rows) == 2, 'navigation-count')
    seen = set()
    for row in rows:
        require(type(row) is dict and set(row) == {'path', 'sourceBlob', 'priorStagedBlob', 'stagedBlob'},
                'navigation-fields')
        path = row['path']
        require(type(path) is str and path in NAVIGATION and path not in seen, 'navigation-selection')
        seen.add(path)
        require((row['sourceBlob'], row['priorStagedBlob']) == NAVIGATION[path], 'navigation-prior-pin')
        require(type(row['stagedBlob']) is str and SHA.fullmatch(row['stagedBlob']), 'navigation-staged-shape')


def validate_metadata(data):
    """Keep registration and source references distinct from findings and intake."""
    register = data[REVIEW + 'register.json']
    require(register['schema_version'] == 1 and register['repository'] == 'grwtsk/huey' and
            register['date'] == '2026-09-22' and register['register_issue'] == 193 and
            register['coverage_issue'] == 306 and register['evidence_intake_issue'] == 307,
            'register-identity')
    require(register['all_incidents_enumerated'] is False and
            register['finding_status'] == 'not-determined' and
            register['new_collection_status'] == 'planned-not-started', 'register-completion-claim')
    sources = data[REVIEW + 'sources.json']
    require(sources['schema_version'] == 1 and
            set(sources['sources']) == DOCUMENTARY_ALIASES | STAGED_ALIASES,
            'source-alias-membership')
    require({row[3] for row in register['entries']} == USED_ALIASES, 'used-source-alias-membership')
    require(sources['publication_scope'] ==
            'Approved SOC discussion/essay-derived index only; raw PDFs not included. '
            'New evidence is not automatically approved for public disclosure.', 'source-publication-boundary')
    # Location/review/disposition strings are bound by exact byte pins. Never open them.
    receipt = data[REVIEW + 'checks.json']
    require(receipt['pass'] == 'SOC-I01' and receipt['repository'] == 'grwtsk/huey' and
            receipt['date'] == '2026-09-22' and receipt['register_issue'] == 193 and
            receipt['individual_issues'] == {'first': 194, 'last': 305, 'count': 112},
            'historical-register-identity')
    require(receipt['classes'] == {'reported_departure': 43, 'unresolved_safeguard': 40,
                                  'investigative_question': 14, 'clinical_review_question': 10,
                                  'context_consequence': 5}, 'historical-classes')
    require(receipt['unit_tests_passed'] == 16 and
            receipt['full_repository_suite'] == 'not-run; partial checkout only' and
            receipt['new_external_evidence_collection'] == 'not-started' and
            receipt['all_incidents_enumerated'] is False and
            receipt['remaining_owners'] == [306, 307, 145, 126, 127, 144, 192, 176],
            'historical-completion-claim')


def validate_navigation(root, value, source_objects):
    previous_bytes = read(root, PREDECESSOR['path'])
    require(blob(previous_bytes) == PREDECESSOR['blob'], 'predecessor-byte-drift')
    previous = json_data(previous_bytes)
    predecessor.validate_manifest(previous)
    core = json_data(read(root, CORE_MANIFEST))
    for row in value['navigationChanges']:
        parents = [item for item in previous['navigationChanges'] if item['path'] == row['path']]
        require(len(parents) == 1 and parents[0]['sourceBlob'] == row['sourceBlob'] and
                parents[0]['stagedBlob'] == row['priorStagedBlob'], 'navigation-chain')
        current = [item for item in core['files'] if item['path'] == row['path']]
        require(len(current) == 1 and current[0]['sourceBlob'] == row['sourceBlob'] and
                current[0]['stagedBlob'] == row['stagedBlob'] and
                current[0]['representation'] == 'adapted-navigation', 'navigation-core-pin')
        require(blob(read(root, row['path'])) == row['stagedBlob'], 'navigation-byte-drift')
        if source_objects:
            require(blob(git(root, 'show', BASIS + ':' + row['path'])) == row['priorStagedBlob'],
                    'navigation-prior-byte-drift')
    if source_objects:
        require(blob(git(root, 'show', BASIS + ':' + PREDECESSOR['path'])) == PREDECESSOR['blob'],
                'predecessor-original-byte-drift')


def verify(root=ROOT, source_objects=False):
    root = Path(root).resolve()
    try:
        value = json_data(read(root, MANIFEST))
        validate_manifest(value)
        data = {}
        for row in value['files']:
            raw = read(root, row['path'])
            require(blob(raw) == row['stagedBlob'], 'staged-byte-drift')
            if row['path'].endswith('.json'):
                data[row['path']] = json_data(raw)
            if source_objects:
                original = git(root, 'show', SOURCE_COMMIT + ':' + row['path'])
                require(blob(original) == row['sourceBlob'] and original == raw, 'original-byte-drift')
        validate_metadata(data)
        validate_navigation(root, value, source_objects)
        # Only fixed, byte-checked local code; no location lookup or user arguments.
        environment = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
        result = subprocess.run([sys.executable, str(root / (REVIEW + 'verify.py'))], cwd=root,
                                env=environment, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False)
        require(result.returncode == 0, 'inherited-register-check')
        require(json_data(result.stdout) == SUMMARY, 'inherited-register-summary')
    except Invalid:
        raise
    except (OSError, UnicodeError, ValueError, TypeError, KeyError, IndexError, RecursionError):
        raise Invalid('unreadable-or-malformed-input') from None
    return {'files': 9, 'exact_copies': 9, 'original_git_objects_checked': 9 if source_objects else 0,
            'prior_navigation_objects_checked': 2 if source_objects else 0,
            'predecessor_manifest_objects_checked': 1 if source_objects else 0,
            'registered_entries': 112, 'registration_classes': dict(SUMMARY['classes']),
            'declared_source_aliases': 21, 'used_source_aliases': 11,
            'already_staged_source_references': 15, 'descriptive_source_references': 6,
            'finding_status': 'not-determined', 'new_collection_status': 'planned-not-started',
            'limits': LIMITS}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-objects', action='store_true',
                        help='compare available public Git objects and prior navigation; never fetch')
    args = parser.parse_args()
    try:
        print(json.dumps(verify(source_objects=args.source_objects), indent=2))
    except Invalid as error:
        parser.exit(1, 'FAIL: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
