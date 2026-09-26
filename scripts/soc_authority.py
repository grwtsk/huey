#!/usr/bin/env python3
"""Read-only checks for nine pinned Q03 files and an explicit navigation successor.

Historical citation/inspection results are preserved, not rerun. This checker
does not fetch external sources, export data, activate metadata or grant authority.
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
_spec = importlib.util.spec_from_file_location('authority_copy_checks', Path(__file__).with_name('soc_ancillary.py'))
copy_checks = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(copy_checks)
Invalid = copy_checks.Invalid
require, read, blob, json_data, git = (copy_checks.require, copy_checks.read, copy_checks.blob,
                                     copy_checks.json_data, copy_checks.git)
MANIFEST = 'planning/consolidation/soc-authority.json'
CORE_MANIFEST = 'planning/consolidation/soc-core.json'
REVIEW = 'planning/standard-of-care/authority-q03/'
SOURCE = 'sources/standard-of-care/neurology-current/content/authority-quotes.json'
SOURCE_COMMIT = 'ff0499bd341de12a31b355b79867b547f19d9b16'
BASIS = '628f7d30fcbaff625a07cb7f46d937a5c670668a'
EXPECTED = {'planning/standard-of-care/authority-q03/README.md': '4979b693f53f76a91062ebbd069e1b929860379e',
 'planning/standard-of-care/authority-q03/argument-draft.md': '547fe80c68a05b345df322c34e928a9b78ab373d',
 'planning/standard-of-care/authority-q03/claims.tsv': 'a490a34d58e36067d2e468e88533ae1cbc0f7954',
 'planning/standard-of-care/authority-q03/fields.tsv': '2540429f1591da3f88a5dd389ed88ef0a4933390',
 'planning/standard-of-care/authority-q03/review.json': '8f8bf5d45a97154dea8183395e11faaecaaa8426',
 'planning/standard-of-care/authority-q03/test_verify.py': 'd50f552410419da61e4c9b240a946fef9488894c',
 'planning/standard-of-care/authority-q03/verify.py': 'f8192b0055e1f803900a7a00f5f0972c96c27c6e',
 'sources/standard-of-care/neurology-current/content/authority-quotes.json': '69f35715a28dc800250959ee2a19cf67bfa91e90',
 'sources/standard-of-care/transfer-q03.json': '8720d1c4190e2c4a7cdaa578605f409099e9ab34'}
NAVIGATION = {'planning/standard-of-care/README.md': ('8b0980ce6e7b0835829ebbd8ab64d194d42b9380',
                                         'ac41c51e475fab0d871026b95d8c10ce60d4fb85'),
 'sources/standard-of-care/README.md': ('ab5be50cb8658598ddec064424aaf38e554ea39a',
                                        'd78ea8f83c8d13ae5ecc3f5d1f56777a78570510')}
FLAGS = {'sourceCopyOnly': True,
 'manuscriptAdmission': False,
 'sourceMetadataActive': False,
 'newEvidenceReceived': False,
 'substantiveVerificationPerformed': False,
 'externalResearchPerformed': False,
 'fullCorpusTransferComplete': False,
 'authorityFromReferences': False}
SCOPE_REFS = ['https://github.com/grwtsk/huey/issues/2#issuecomment-5771600544', 'https://github.com/grwtsk/huey/issues/125', 'https://github.com/grwtsk/huey/issues/126', 'https://github.com/grwtsk/huey/issues/144', 'https://github.com/grwtsk/huey/issues/145', 'https://github.com/grwtsk/huey/issues/176', 'https://github.com/grwtsk/huey/issues/192', 'https://github.com/grwtsk/huey/issues/423']
NOTICE = 'This selection preserves the public authority register, historical source-reading record and candidate argument. Prior source dates, inspection results and verification labels remain historical assertions, not new research or authority. Source metadata is documentary; references do not authenticate a grant. No new evidence, manuscript admission, factual clearance or promotion is supplied.'
PREDECESSOR = {'path': 'planning/consolidation/soc-ancillary.json', 'blob': 'b48e8555cd650abc5e5d2b1cb76fad1b02943fba'}
SOURCE_VERSION = 'c920e426b8b6753b9f4bacf019e48010e57918c2'
SHA = re.compile(r'[0-9a-f]{40}\Z')
SUMMARY = {'source_bytes': 15994, 'source_lines': 351, 'source_entries': 12,
           'scalar_fields': 271, 'relationship_targets': 68, 'substantial_field_targets': 89,
           'new_propositions': 14, 'candidate_units': 12, 'primary_text_matches': 9,
           'official_index_only': 2, 'text_unverified': 1, 'semantic_truth_certified': False}
LIMITS = ('Pinned copy bytes, historical source-reading dispositions, claim/reference consistency and '
          'explicit navigation lineage only; no fresh citation research, media inspection, source authentication, '
          'disclosure authority, factual clearance, manuscript admission or complete corpus coverage.')


def validate_manifest(value):
    fields = {'schema', 'basisRevision', 'sourceRepository', 'sourcePR', 'sourceCommit',
              'scopeRefs', 'notice', 'files', 'predecessorManifest', 'navigationChanges'} | set(FLAGS)
    require(type(value) is dict and set(value) == fields, 'manifest-fields')
    require(value['schema'] == 'huey.soc-authority.v1', 'manifest-schema')
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
    transfer = data['sources/standard-of-care/transfer-q03.json']
    require(transfer['id'] == 'SOC-Q03-transfer' and transfer['approval'] == 'SOC-PUBLIC-01' and
            transfer['source_repository'] == 'grwtsk/neurology' and
            transfer['source_commit'] == SOURCE_VERSION, 'transfer-identity')
    require(transfer['source_path'] == 'content/authority-quotes.json' and
            transfer['destination'] == 'neurology-current/content/authority-quotes.json' and
            transfer['source_blob'] == transfer['destination_blob'] == EXPECTED[SOURCE] and
            transfer['copy_type'] == 'byte-identical-complete-json' and
            transfer['bytes'] == 15994 and transfer['entries'] == 12, 'transfer-source-binding')
    require(transfer['supersedes'] == {'manifest': 'transfer-manifest.json',
                                     'pending_source_path': 'content/authority-quotes.json'} and
            transfer['review'] == '../../' + REVIEW + 'README.md' and
            transfer['verification_issues'] == [192, 144, 145, 176], 'transfer-references')
    for key in ['source_originals_modified', 'live_site_modified', 'raw_clinical_records_included',
                'factual_verification_complete']:
        require(transfer[key] is False, 'transfer-completion-claim')
    require(transfer['manuscript_status'] == 'candidate-only' and transfer['ancillary_remaining'] == [
        'content/articles/ethics-authority-positive-change.json',
        'content/articles/images/i-bled-so.png'], 'transfer-remaining-boundary')
    review = data[REVIEW + 'review.json']
    source = review['source']
    require(review['id'] == 'SOC-Q03' and review['repository'] == 'grwtsk/huey' and
            review['approval'] == 'SOC-PUBLIC-01' and source['path'] == SOURCE and
            source['repository'] == 'grwtsk/neurology' and source['commit'] == SOURCE_VERSION and
            source['git_blob'] == EXPECTED[SOURCE] and source['bytes'] == 15994 and
            source['lines'] == 351, 'review-source-binding')
    require(review['checked_at_utc'] == '2026-09-22T06:52:46+00:00' and
            data[SOURCE]['verified_at'] == '2026-09-18', 'historical-date')
    require(source['originals_modified'] is False and review['raw_clinical_records_published'] is False and
            review['factual_clearance'] is False and review['manuscript_status'] == 'candidate-only' and
            review['default_relationship_state'] == 'unreviewed-correspondence', 'review-completion-claim')


def validate_navigation(root, value, source_objects):
    previous_bytes = read(root, PREDECESSOR['path'])
    require(blob(previous_bytes) == PREDECESSOR['blob'], 'predecessor-byte-drift')
    previous = json_data(previous_bytes)
    copy_checks.validate_manifest(previous)
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
        # Fixed, byte-checked historical code; no --root override or research call.
        environment = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
        result = subprocess.run([sys.executable, str(root / (REVIEW + 'verify.py'))], cwd=root,
                                env=environment, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False)
        require(result.returncode == 0, 'inherited-review-check')
        require(json_data(result.stdout) == {'ok': True, 'checks': SUMMARY}, 'inherited-review-summary')
    except Invalid:
        raise
    except (OSError, UnicodeError, ValueError, TypeError, KeyError, IndexError, RecursionError):
        raise Invalid('unreadable-or-malformed-input') from None
    return {'files': 9, 'exact_copies': 9, 'original_git_objects_checked': 9 if source_objects else 0,
            'prior_navigation_objects_checked': 2 if source_objects else 0,
            'predecessor_manifest_objects_checked': 1 if source_objects else 0,
            'source_records': 1, 'source_bytes': 15994, 'source_entries': 12,
            'scalar_fields': 271, 'relationship_targets': 68, 'substantial_field_targets': 89,
            'propositions': 14, 'candidate_units': 12,
            'historical_text_dispositions': {'matched': 9, 'index_only': 2, 'unverified': 1},
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
