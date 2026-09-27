#!/usr/bin/env python3
"""Read-only copy, recovery and historical navigation checks for eight care-law files.

Pinned local verifier functions inspect checked in-memory bytes. Their export CLI
is never invoked. Source locators are references, not inputs to open; this performs
no fresh research, institutional action, factual clearance or manuscript adoption.
"""
from collections import Counter
import argparse
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location('care_law_predecessor', Path(__file__).with_name('soc_incident.py'))
predecessor = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(predecessor)
Invalid = predecessor.Invalid
require, read, blob, json_data, git = (predecessor.require, predecessor.read, predecessor.blob,
                                     predecessor.json_data, predecessor.git)
MANIFEST = 'planning/consolidation/soc-care-law.json'
CORE_MANIFEST = 'planning/consolidation/soc-core.json'
HISTORICAL_MANIFEST_BLOB = '6916238cc748dc86a34f5d5523117fe43635074a'
REVIEW = 'planning/standard-of-care/care-law/'
SOURCE_COMMIT = 'ff0499bd341de12a31b355b79867b547f19d9b16'
BASIS = 'b71676df74adefd5b0811ae9671b9382075a022f'
EXPECTED = {'planning/standard-of-care/care-law/AGENTS.md': 'e88ad0c81532f4d40a3fa3f86e3bd41cf8597be0',
 'planning/standard-of-care/care-law/README.md': '2b91525c6ccbe2721e9e256ac11a5e697961c990',
 'planning/standard-of-care/care-law/revision.md': '64f4d21a930f2710cbef844e2d8becc87ecc27a2',
 'planning/standard-of-care/care-law/sources.json': '85b776078e7cccd4bee5742a3c6ea6a5ef3eed30',
 'planning/standard-of-care/care-law/review.json': '37afba552dbc405090764616ddcd6a52f5872e54',
 'planning/standard-of-care/care-law/lineage.json': '3386ffe463e9bb3417b656f4b678ecfa2a3d4bf5',
 'planning/standard-of-care/care-law/book-integration.json': '51d97df010caf666c2ed64fb4bf311784f46648d',
 'planning/standard-of-care/care-law/verify.py': '567608306fedf8aa6c3c8b2a995a8c85634575ef'}
NAVIGATION = {'planning/standard-of-care/README.md': ('8b0980ce6e7b0835829ebbd8ab64d194d42b9380',
                                         '62245d9acbbf34314f107e41883dff5fce5a6102'),
 'sources/standard-of-care/README.md': ('ab5be50cb8658598ddec064424aaf38e554ea39a',
                                        'e849ce858c20672b83fcf417aabf530bc34e5726')}
FLAGS = {'sourceCopyOnly': True,
 'manuscriptAdmission': False,
 'sourceMetadataActive': False,
 'newEvidenceReceived': False,
 'newExternalCollectionPerformed': False,
 'substantiveVerificationPerformed': False,
 'liveIssueBodiesVerified': False,
 'manuscriptReconciliationPerformed': False,
 'fullCorpusTransferComplete': False,
 'authorityFromReferences': False}
SCOPE_REFS = ['https://github.com/grwtsk/huey/issues/2#issuecomment-5771600544'] + [
    'https://github.com/grwtsk/huey/issues/' + str(n)
    for n in [125, 145, 176, 177, *range(178, 188), 427]]
NOTICE = ('This selection preserves the public recovered care-law source/review packet. '
 'Prior source inspections, review assertions and candidate chapter joins remain historical '
 'records, not fresh research, findings, an applied manuscript revision or current chapter '
 'instructions. Source locations are not opened; reference URLs and approval labels do not '
 'authenticate or grant authority. No new evidence, substantive verification, manuscript '
 'admission, complete corpus transfer or promotion is supplied.')
PREDECESSOR = {'path': 'planning/consolidation/soc-incident.json',
 'blob': '0e0618cad3e16dd918be64f0fa0859a11ec6b36c'}
SHA = re.compile(r'[0-9a-f]{40}\Z')
INSPECTIONS = {'read-this-pass': 37, 'source-text-retrieved-this-pass': 1,
               'carried-forward-from-pass-1': 1, 'recheck-failed': 1, 'access-result-only': 1}
