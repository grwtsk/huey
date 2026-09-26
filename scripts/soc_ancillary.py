#!/usr/bin/env python3
"""Read-only validation of the fixed 15-file SOC ancillary consolidation.

The enclosing soc_consolidation.py check enforces complete SOC tree coverage.
This selected-file check makes no network request or authority decision and never
exports the inherited occurrence index. Received source metadata stays inert.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = 'planning/consolidation/soc-ancillary.json'
CORE_MANIFEST = 'planning/consolidation/soc-core.json'
HISTORICAL_MANIFEST_BLOB = 'b48e8555cd650abc5e5d2b1cb76fad1b02943fba'
REVIEW = 'planning/standard-of-care/ancillary-r02/'
SOURCE_ROOT = 'sources/standard-of-care/neurology-current/content/'
SOURCE_COMMIT = 'ff0499bd341de12a31b355b79867b547f19d9b16'
BASIS = 'fe1b8a55df7f687b7ef652e5e9bbfc5e5b6cc594'
EXPECTED = {'planning/standard-of-care/ancillary-r02/README.md': 'ac67c14c532f4f88e450c7c89006ea7e048953a7',
 'planning/standard-of-care/ancillary-r02/argument-draft.md': '67426c44ad2c9d2eceed30abe19ca2081aa8c136',
 'planning/standard-of-care/ancillary-r02/checks.json': '6b8717a6e0c8597bcfe8d1f65b478df0eae15e56',
 'planning/standard-of-care/ancillary-r02/claims.tsv': 'b36a2f6b8a3fe5762530cbee26ea2395232019b6',
 'planning/standard-of-care/ancillary-r02/leaf-dispositions.tsv': '0d14cb282b2855812378054db39d1db450474c5f',
 'planning/standard-of-care/ancillary-r02/manifest.json': 'f9c4d41c654563fcad7a4336d3cf402a0a5bb0aa',
 'planning/standard-of-care/ancillary-r02/nodes.tsv': 'e9713dc0cff8646d68361e08ba2a2843aaf0440e',
 'planning/standard-of-care/ancillary-r02/test_verify.py': 'ab4294b1df0f6e270b6cff8552aba168bec5c6fa',
 'planning/standard-of-care/ancillary-r02/verify.py': '43eea7523e4bad25d8e07851a1b903fa1920cb1e',
 'sources/standard-of-care/neurology-current/content/articles/discipline-and-punish.json': '17aab6ab4008a2b2873aae0b9adc5c6b177c9d7f',
 'sources/standard-of-care/neurology-current/content/articles/i-bledsoe-i-bled-so.json': 'b120e14daf7731e4ec12dcd7603d9a90bdac28f1',
 'sources/standard-of-care/neurology-current/content/articles/neurology-cannot-undo-the-harm.json': '2eab197970746ee67d97bcd0c7bf3d25f6a6125e',
 'sources/standard-of-care/neurology-current/content/articles/on-dignity.json': '75c80e06a66bb8edf9d9972d5c1fd3003f1d1616',
 'sources/standard-of-care/neurology-current/content/site.json': '16b7edd3a92f5e34de821756ad0a165822481d50',
 'sources/standard-of-care/transfer-r02.json': '58d03675db0d138a0664914056e688f30e1a722f'}
NAVIGATION = {'planning/standard-of-care/README.md': ('8b0980ce6e7b0835829ebbd8ab64d194d42b9380',
                                         'faff3cdb745e34523821e7c14dbce007f14ec77e'),
 'sources/standard-of-care/README.md': ('ab5be50cb8658598ddec064424aaf38e554ea39a',
                                        'c85a13efa6b02ed1de0c2d8aea58ab958d97e4ee')}
FLAGS = {'sourceCopyOnly': True,
 'manuscriptAdmission': False,
 'sourceMetadataActive': False,
 'mediaBytesImported': False,
 'newEvidenceReceived': False,
 'substantiveVerificationPerformed': False,
 'fullCorpusTransferComplete': False,
 'authorityFromReferences': False}
SCOPE_REFS = ['https://github.com/grwtsk/huey/issues/2#issuecomment-5771600544', 'https://github.com/grwtsk/huey/issues/125', 'https://github.com/grwtsk/huey/issues/126', 'https://github.com/grwtsk/huey/issues/145', 'https://github.com/grwtsk/huey/issues/176', 'https://github.com/grwtsk/huey/issues/188', 'https://github.com/grwtsk/huey/issues/189', 'https://github.com/grwtsk/huey/issues/190', 'https://github.com/grwtsk/huey/issues/191', 'https://github.com/grwtsk/huey/issues/421']
NOTICE = 'This selection preserves five public working-source JSON records and their historical review apparatus. Source metadata remains documentary, the draft remains unassigned, and earlier checks remain dated receipts. Reference URLs and approval fields do not authenticate or grant authority. No media payload, new evidence, source verification, manuscript admission, complete corpus clearance or promotion is supplied.'
SOURCE_VERSION = 'c920e426b8b6753b9f4bacf019e48010e57918c2'
SHA = re.compile(r'[0-9a-f]{40}\Z')
SOURCE_RECORDS = {
    'audio': ('articles/discipline-and-punish.json', 5432),
    'harm': ('articles/neurology-cannot-undo-the-harm.json', 2264),
    'dignity': ('articles/on-dignity.json', 2096),
    'painting': ('articles/i-bledsoe-i-bled-so.json', 2634),
    'site': ('site.json', 11774),
}
SUMMARY = {'sources': 5, 'source_bytes': 24200, 'identity_matches': 5,
           'nodes': 59, 'scalar_occurrences': 358, 'scoped_claims': 70,
           'substantial_support': 16, 'references': 14,
           'additional_prose_occurrences_pending': 0, 'external_truth_verified': False}
LIMITS = ('Selected copy bytes, declared source/reference identities and inherited review consistency only; '
          'not source authentication, media inspection, live-target resolution, substantive verification, '
          'disclosure authority, manuscript admission or complete corpus coverage. '
          'Navigation is the fixed historical receipt; run soc_consolidation.py '
          'for current navigation and combined SOC file coverage.')


class Invalid(ValueError):
    """Fixed reason only; do not echo source data or submitted paths."""


def require(condition, reason):
    if not condition:
        raise Invalid(reason)


def blob(raw):
    return hashlib.sha1(b'blob ' + str(len(raw)).encode('ascii') + b'\0' + raw).hexdigest()


def json_data(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'duplicate-json-key')
            result[key] = value
        return result
    def nonfinite(_):
        raise Invalid('nonfinite-json')
    try:
        return json.loads(raw, object_pairs_hook=pairs, parse_constant=nonfinite)
    except (UnicodeError, json.JSONDecodeError, RecursionError):
        raise Invalid('invalid-json') from None


def read(root, relative):
    """Open fixed descendants without following symlinks, including directories."""
    require(type(relative) is str, 'unsafe-path')
    parts = relative.split('/')
    require(all(re.fullmatch(r'[A-Za-z0-9_.-]+', part) and part not in {'.', '..'}
                for part in parts), 'unsafe-path')
    fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for index, part in enumerate(parts):
            flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
            if index < len(parts) - 1:
                flags |= os.O_DIRECTORY
            child = os.open(part, flags, dir_fd=fd)
            os.close(fd)
            fd = child
        require(stat.S_ISREG(os.fstat(fd).st_mode), 'nonregular-input')
        with os.fdopen(fd, 'rb') as stream:
            fd = None
            return stream.read()
    finally:
        if fd is not None:
            os.close(fd)


def git(root, *args):
    environment = dict(os.environ, GIT_NO_LAZY_FETCH='1', GIT_TERMINAL_PROMPT='0')
    result = subprocess.run(['git', '-C', str(root), *args], stdout=subprocess.PIPE,
                            stderr=subprocess.DEVNULL, env=environment, check=False)
    require(result.returncode == 0, 'git-input-unavailable')
    return result.stdout


def validate_manifest(value):
    fields = {'schema', 'basisRevision', 'sourceRepository', 'sourcePR', 'sourceCommit',
              'scopeRefs', 'notice', 'files', 'navigationChanges'} | set(FLAGS)
    require(type(value) is dict and set(value) == fields, 'manifest-fields')
    require(value['schema'] == 'huey.soc-ancillary.v1', 'manifest-schema')
    require(value['basisRevision'] == BASIS, 'basis-pin')
    require(value['sourceRepository'] == 'grwtsk/huey' and
            type(value['sourcePR']) is int and value['sourcePR'] == 122 and
            value['sourceCommit'] == SOURCE_COMMIT, 'source-pin')
    require(value['scopeRefs'] == SCOPE_REFS and value['notice'] == NOTICE, 'scope-limits')
    require(all(value[key] is expected for key, expected in FLAGS.items()), 'completion-or-authority-claim')
    rows = value['files']
    require(type(rows) is list and len(rows) == 15, 'file-count')
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
    changes = value['navigationChanges']
    require(type(changes) is list and len(changes) == 2, 'navigation-count')
    seen = set()
    for row in changes:
        require(type(row) is dict and set(row) == {'path', 'sourceBlob', 'priorStagedBlob', 'stagedBlob'},
                'navigation-fields')
        path = row['path']
        require(type(path) is str and path in NAVIGATION and path not in seen, 'navigation-selection')
        seen.add(path)
        require((row['sourceBlob'], row['priorStagedBlob']) == NAVIGATION[path], 'navigation-prior-pin')
        require(type(row['stagedBlob']) is str and SHA.fullmatch(row['stagedBlob']), 'navigation-staged-shape')


def validate_metadata(data):
    """Retain declared historical boundaries; never inherit their authority labels."""
    review = data[REVIEW + 'manifest.json']
    require(review['repository'] == 'grwtsk/huey' and review['source_repository'] == 'grwtsk/neurology' and
            review['source_commit'] == SOURCE_VERSION and review['approval'] == 'SOC-PUBLIC-01', 'review-identity')
    for key in ['source_originals_modified', 'raw_clinical_records_included', 'external_research_performed',
                'media_bytes_copied', 'full_conversation_capture_complete', 'whole_corpus_semantic_review_complete']:
        require(review[key] is False, 'review-completion-claim')
    require(review['source_root'] == SOURCE_ROOT.rstrip('/') and review['issue'] == 188 and
            review['argument_issue'] == 191, 'review-references')
    records = {key: {'path': name, 'git_blob': EXPECTED[SOURCE_ROOT + name], 'bytes': size}
               for key, (name, size) in SOURCE_RECORDS.items()}
    require(review['records'] == records, 'source-record-membership')
    transfer = data['sources/standard-of-care/transfer-r02.json']
    require(transfer['pass'] == 'SOC-T02' and transfer['approval'] == 'SOC-PUBLIC-01' and
            transfer['source_repository'] == 'grwtsk/neurology' and transfer['source_commit'] == SOURCE_VERSION and
            transfer['destination_repository'] == 'grwtsk/huey', 'transfer-identity')
    require(transfer['parent_manifest'] == 'transfer-manifest.json' and
            transfer['review_manifest'] == '../../' + REVIEW + 'manifest.json', 'transfer-references')
    expected = [{'source_path': 'content/' + name,
                 'destination': 'neurology-current/content/' + name,
                 'source_and_destination_git_blob': EXPECTED[SOURCE_ROOT + name], 'bytes': size}
                for name, size in SOURCE_RECORDS.values()]
    require(transfer['source_records_completed'] == expected, 'transfer-source-membership')
    require(transfer['claims'] == {'namespace': 'ANC-C', 'count': 70, 'substantial_support': 16,
                                 'table': '../../' + REVIEW + 'claims.tsv',
                                 'node_index': '../../' + REVIEW + 'nodes.tsv'}, 'transfer-claim-references')
    for key in ['complete_conversation_capture', 'complete_corpus_verification', 'image_and_audio_bytes_included']:
        require(transfer[key] is False, 'transfer-completion-claim')
    require(transfer['pending_presentation_records'] == review['full_prose_presentation_json_pending'] == 12,
            'representation-boundary')
    require(transfer['remaining_ancillary'] == review['ancillary_files_remaining'] == [
        'content/articles/ethics-authority-positive-change.json',
        'content/articles/images/i-bled-so.png', 'content/authority-quotes.json'], 'remaining-boundary')
    historical = data[REVIEW + 'checks.json']
    require(historical['summary'] == SUMMARY and historical['unittest_cases'] == 18 and
            historical['full_checkout_obtained'] is False and historical['full_repository_suite_run'] is False and
            historical['external_claim_verification_performed'] is False, 'historical-check-boundary')


def verify(root=ROOT, source_objects=False):
    root = Path(root).resolve()
    try:
        manifest_bytes = read(root, MANIFEST)
        value = json_data(manifest_bytes)
        validate_manifest(value)
        require(blob(manifest_bytes) == HISTORICAL_MANIFEST_BLOB, 'historical-receipt-drift')
        data = {}
        for row in value['files']:
            raw = read(root, row['path'])
            require(blob(raw) == row['stagedBlob'], 'staged-byte-drift')
            if row['path'].endswith('.json'):
                data[row['path']] = json_data(raw)
            if source_objects:
                original = git(root, 'show', SOURCE_COMMIT + ':' + row['path'])
                require(blob(original) == row['sourceBlob'] and original == raw, 'original-byte-drift')
        # This completed navigation transition is now a fixed historical receipt.
        # The authority successor and cumulative checker bind current navigation.
        for row in value['navigationChanges']:
            if source_objects:
                require(blob(git(root, 'show', BASIS + ':' + row['path'])) == row['priorStagedBlob'],
                        'navigation-prior-byte-drift')
        validate_metadata(data)
        # Only this byte-pinned inherited checker runs, without its output option.
        environment = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
        command = [sys.executable, str(root / (REVIEW + 'verify.py'))]
        result = subprocess.run(command, cwd=root, env=environment, stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, check=False)
        require(result.returncode == 0, 'inherited-review-check')
        require(json_data(result.stdout) == SUMMARY, 'inherited-review-summary')
    except Invalid:
        raise
    except (OSError, UnicodeError, ValueError, TypeError, KeyError, IndexError, RecursionError):
        raise Invalid('unreadable-or-malformed-input') from None
    return {'files': 15, 'exact_copies': 15,
            'original_git_objects_checked': 15 if source_objects else 0,
            'prior_navigation_objects_checked': 2 if source_objects else 0,
            'historical_navigation_receipt': True,
            'source_records': 5, 'source_bytes': 24200, 'id_bearing_nodes': 59,
            'scalar_occurrences': 358, 'scoped_claims': 70, 'substantial_support_targets': 16,
            'source_references': 14, 'limits': LIMITS}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-objects', action='store_true',
                        help='compare available original Git objects and prior navigation; never fetch')
    args = parser.parse_args()
    try:
        print(json.dumps(verify(source_objects=args.source_objects), indent=2))
    except Invalid as error:
        parser.exit(1, 'FAIL: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
