#!/usr/bin/env python3
"""Read-only checks for the three pinned public CL03 apparatus files.

Only the public TSV is structurally inspected. The archived packet verifier is
preserved as bytes, never imported or executed; its private inputs are not read.
References do not authenticate permission, evidence, acceptance or integration.
"""
from collections import Counter
import argparse
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location('cl03_predecessor', Path(__file__).with_name('soc_care_law.py'))
predecessor = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(predecessor)
Invalid = predecessor.Invalid
require, read, blob, json_data, git = (predecessor.require, predecessor.read, predecessor.blob,
                                     predecessor.json_data, predecessor.git)
MANIFEST = 'planning/consolidation/soc-cl03.json'
CORE_MANIFEST = 'planning/consolidation/soc-core.json'
REVIEW = 'planning/standard-of-care/care-law/'
SOURCE_COMMIT = 'ff0499bd341de12a31b355b79867b547f19d9b16'
BASIS = '94893a187cf83f44868563da3b9d0b98d7f30d5f'
EXPECTED = {
    REVIEW + 'integration-r03.md': '84c310e405d5bc68a46c73caefcf4ce2d4499536',
    REVIEW + 'integration-r03.tsv': '0b8463675bec3854fe4476855ca8750983010d14',
    REVIEW + 'verify_integration_r03.py': '12c24e1d5ca68c094a0e7dd68c9c7ad325ac1792',
}
NAVIGATION = {
    'planning/standard-of-care/README.md': ('8b0980ce6e7b0835829ebbd8ab64d194d42b9380',
                                         '0e9e3c45d8c5bd7a5a4c1a2f76088cdadc80370e'),
    'sources/standard-of-care/README.md': ('ab5be50cb8658598ddec064424aaf38e554ea39a',
                                        '051dc6595f7322e4f9002523f8f71402eb053f25'),
}
PREDECESSOR = {'path': predecessor.MANIFEST, 'blob': predecessor.HISTORICAL_MANIFEST_BLOB}
FLAGS = {'sourceCopyOnly': True, 'manuscriptAdmission': False, 'sourceMetadataActive': False,
         'newEvidenceReceived': False, 'newExternalCollectionPerformed': False,
         'substantiveVerificationPerformed': False, 'liveIssueBodiesVerified': False,
         'privatePacketChecked': False, 'inheritedPacketVerifierExecuted': False,
         'manuscriptReconciliationPerformed': False, 'fullCorpusTransferComplete': False,
         'authorityFromReferences': False}
SCOPE_REFS = ['https://github.com/grwtsk/huey/issues/2#issuecomment-5771600544'] + [
    'https://github.com/grwtsk/huey/issues/' + str(n)
    for n in [125, 145, 176, 177, 186, 46, 47, *range(178, 186), 429]]
NOTICE = ('This selection preserves the public CL03 receipt, unit index and archived private-packet '
          'checker. Historical integration and test assertions remain dated records, not a current '
          'manuscript reconciliation, private-packet check, author acceptance or findings. The archived '
          'checker is neither imported nor executed. Aliases and issue links are references, not '
          'evidence retrieval, authentication or grants. No new evidence, manuscript admission, '
          'complete corpus transfer or promotion is supplied.')
SHA = re.compile(r'[0-9a-f]{40}\Z')
HEADER = ['unit', 'edit', 'type', 'huey_issue', 'sources', 'carelaw_ids']
GROUP_COUNTS = dict(zip((f'CL03-E{i:02}' for i in range(1, 12)), [7, 9, 24, 9, 12, 5, 4, 10, 8, 13, 8]))
TYPE_COUNTS = {'argument': 44, 'testimony': 1, 'editorial': 1, 'source-description': 6,
               'request': 15, 'ethics': 3, 'interpretation': 8, 'policy': 3, 'scope': 5,
               'question': 9, 'law': 12, 'hypothesis': 2}
OWNER_COUNTS = {'186': 7, '179': 7, '180': 15, '183': 34, '184': 9, '185': 10,
                '178': 8, '181': 16, '182': 3}
ALIASES = {'A', 'B', 'L10', 'L17', 'N09', *(f'W{i:02}' for i in range(1, 9))}
CARELAW_IDS = {f'C{i:03}' for i in [12, 14, 16, 17, 21, 22, 23, 26, 27, 28, 29, 30, 31,
    35, 37, 38, 40, 42, 43, 56, 57, 59, 61, 63, 70, 71, 72, 74, 79, 80, 81, 94, 99, 104,
    105, 107, 108, 109, 111, 142, 143, 183, 184, 185, 186, 207, 208, 209, 210, 221, 222,
    223, 225, 226, 227, 228, 243, 244, 245, 246, 247, 248, 250, 253, 254]}