NEGATIVE_CASES = ['duplicate-id', 'unknown-source', 'unknown-owner', 'untracked-prose',
 'missing-visible-authority', 'signature-alternative-lost', 'wrong-notice-clock',
 'offer-erased', 'fabricated-recheck', 'unseen-policy-read', 'unmapped-added-unit',
 'unknown-review-source', 'invented-investigation', 'missing-alternative', 'wrong-repository',
 'old-repository-owner', 'missing-book-disposition', 'invented-manuscript-integration',
 'protected-close-targeted', 'incorrect-issue-map', 'lost-edit-lineage']
LIMITS = ('Pinned copy bytes, historical source states, candidate joins, recovery checks and '
          'navigation lineage only; no source-location access, fresh legal/medical research, '
          'source authentication, institutional investigation, case adjudication, disclosure '
          'authority, manuscript adoption or complete clause/corpus audit. Historical joins '
          'do not describe later integration work; counts are prose/review registration units, '
          'not independent events or verified findings. Navigation is the fixed historical receipt; '
          'run soc_consolidation.py for current navigation and combined SOC file coverage.')


def validate_manifest(value):
    fields = {'schema', 'basisRevision', 'sourceRepository', 'sourcePR', 'sourceCommit',
              'scopeRefs', 'notice', 'files', 'predecessorManifest', 'navigationChanges'} | set(FLAGS)
    require(type(value) is dict and set(value) == fields, 'manifest-fields')
    require(value['schema'] == 'huey.soc-care-law.v1', 'manifest-schema')
    require(value['basisRevision'] == BASIS, 'basis-pin')
    require(value['sourceRepository'] == 'grwtsk/huey' and
            type(value['sourcePR']) is int and value['sourcePR'] == 122 and
            value['sourceCommit'] == SOURCE_COMMIT, 'source-pin')
    require(value['scopeRefs'] == SCOPE_REFS and value['notice'] == NOTICE, 'scope-limits')
    require(all(value[key] is expected for key, expected in FLAGS.items()), 'completion-or-authority-claim')
    require(value['predecessorManifest'] == PREDECESSOR, 'predecessor-pin')
    rows = value['files']
    require(type(rows) is list and len(rows) == 8, 'file-count')
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
    """Preserve earlier inspection and adoption limits without certifying those assertions."""
    sources = data[REVIEW + 'sources.json']
    require(sources['schema_version'] == 2 and sources['repository'] == 'grwtsk/huey' and
            sources['namespace'] == 'HUEY-CARELAW-01' and sources['review_date'] == '2026-09-21',
            'historical-source-identity')
    require(Counter(row['inspection'] for row in sources['sources']) == INSPECTIONS and
            all(row['case_application'] == 'not-adjudicated' for row in sources['sources']),
            'historical-source-status')
    review = data[REVIEW + 'review.json']
    require(review['schema_version'] == 2 and review['pass'] == 2 and
            review['parent_issue'] == 125 and review['correction_issue'] == 177 and
            review['integration_issue'] == 186 and review['date_identity_issue'] == 187 and
            review['development_pr'] == 122, 'historical-review-identity')
    require(review['raw_sources_included'] is False and review['external_contact_performed'] is False and
            all(row['institutional_status'] == 'not-initiated-by-this-packet'
                for row in review['review_rows']), 'historical-review-completion-claim')
    integration = data[REVIEW + 'book-integration.json']
    require(integration['status'] == 'candidate-joins-not-applied' and
            integration['integration_issue'] == 186, 'historical-integration-claim')
    lineage = data[REVIEW + 'lineage.json']
    require(lineage['checks'] == {'first_pass_ids_retained': 151, 'cumulative_ids_retained': 256,
                                 'prose_text_changes_on_repository_correction': 0},
            'historical-recovery-claim')


