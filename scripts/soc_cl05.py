#!/usr/bin/env python3
"""Read-only checks for the four pinned public CL05 apparatus files.

Only the two public TSVs are structurally inspected. The archived packet verifier is
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
_spec = importlib.util.spec_from_file_location('cl05_predecessor', Path(__file__).with_name('soc_cl04.py'))
predecessor = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(predecessor)
Invalid = predecessor.Invalid
require, read, blob, json_data, git = (predecessor.require, predecessor.read, predecessor.blob,
                                     predecessor.json_data, predecessor.git)
MANIFEST = 'planning/consolidation/soc-cl05.json'
CORE_MANIFEST = 'planning/consolidation/soc-core.json'
REVIEW = 'planning/standard-of-care/care-law/'
SOURCE_COMMIT = 'ff0499bd341de12a31b355b79867b547f19d9b16'
BASIS = '3e3e7a2a1cdb2c2ea82d37bd5c2c1d5abb178d50'
EXPECTED = {'planning/standard-of-care/care-law/integration-r05.md': 'cba8f9d53f586a1768b1f19fe8af69df10f35247',
 'planning/standard-of-care/care-law/integration-r05.tsv': '8ba0960fc144f37592e67d0423a46c52b3534918',
 'planning/standard-of-care/care-law/integration-r05-retained.tsv': 'e801bc17d7505440354cbda95076f7d2a17e23ba',
 'planning/standard-of-care/care-law/verify_integration_r05.py': 'f1ce756a5a37ed3f2f7870566d1dfbb76bc0a384'}
NAVIGATION = {
    'planning/standard-of-care/README.md': ('8b0980ce6e7b0835829ebbd8ab64d194d42b9380',
                                         '03cce13c7abc8454207337cf6881641826256b4c'),
    'sources/standard-of-care/README.md': ('ab5be50cb8658598ddec064424aaf38e554ea39a',
                                        'e7710421ba5edae9dd101e1f8ba6d753a6ded5f6'),
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
    for n in [125, 145, 176, 177, 186, 50, 178, 179, 180, 181, 182, 183, 184, 185, 187, 28, 433]]
NOTICE = ('This selection preserves the public CL05 receipt, changed/retained unit indexes and archived '
          'private-packet '
          'checker. Historical integration and test assertions remain dated records, not a current '
          'manuscript reconciliation, private-packet check, author acceptance or findings. Retained review '
          'labels are non-authoritative historical metadata; the four source-lineage-open rows remain '
          'unresolved. The archived '
          'checker is neither imported nor executed. Aliases and issue links are references, not '
          'evidence retrieval, authentication or grants. No new evidence, manuscript admission, '
          'complete corpus transfer or promotion is supplied.')
SHA = re.compile(r'[0-9a-f]{40}\Z')
HEADER = ['unit', 'passage', 'chapter', 'type', 'huey_issue', 'sources', 'carelaw_ids']
RETAINED_HEADER = HEADER[:-1] + ['review_state']
CHANGED_GROUP_COUNTS = {'CL05-E01': 5,
 'CL05-E02': 8,
 'CL05-E03': 5,
 'CL05-E04': 5,
 'CL05-E05': 8,
 'CL05-E06': 4,
 'CL05-E07': 11,
 'CL05-E08': 8,
 'CL05-E09': 9,
 'CL05-E10': 9,
 'CL05-E11': 6}
CHANGED_TYPE_COUNTS = {'argument': 29,
 'request': 15,
 'hypothesis': 3,
 'theology': 3,
 'interpretation': 5,
 'ethics': 5,
 'question': 5,
 'law': 2,
 'scope': 2,
 'literary-source': 1,
 'metaphor': 6,
 'source-description': 1,
 'editorial': 1}
CHANGED_OWNER_COUNTS = {'185': 51, '184': 16, '183': 11}
CHANGED_ALIAS_COUNTS = {'A': 65, 'M': 46, 'L17': 57, 'W02': 1, 'W01': 2, 'W04': 3, 'W05': 3, 'W06': 3, 'W07': 1, 'B': 1}
RETAINED_GROUP_COUNTS = {'CL05-P001': 4,
 'CL05-P002': 5,
 'CL05-P003': 6,
 'CL05-P004': 4,
 'CL05-P005': 5,
 'CL05-P006': 2,
 'CL05-P007': 4,
 'CL05-P008': 4,
 'CL05-P009': 4,
 'CL05-P010': 6,
 'CL05-P012': 4,
 'CL05-P013': 4,
 'CL05-P014': 5,
 'CL05-P015': 5,
 'CL05-P016': 4,
 'CL05-P017': 4,
 'CL05-P018': 2,
 'CL05-P019': 5,
 'CL05-P020': 4,
 'CL05-P021': 4,
 'CL05-P022': 3,
 'CL05-P023': 4,
 'CL05-P024': 5,
 'CL05-P025': 4,
 'CL05-P027': 6,
 'CL05-P028': 4,
 'CL05-P029': 4,
 'CL05-P030': 4,
 'CL05-P031': 5,
 'CL05-P032': 5,
 'CL05-P033': 4,
 'CL05-P034': 4,
 'CL05-P035': 6,
 'CL05-P036': 4,
 'CL05-P037': 4,
 'CL05-P040': 5,
 'CL05-P041': 5,
 'CL05-P042': 4,
 'CL05-P043': 5,
 'CL05-P044': 4,
 'CL05-P045': 5,
 'CL05-P046': 3,
 'CL05-P047': 4,
 'CL05-P048': 3}
RETAINED_TYPE_COUNTS = {'editorial': 24,
 'source-description': 10,
 'personal-theological-reading': 22,
 'attributed-experience': 9,
 'argument': 13,
 'request': 4,
 'personal-reflection': 17,
 'agency-argument': 8,
 'normative': 49,
 'personal-declaration-lineage-pending': 4,
 'personal-icon-reading': 7,
 'scripture-and-personal-reading': 5,
 'scriptural-interpretation': 4,
 'hypothesis': 4,
 'earlier-narrative-recap': 5,
 'metaphor': 4}
RETAINED_OWNER_COUNTS = {'185': 160, '50': 29}
RETAINED_ALIAS_COUNTS = {'B': 89, 'M': 163, 'L17': 35, 'W03': 13}
CARELAW_IDS = {'C012', 'C021', 'C022', 'C023', 'C029', 'C031', 'C040', 'C043', 'C047', 'C052', 'C055', 'C070',
    'C071', 'C072', 'C074', 'C077', 'C099', 'C100', 'C101', 'C103', 'C104', 'C105', 'C109',
    'C110', 'C111', 'C116', 'C118', 'C120', 'C121', 'C122', 'C127', 'C128', 'C129', 'C130',
    'C131', 'C132', 'C133', 'C134', 'C136', 'C138', 'C141', 'C142', 'C145', 'C146', 'C211',
    'C224', 'C250', 'C251', 'C252', 'C254', 'C256'}
LINEAGE_OPEN_IDS = {f'HUEY-CL05-R{i:03}' for i in range(89, 93)}
LIMITS = ('Pinned public copy bytes, TSV changed/retained unit/reference membership and navigation lineage only; '
          'no private-packet access or reconstruction, archived packet checker execution, historical '
          'mutation rerun, source/alias dereferencing, fresh research, source authentication, '
          'findings, disclosure authority, manuscript reconciliation, acceptance or complete corpus '
          'coverage. Retained review labels do not convey human clearance or resolve source lineage. '
          'Counts describe index registrations, not independent events or verified claims.')


def validate_manifest(value):
    fields = {'schema', 'basisRevision', 'sourceRepository', 'sourcePR', 'sourceCommit',
              'scopeRefs', 'notice', 'files', 'predecessorManifest', 'navigationChanges'} | set(FLAGS)
    require(type(value) is dict and set(value) == fields, 'manifest-fields')
    require(value['schema'] == 'huey.soc-cl05.v1', 'manifest-schema')
    require(value['basisRevision'] == BASIS, 'basis-pin')
    require(value['sourceRepository'] == 'grwtsk/huey' and
            type(value['sourcePR']) is int and value['sourcePR'] == 122 and
            value['sourceCommit'] == SOURCE_COMMIT, 'source-pin')
    require(value['scopeRefs'] == SCOPE_REFS and value['notice'] == NOTICE, 'scope-limits')
    require(all(value[key] is expected for key, expected in FLAGS.items()), 'completion-or-authority-claim')
    require(value['predecessorManifest'] == PREDECESSOR, 'predecessor-pin')
    rows = value['files']
    require(type(rows) is list and len(rows) == 4, 'file-count')
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


def parse_index(raw, retained=False):
    """Parse fixed public metadata; IDs and aliases are never filesystem paths."""
    try:
        lines = raw.decode('ascii').splitlines()
    except UnicodeError:
        raise Invalid('index-encoding') from None
    count, header = (189, RETAINED_HEADER) if retained else (78, HEADER)
    require(len(lines) == count + 1 and lines[0].split('\t') == header, 'index-shape')
    rows = [line.split('\t') for line in lines[1:]]
    require(all(len(row) == 7 and all(row) for row in rows), 'index-fields')
    prefix = 'R' if retained else 'U'
    require([row[0] for row in rows] == [f'HUEY-CL05-{prefix}{i:03}' for i in range(1, count + 1)],
            'index-unit-identities')
    groups = RETAINED_GROUP_COUNTS if retained else CHANGED_GROUP_COUNTS
    require([row[1] for row in rows] == [group for group, count in groups.items()
                                      for _ in range(count)], 'index-passage-membership')
    # A historical working chapter coordinate, never literary identity.
    require(all(row[2] == '14' for row in rows), 'index-chapter-membership')
    if retained:
        # Exact location and attribution of the known gap must not move or be masked.
        for row in rows:
            if row[0] in LINEAGE_OPEN_IDS:
                require(row[1:] == ['CL05-P023', '14', 'personal-declaration-lineage-pending',
                                   '50', 'B', 'retained-source-lineage-open'], 'retained-lineage-gap')
            else:
                require(row[3] != 'personal-declaration-lineage-pending' and
                        row[6] == 'retained-source-scoped-review', 'retained-review-state')
    require(Counter(row[3] for row in rows) == (RETAINED_TYPE_COUNTS if retained else CHANGED_TYPE_COUNTS),
            'index-type-membership')
    require(Counter(row[4] for row in rows) == (RETAINED_OWNER_COUNTS if retained else CHANGED_OWNER_COUNTS),
            'index-owner-membership')
    expected_aliases = RETAINED_ALIAS_COUNTS if retained else CHANGED_ALIAS_COUNTS
    aliases = Counter()
    for row in rows:
        sources = row[5].split(',')
        require(len(sources) == len(set(sources)) and set(sources) <= set(expected_aliases),
                'index-source-membership')
        aliases.update(sources)
    require(aliases == expected_aliases, 'index-source-coverage')
    if not retained:
        prior_ids, references = set(), 0
        for row in rows:
            if row[6] == '-':
                continue
            refs = row[6].split(',')
            require(len(refs) == len(set(refs)) and all(re.fullmatch(r'C\d{3}', ref) and
                    1 <= int(ref[1:]) <= 256 for ref in refs), 'index-carelaw-membership')
            prior_ids.update(refs)
            references += len(refs)
        require(prior_ids == CARELAW_IDS and references == 86 and
                sum(row[6] == '-' for row in rows) == 14, 'index-carelaw-coverage')
    return rows


def inspect_indexes(changed_raw, retained_raw):
    changed = parse_index(changed_raw)
    retained = parse_index(retained_raw, retained=True)
    require(not ({row[0] for row in changed} & {row[0] for row in retained}), 'index-overlapping-identities')


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
        inspect_indexes(raw[REVIEW + 'integration-r05.tsv'], raw[REVIEW + 'integration-r05-retained.tsv'])
        validate_navigation(root, value, source_objects)
    except Invalid:
        raise
    except (OSError, UnicodeError, ValueError, TypeError, KeyError, IndexError, RecursionError):
        raise Invalid('unreadable-or-malformed-input') from None
    return {'files': 4, 'exact_copies': 4, 'original_git_objects_checked': 4 if source_objects else 0,
            'prior_navigation_objects_checked': 2 if source_objects else 0,
            'predecessor_manifest_objects_checked': 1 if source_objects else 0,
            'namespace': 'HUEY-CL05', 'changed_units': 78, 'changed_passage_groups': 11,
            'retained_units': 189, 'retained_passage_groups': 44,
            'historical_chapter_coordinate': '14', 'retained_source_lineage_open_units': 4,
            'changed_source_aliases': 10, 'changed_source_alias_references': 182,
            'retained_source_aliases': 4, 'retained_source_alias_references': 300,
            'combined_source_aliases': 11, 'combined_source_alias_references': 482,
            'carelaw_references': 86, 'distinct_carelaw_references': 51,
            'changed_units_without_carelaw_reference': 14,
            'changed_type_counts': dict(CHANGED_TYPE_COUNTS), 'changed_owner_counts': dict(CHANGED_OWNER_COUNTS),
            'retained_type_counts': dict(RETAINED_TYPE_COUNTS), 'retained_owner_counts': dict(RETAINED_OWNER_COUNTS),
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