LIMITS = ('Pinned public copy bytes, TSV unit/reference membership and navigation lineage only; '
          'no private-packet access or reconstruction, archived packet checker execution, historical '
          'mutation rerun, source/alias dereferencing, fresh research, source authentication, '
          'findings, disclosure authority, manuscript reconciliation, acceptance or complete corpus '
          'coverage. Counts describe index registrations, not independent events or verified claims.')


def validate_manifest(value):
    fields = {'schema', 'basisRevision', 'sourceRepository', 'sourcePR', 'sourceCommit',
              'scopeRefs', 'notice', 'files', 'predecessorManifest', 'navigationChanges'} | set(FLAGS)
    require(type(value) is dict and set(value) == fields, 'manifest-fields')
    require(value['schema'] == 'huey.soc-cl03.v1', 'manifest-schema')
    require(value['basisRevision'] == BASIS, 'basis-pin')
    require(value['sourceRepository'] == 'grwtsk/huey' and
            type(value['sourcePR']) is int and value['sourcePR'] == 122 and
            value['sourceCommit'] == SOURCE_COMMIT, 'source-pin')
    require(value['scopeRefs'] == SCOPE_REFS and value['notice'] == NOTICE, 'scope-limits')
    require(all(value[key] is expected for key, expected in FLAGS.items()), 'completion-or-authority-claim')
    require(value['predecessorManifest'] == PREDECESSOR, 'predecessor-pin')
    rows = value['files']
    require(type(rows) is list and len(rows) == 3, 'file-count')
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


def inspect_index(raw):
    """Inspect public metadata only; identifiers never become filesystem paths."""
    try:
        lines = raw.decode('ascii').splitlines()
    except UnicodeError:
        raise Invalid('index-encoding') from None
    require(len(lines) == 110 and lines[0].split('\t') == HEADER, 'index-shape')
    rows = [line.split('\t') for line in lines[1:]]
    require(all(len(row) == 6 and all(row) for row in rows), 'index-fields')
    require([row[0] for row in rows] == [f'HUEY-CL03-U{i:03}' for i in range(1, 110)],
            'index-unit-identities')
    require([row[1] for row in rows] == [group for group, count in GROUP_COUNTS.items()
                                      for _ in range(count)], 'index-edit-membership')
    require(Counter(row[2] for row in rows) == TYPE_COUNTS, 'index-type-membership')
    require(Counter(row[3] for row in rows) == OWNER_COUNTS, 'index-owner-membership')
    aliases, prior_ids = set(), set()
    alias_references = carelaw_references = 0
    for row in rows:
        sources = row[4].split(',')
        require(len(sources) == len(set(sources)) and set(sources) <= ALIASES, 'index-source-membership')
        aliases.update(sources)
        alias_references += len(sources)
        if row[5] == '-':
            continue
        refs = row[5].split(',')
        require(len(refs) == len(set(refs)) and all(re.fullmatch(r'C\d{3}', ref) and
                1 <= int(ref[1:]) <= 256 for ref in refs), 'index-carelaw-membership')
        prior_ids.update(refs)
        carelaw_references += len(refs)
    require(aliases == ALIASES and alias_references == 164, 'index-source-coverage')
    require(prior_ids == CARELAW_IDS and carelaw_references == 78 and
            sum(row[5] == '-' for row in rows) == 56,
            'index-carelaw-coverage')


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
        raw = {}
        for row in value['files']:
            content = read(root, row['path'])
            require(blob(content) == row['stagedBlob'], 'staged-byte-drift')
            raw[row['path']] = content
            if source_objects:
                original = git(root, 'show', SOURCE_COMMIT + ':' + row['path'])
                require(blob(original) == row['sourceBlob'] and original == content, 'original-byte-drift')
        inspect_index(raw[REVIEW + 'integration-r03.tsv'])
        validate_navigation(root, value, source_objects)
    except Invalid:
        raise
    except (OSError, UnicodeError, ValueError, TypeError, KeyError, IndexError, RecursionError):
        raise Invalid('unreadable-or-malformed-input') from None
    return {'files': 3, 'exact_copies': 3, 'original_git_objects_checked': 3 if source_objects else 0,
            'prior_navigation_objects_checked': 2 if source_objects else 0,
            'predecessor_manifest_objects_checked': 1 if source_objects else 0,
            'namespace': 'HUEY-CL03', 'indexed_units': 109, 'indexed_edit_groups': 11,
            'source_aliases': 13, 'source_alias_references': 164, 'carelaw_references': 78,
            'distinct_carelaw_references': 65, 'units_without_carelaw_reference': 56,
            'type_counts': dict(TYPE_COUNTS), 'owner_counts': dict(OWNER_COUNTS),
            'private_packet_checked': False, 'inherited_packet_verifier_executed': False,
            'historical_negative_cases_rerun': 0, 'exports_written': 0, 'limits': LIMITS}


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