def inspect_packet(raw, data):
    # Execute only the fixed, checked source bytes with a non-main module name.
    # This calls pure inspection functions, not main(), filesystem reads or exports.
    require(blob(raw[REVIEW + 'verify.py']) == EXPECTED[REVIEW + 'verify.py'], 'verifier-byte-drift')
    namespace = {'__name__': 'huey_pinned_care_law'}
    exec(compile(raw[REVIEW + 'verify.py'], '<pinned-care-law-verifier>', 'exec'), namespace)
    args = [raw[REVIEW + 'revision.md'].decode('utf-8')] + [data[REVIEW + name] for name in
        ['sources.json', 'review.json', 'book-integration.json', 'lineage.json']]
    try:
        records = namespace['inspect'](*args)
        negative_cases = namespace['negative_tests'](*args)
    except (ValueError, KeyError, TypeError, IndexError):
        raise Invalid('inherited-recovery-check') from None
    require(negative_cases == NEGATIVE_CASES, 'inherited-negative-summary')
    require(len(records) == 256 and len(data[REVIEW + 'review.json']['review_rows']) == 34 and
            len(data[REVIEW + 'book-integration.json']['sections']) == 17, 'inherited-recovery-summary')
    require({sid for row in records for sid in row['source_ids']} ==
            {f'S{i:02}' for i in range(41)} - {'S38', 'S40'}, 'prose-source-membership')
    review_rows = data[REVIEW + 'review.json']['review_rows']
    require([row['id'] for row in review_rows if 'S40' in row['source_ids']] == ['R30'] and
            not any('S38' in row['source_ids'] for row in review_rows), 'review-source-membership')
    detailed = sum(bool(row['review_ids']) for row in records)
    require(detailed == 115, 'historical-review-coverage')


def validate_navigation(root, value, source_objects):
    previous_bytes = read(root, PREDECESSOR['path'])
    require(blob(previous_bytes) == PREDECESSOR['blob'], 'predecessor-byte-drift')
    previous = json_data(previous_bytes)
    predecessor.validate_manifest(previous)
    for row in value['navigationChanges']:
        parents = [item for item in previous['navigationChanges'] if item['path'] == row['path']]
        require(len(parents) == 1 and parents[0]['sourceBlob'] == row['sourceBlob'] and
                parents[0]['stagedBlob'] == row['priorStagedBlob'], 'navigation-chain')
        if source_objects:
            require(blob(git(root, 'show', BASIS + ':' + row['path'])) == row['priorStagedBlob'],
                    'navigation-prior-byte-drift')
    if source_objects:
        require(blob(git(root, 'show', BASIS + ':' + PREDECESSOR['path'])) == PREDECESSOR['blob'],
                'predecessor-original-byte-drift')


def verify(root=ROOT, source_objects=False):
    root = Path(root).resolve()
    try:
        manifest_bytes = read(root, MANIFEST)
        value = json_data(manifest_bytes)
        validate_manifest(value)
        require(blob(manifest_bytes) == HISTORICAL_MANIFEST_BLOB, 'historical-receipt-drift')
        data, raw = {}, {}
        for row in value['files']:
            content = read(root, row['path'])
            require(blob(content) == row['stagedBlob'], 'staged-byte-drift')
            raw[row['path']] = content
            if row['path'].endswith('.json'):
                data[row['path']] = json_data(content)
            if source_objects:
                original = git(root, 'show', SOURCE_COMMIT + ':' + row['path'])
                require(blob(original) == row['sourceBlob'] and original == content, 'original-byte-drift')
        validate_metadata(data)
        validate_navigation(root, value, source_objects)
        inspect_packet(raw, data)
    except Invalid:
        raise
    except (OSError, UnicodeError, ValueError, TypeError, KeyError, IndexError, RecursionError):
        raise Invalid('unreadable-or-malformed-input') from None
    return {'files': 8, 'exact_copies': 8, 'original_git_objects_checked': 8 if source_objects else 0,
            'prior_navigation_objects_checked': 2 if source_objects else 0,
            'predecessor_manifest_objects_checked': 1 if source_objects else 0,
            'historical_navigation_receipt': True,
            'namespace': 'HUEY-CARELAW-01', 'prose_units': 256, 'declared_sources': 41,
            'prose_source_references': 39, 'review_rows': 34, 'candidate_section_joins': 17,
            'historical_edited_units': 10, 'historical_added_units': 105,
            'historical_detailed_review_units': 115, 'retained_units_with_deeper_review_open': 141,
            'historical_inspection_states': dict(INSPECTIONS),
            'inherited_negative_cases': 21, 'exports_written': 0, 'limits': LIMITS}


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
