#!/usr/bin/env python3
"""Read-only checks for a pinned SOC source-copy slice, never factual clearance.

Coverage is the Git-tracked/unignored candidate file set in the two SOC trees.
This checker never queries a remote, reads an upstream/private source, or grants
permission. Git byte pins do not establish faithful original source extraction.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
_ancillary_spec = importlib.util.spec_from_file_location('huey_soc_ancillary', Path(__file__).with_name('soc_ancillary.py'))
ancillary = importlib.util.module_from_spec(_ancillary_spec)
_ancillary_spec.loader.exec_module(ancillary)
_authority_spec = importlib.util.spec_from_file_location('huey_soc_authority', Path(__file__).with_name('soc_authority.py'))
authority = importlib.util.module_from_spec(_authority_spec)
_authority_spec.loader.exec_module(authority)
MANIFEST = 'planning/consolidation/soc-core.json'
# Frozen reviewed import selection; extending it requires another scoped review.
SOURCE_COMMIT = 'ff0499bd341de12a31b355b79867b547f19d9b16'
BASIS = '26447f857fbf85e5a28b0b3367a414533262d89f'
EXPECTED = {'.github/ISSUE_TEMPLATE/claim-verification.md': '3cee7a0b1d80085dae6aa9710b814d45167a7ca4',
 '.gitmessage': '9fdd1a55a6a0cdaaf61b95266a20943af4c696b3',
 'planning/standard-of-care/AUTHORIZATION.md': 'e6f040d701a4e6abba01b3821facb07ce027ccd0',
 'planning/standard-of-care/DISCLAIMER.md': '9599299b52343e7c71ce3e24c0e8892ea4339124',
 'planning/standard-of-care/README.md': '8b0980ce6e7b0835829ebbd8ab64d194d42b9380',
 'planning/standard-of-care/approval.json': '25a275ead999d920e5ce175891efd61c8ba18250',
 'planning/standard-of-care/check_registry.py': '071a46904cfa1733e240ff638ac767cb43cc4750',
 'planning/standard-of-care/check_support.py': '7364bcfb364fba7108536eb86b4cfb3aff99cb3e',
 'planning/standard-of-care/claims.tsv': 'f5a0a2e7b02dad2f94288c0d1b877bd4216db94e',
 'planning/standard-of-care/registry.json': '769a0d9d30d8b24118d439e0cbd6f8934c5d728c',
 'planning/standard-of-care/support-policy.json': '50543afdc87979f99ae5c020d24946adca394457',
 'planning/standard-of-care/test_registry.py': '87dfba4de18c72c81f36109b4ae014120d2621f3',
 'planning/standard-of-care/test_support.py': 'f0fb437b22fb7b1f0d3868d03a1cac43e01eabf6',
 'sources/standard-of-care/AGENTS.md': '10a83128a3315cd90cbd34bc2aa8d10b18d4f015',
 'sources/standard-of-care/README.md': 'ab5be50cb8658598ddec064424aaf38e554ea39a',
 'sources/standard-of-care/context/README.md': 'f6dcf35473b68634883deb3c72ef8852fd32ab4d',
 'sources/standard-of-care/context/manifest.json': 'ec13de6baeedc20ac4548df25a24779f707b989d',
 'sources/standard-of-care/context/standard.md': '235591b166ca520ee6a767ef789775c11a8f7d36',
 'sources/standard-of-care/context/the-trust-i-had-already-given.md': 'dea9aff84a148d85959356e82390fa986719c66c',
 'sources/standard-of-care/context/thread-dossier.md': 'b1fe3fe10f05034c4d43e999ea184f6d3b2fb517',
 'sources/standard-of-care/neurology-current/README.md': 'b1557a3e0ee9ce60fd7e0264d1f4ee66bffc40d3',
 'sources/standard-of-care/neurology-current/content/articles/atlas.json': 'f0060ba32231f6f08399ea174dc279dc2556ecff',
 'sources/standard-of-care/neurology-text/README.md': '7fbc787babfcaee734b56977dd68fa8656e811ad',
 'sources/standard-of-care/neurology-text/awareness-and-the-social-contract.md': '66ada2cc0b193f9ad90511a34465f1d2fe85f6a4',
 'sources/standard-of-care/neurology-text/before-the-examination-the-patient-who-arrived-at-stanford.md': '4c64a6c699129e6ae96b25ad36cf600545346ea8',
 'sources/standard-of-care/neurology-text/communication-changed-risk.md': '2b80501728777f87ada72180972cdbbe453597ef',
 'sources/standard-of-care/neurology-text/from-stanford-to-ucsf-the-transfer-was-part-of-the-history.md': '51cb89235f6f8b8d704677e482384edb9e924d3f',
 'sources/standard-of-care/neurology-text/his-test-is-his-my-persistence-is-mine.md': '523dba7662ee6c00962e2480fc5730bde2496e99',
 'sources/standard-of-care/neurology-text/january-24-2019-the-origin-point.md': '7f137cd5477e6091021b8831a7d85250d83a3f40',
 'sources/standard-of-care/neurology-text/medicine-worthy-of-its-laurels.md': '8dc31ba05b48e32754c672e8e1b38f078d79b2aa',
 'sources/standard-of-care/neurology-text/the-unordinary-test-of-goodness.md': 'dafcb68a2eed3a37181738b6852a5b2c8d350f43',
 'sources/standard-of-care/neurology-text/what-must-be-explained-evidence-witnesses-and-the-honest-mistake-hypothesis.md': '37d5ef7cb80f571a74ba95e5eecf3bb0ef0955f1',
 'sources/standard-of-care/neurology-text/when-care-becomes-the-threat.md': '6f8c7e7594c486267acdc62812d4b077faccf80a',
 'sources/standard-of-care/neurology-text/worse-than-a-rapist.md': '641f3ac14e8fb4a9622ec77f49bf6781689998f7',
 'sources/standard-of-care/neurology-text/writing-as-the-act-of-care.md': '0912ed8d49013843361c55fb38ed6250915618c8',
 'sources/standard-of-care/transfer-manifest.json': '72a3b30aa3741936ea400c6fd46c7ee7fca30387'}
ADAPTED = ['planning/standard-of-care/README.md', 'sources/standard-of-care/README.md']
NOTICE = 'This is a selective public working-source copy from the pinned PR, not manuscript admission, new evidence intake, source authentication, completed corpus coverage or substantive verification. Scope references locate the recorded instruction; URLs and declared approval fields do not authenticate or grant authority. Original representation limits remain operative.'

SCOPES = ['sources/standard-of-care', 'planning/standard-of-care']
SCOPE_REFS = ['https://github.com/grwtsk/huey/issues/2#issuecomment-5771600544'] + [
    'https://github.com/grwtsk/huey/issues/' + str(n) for n in [125, 126, 127, 145, 176]]
FLAGS = {'sourceCopyOnly': True, 'manuscriptAdmission': False,
         'newEvidenceReceived': False, 'substantiveVerificationPerformed': False,
         'fullCorpusTransferComplete': False, 'atomicClaimReviewComplete': False,
         'authorityFromReferences': False}
SHA = re.compile(r'[0-9a-f]{40}\Z')
LIMITS = ('Pinned copy bytes, initial claim routing and declared source-reference membership only; '
          'not upstream extraction verification, article-unit resolution, source authentication, '
          'support, disclosure authority, complete coverage or manuscript acceptance.')


class Invalid(ValueError):
    """Reason-only diagnostic: never echo source contents or submitted paths."""


def require(condition, reason):
    if not condition:
        raise Invalid(reason)


def json_data(raw):
    def pairs(items):
        value = {}
        for key, item in items:
            require(key not in value, 'duplicate-json-key')
            value[key] = item
        return value
    def nonfinite(_):
        raise Invalid('nonfinite-json')
    try:
        return json.loads(raw, object_pairs_hook=pairs, parse_constant=nonfinite)
    except (UnicodeError, json.JSONDecodeError):
        raise Invalid('invalid-json') from None


def blob(raw):
    return hashlib.sha1(b'blob ' + str(len(raw)).encode('ascii') + b'\0' + raw).hexdigest()


def read(root, relative):
    path = root
    for part in relative.split('/'):
        path = path / part
        require(not path.is_symlink(), 'symlink-input')
    require(path.is_file(), 'missing-or-nonregular-file')
    return path.read_bytes()


def git(root, *args):
    environment = dict(os.environ, GIT_NO_LAZY_FETCH='1', GIT_TERMINAL_PROMPT='0')
    result = subprocess.run(['git', '-C', str(root), *args], stdout=subprocess.PIPE,
                            stderr=subprocess.DEVNULL, env=environment, check=False)
    require(result.returncode == 0, 'git-input-unavailable')
    return result.stdout


def validate_manifest(value):
    fields = {'schema', 'basisRevision', 'sourceRepository', 'sourcePR', 'sourceCommit',
              'scopeRefs', 'notice', 'files'} | set(FLAGS)
    require(type(value) is dict and set(value) == fields, 'manifest-fields')
    require(value['schema'] == 'huey.soc-core.v1', 'manifest-schema')
    require(value['basisRevision'] == BASIS, 'basis-pin')
    require(value['sourceRepository'] == 'grwtsk/huey' and
            type(value['sourcePR']) is int and value['sourcePR'] == 122 and
            value['sourceCommit'] == SOURCE_COMMIT, 'source-pin')
    require(value['scopeRefs'] == SCOPE_REFS and value['notice'] == NOTICE, 'scope-limits')
    require(all(value[key] is expected for key, expected in FLAGS.items()), 'completion-or-authority-claim')
    rows = value['files']
    require(type(rows) is list and len(rows) == len(EXPECTED), 'file-count')
    seen = set()
    for row in rows:
        require(type(row) is dict and set(row) == {'path', 'sourceBlob', 'stagedBlob', 'representation'},
                'file-fields')
        path = row['path']
        require(type(path) is str and path in EXPECTED and path not in seen, 'file-selection')
        seen.add(path)
        require(row['sourceBlob'] == EXPECTED[path], 'source-blob-pin')
        require(type(row['stagedBlob']) is str and SHA.fullmatch(row['stagedBlob']), 'staged-blob-shape')
        require(row['representation'] == ('adapted-navigation' if path in ADAPTED else 'exact'),
                'representation')
        if path not in ADAPTED:
            require(row['stagedBlob'] == row['sourceBlob'], 'exact-copy-pin')
    require(seen == set(EXPECTED), 'file-selection')


def validate_membership(data):
    """Check reference membership, not the absent source rendering-unit payloads."""
    transfer = data['sources/standard-of-care/transfer-manifest.json']
    summary = transfer['summary']
    for key in ['full_presentation_json_transfer_complete', 'atomic_claim_review_complete',
                'automated_full_conversation_export_complete']:
        require(summary[key] is False, 'source-completion-claim')
    require(transfer['raw_clinical_records_included'] is False and
            transfer['source_originals_modified'] is False, 'source-boundary')
    require(summary['complete_authored_prose_exports'] == 12 and
            summary['complete_atlas_models'] == 1 and summary['atlas_principles'] == 23,
            'source-counts')
    exports = transfer['prose_exports']
    expected_paths = {path for path in EXPECTED if '/neurology-text/' in path and
                      not path.endswith('/README.md')}
    require(type(exports) is list and len(exports) == 12, 'prose-count')
    paths, works = set(), set()
    for row in exports:
        path = 'sources/standard-of-care/' + row['destination']
        require(path in expected_paths and path not in paths and
                row['id'] == Path(path).stem and row['id'] not in works, 'prose-membership')
        paths.add(path)
        works.add(row['id'])
    require(paths == expected_paths, 'prose-membership')
    atlas_path = 'sources/standard-of-care/' + transfer['atlas']['destination']
    require(atlas_path == 'sources/standard-of-care/neurology-current/content/articles/atlas.json' and
            transfer['atlas']['destination_blob'] == EXPECTED[atlas_path], 'atlas-membership')
    require(transfer['atlas']['semantic_support_verified'] is False, 'atlas-support-claim')
    context = data['sources/standard-of-care/context/manifest.json']
    require(context['automated_verbatim_chat_export'] is False and
            context['raw_clinical_attachments_included'] is False, 'context-completion-claim')
    require([row['path'] for row in context['files']] == [
        'thread-dossier.md', 'standard.md', 'the-trust-i-had-already-given.md'], 'context-membership')
    for row in context['files']:
        require('sources/standard-of-care/context/' + row['path'] in EXPECTED, 'context-membership')
    atlas = data[atlas_path]['current']['atlas']
    principles = atlas['principles']
    ids = [row['id'] for row in principles]
    require(len(ids) == 23 and len(set(ids)) == 23, 'principle-identities')
    references = [atlas['capstone']] + [link for row in principles for link in row['article_links']]
    require(len(references) == 34 and all(link['work'] in works for link in references),
            'article-membership')
    edges = [link for row in principles for link in row['principle_links']]
    require(len(edges) == 48 and all(link['target'] in ids for link in edges), 'principle-membership')
    # The inherited initial registry deliberately does not claim corpus completion.
    registry = data['planning/standard-of-care/registry.json']
    require(registry['default_status'] == 'open-unverified' and all(
        registry['coverage'][key] is False for key in [
            'source_unit_audit_complete', 'verification_complete', 'full_text_transfer_complete']),
        'registry-completion-claim')
    policy = data['planning/standard-of-care/support-policy.json']
    require(policy['automatic_verification'] is False and policy['atomic_corpus_review_complete'] is False,
            'support-completion-claim')


def verify(root=ROOT, source_objects=False):
    root = Path(root).resolve()
    try:
        value = json_data(read(root, MANIFEST))
        validate_manifest(value)
        repo = git(root, 'rev-parse', '--show-toplevel').decode().strip()
        require(Path(repo).resolve() == root, 'checkout-root')
        listed = git(root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', *SCOPES)
        paths = {path.decode() for path in listed.split(b'\0') if path}
        expected = {path for path in EXPECTED if any(path.startswith(scope + '/') for scope in SCOPES)}
        # A fixed separately validated slice, never an arbitrary path exemption.
        expected |= set(ancillary.EXPECTED) | set(authority.EXPECTED)
        require(paths == expected, 'source-tree-coverage')
        data = {}
        for row in value['files']:
            raw = read(root, row['path'])
            require(blob(raw) == row['stagedBlob'], 'staged-byte-drift')
            if row['path'].endswith('.json'):
                data[row['path']] = json_data(raw)
            if source_objects:
                original = git(root, 'show', SOURCE_COMMIT + ':' + row['path'])
                require(blob(original) == row['sourceBlob'], 'original-byte-drift')
                if row['representation'] == 'exact':
                    require(original == raw, 'original-byte-drift')
        validate_membership(data)
        try:
            ancillary_result = ancillary.verify(root, source_objects=source_objects)
        except ancillary.Invalid as error:
            raise Invalid('ancillary-' + str(error)) from None
        try:
            authority_result = authority.verify(root, source_objects=source_objects)
        except authority.Invalid as error:
            raise Invalid('authority-' + str(error)) from None
        # Execute only the reviewed, byte-pinned existing local checker.
        environment = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
        command = [sys.executable, str(root / 'planning/standard-of-care/check_support.py'),
                   '--message-file', str(root / '.gitmessage')]
        result = subprocess.run(command, cwd=root, env=environment, stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, check=False)
        require(result.returncode == 0, 'claim-routing-or-notice')
        support = json_data(result.stdout)
        require(support.get('result') == 'PASS' and support.get('initial_targets') == 188 and
                support.get('substantial_support_targets') == 111 and
                support.get('substantive_verification') == 'not performed by this checker',
                'claim-routing-summary')
    except Invalid:
        raise
    except (OSError, UnicodeError, ValueError, TypeError, KeyError, IndexError):
        raise Invalid('unreadable-or-malformed-input') from None
    return {'files': 60, 'core_files': 36, 'ancillary_files': 15, 'authority_files': 9,
            'exact_copies': 58, 'adapted_navigation_files': 2,
            'original_git_objects_checked': 60 if source_objects else 0,
            'prior_navigation_objects_checked': (ancillary_result['prior_navigation_objects_checked'] +
                                                 authority_result['prior_navigation_objects_checked']),
            'predecessor_manifest_objects_checked': authority_result['predecessor_manifest_objects_checked'],
            'authored_text_exports': 12, 'atlas_principles': 23,
            'initial_claim_targets': 188, 'substantial_support_targets': 111,
            'ancillary_claim_targets': ancillary_result['scoped_claims'],
            'ancillary_substantial_support_targets': ancillary_result['substantial_support_targets'],
            'authority_propositions': authority_result['propositions'],
            'authority_scalar_fields': authority_result['scalar_fields'],
            'authority_relationship_targets': authority_result['relationship_targets'],
            'authority_substantial_field_targets': authority_result['substantial_field_targets'],
            'limits': LIMITS}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-objects', action='store_true',
                        help='also compare the available original Git objects; never fetch them')
    args = parser.parse_args()
    try:
        print(json.dumps(verify(source_objects=args.source_objects), indent=2))
    except Invalid as error:
        parser.exit(1, 'FAIL: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
