"""Synthetic public-intake contracts; no real evidence or private destinations."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
PROTOCOL = ROOT / 'planning/evidence-intake'
spec = importlib.util.spec_from_file_location('huey_public_evidence', PROTOCOL / 'verify_public_evidence.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
EID = 'HUEY-EV-7a564f32-6a64-4d4f-b4ec-0d6cf5174c7c'
OTHER = 'HUEY-EV-e2874ab9-1ec4-4a2c-85da-08e03924c753'
CERT = f'evidence/certificates/{EID}.json'
SENTINEL = 'SYNTHETIC_PRIVATE_SENTINEL'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def certificate(classification='PRIVATE_SENSITIVE'):
    return {
        'schema_version': 1, 'evidence_id': EID, 'certificate_version': 1,
        'classification': classification, 'public_title': 'Synthetic evidence only',
        'evidence_type': 'synthetic document',
        'custody': {'raw_custody': 'private_repository', 'public_raw_path': None, 'public_derivative_paths': []},
        'integrity': {'mode': 'private_salted_commitment', 'raw_sha256': None,
                      'commitment_scheme': 'sha256-salted-v1', 'public_commitment': 'a' * 64},
        'transcription': {'status': 'machine_typed_unreviewed', 'public': False,
                          'method': ['Synthetic method'], 'path': None, 'sha256_or_commitment': None},
        'description': {'public': False, 'path': None, 'status': 'withheld'},
        'relationships': [{'target': 'claim:synthetic', 'relationship': 'context',
                           'locator': 'synthetic page 1', 'contribution': 'Synthetic context only.',
                           'does_not_establish': 'No actual source or factual finding.'}],
        'review': {'machine': 'Synthetic structural check', 'human': None,
                   'source_authenticated': False, 'public_disclosure_reviewed': True},
        'limits': ['Synthetic fixture; not an actual evidence admission.'], 'status': 'active',
    }


def row_for(value):
    custody = value['custody']
    return {
        'evidence_id': value['evidence_id'], 'classification': value['classification'],
        'public_title': value['public_title'], 'evidence_type': value['evidence_type'],
        'raw_custody': custody['raw_custody'], 'certificate': CERT,
        'public_raw_or_derivative': custody['public_raw_path'] if custody['raw_custody'] == 'huey_public'
        else ';'.join(custody['public_derivative_paths']),
        'transcription_public': str(value['transcription']['public']).lower(),
        'review_state': 'machine_checked;human_pending' if value['review']['human'] is None else 'machine_checked;human_reviewed',
        'related_issues': ';'.join(item['target'] for item in value['relationships']), 'status': value['status'],
    }


class EvidenceIntakeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.addCleanup(self.temp.cleanup)
        for name in ('certificate.schema.json', 'private-manifest.schema.json'):
            path = self.root / 'planning/evidence-intake' / name
            path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(PROTOCOL / name, path)
        self.write('evidence/README.md', b'Synthetic public fixture.\n')
        self.index([])

    def write(self, path, data):
        full = self.root / path
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_bytes(data)

    def index(self, rows):
        self.write('evidence/index.tsv', ('\t'.join(checker.HEADER) + '\n' + ''.join(
            '\t'.join(row[key] for key in checker.HEADER) + '\n' for row in rows)).encode())

    def install(self, value=None, row=None):
        value = certificate() if value is None else value
        self.write(CERT, json.dumps(value).encode())
        self.index([row_for(value) if row is None else row])
        return value

    def rejects(self, reason=None):
        with self.assertRaises(checker.EvidenceCheckError) as caught:
            checker.verify(self.root)
        message = str(caught.exception)
        self.assertNotIn(SENTINEL, message)
        self.assertNotIn(str(self.root), message)
        self.assertNotIn(EID, message)
        self.assertRegex(message, r'^[a-z-]+$')
        if reason:
            self.assertEqual(message, reason)

    def derivative(self, transcript=True):
        value = certificate('PRIVATE_RAW_PUBLIC_DERIVATIVE')
        path = f'evidence/derivatives/{EID}/public-v1.txt'
        payload = b'Synthetic sanitized wording.\n'
        self.write(path, payload)
        value['custody']['public_derivative_paths'] = [path]
        if transcript:
            value['transcription'].update(public=True, path=path, sha256_or_commitment=sha(payload))
        manifest = {'schema_version': 1, 'evidence_id': EID,
                    'derivatives': [{'path': path, 'sha256': sha(payload), 'bytes': len(payload)}],
                    'limits': 'Synthetic sanitized derivative, not original.'}
        self.write(f'evidence/derivatives/{EID}/manifest.json', json.dumps(manifest).encode())
        self.install(value)
        return value, manifest

    def public(self):
        value = certificate('PUBLIC_OPEN')
        base = f'evidence/public/{EID}'
        raw, transcript, description = b'Synthetic raw.\n', b'Synthetic transcript.\n', b'Synthetic description.\n'
        for name, payload in [('original.txt', raw), ('transcript.verbatim.md', transcript), ('description.md', description)]:
            self.write(f'{base}/{name}', payload)
        value['custody'].update(raw_custody='huey_public', public_raw_path=f'{base}/original.txt')
        value['integrity'] = {'mode': 'public_sha256', 'raw_sha256': sha(raw), 'raw_bytes': len(raw),
                              'public_commitment': None, 'commitment_scheme': None}
        value['public_exposure_basis'] = 'NO_PUBLIC_PRECEDENT'
        value['transcription'].update(public=True, path=f'{base}/transcript.verbatim.md', sha256_or_commitment=sha(transcript))
        value['description'].update(public=True, path=f'{base}/description.md', status='machine_described_unreviewed')
        self.install(value)
        return value

    def test_empty_index_is_valid_and_claims_no_evidence_absence(self):
        result = checker.verify(self.root)
        self.assertEqual(result['certificates'], 0)
        self.assertIn('not source authentication', result['limits'])
        self.assertEqual(result['result'], 'PASS')

    def test_private_certificate_only_uses_no_private_object(self):
        self.install()
        original = checker.PublicTree.read
        opened = []
        def read(tree, path):
            opened.append(path)
            return original(tree, path)
        with patch.object(checker.PublicTree, 'read', read):
            result = checker.verify(self.root)
        self.assertEqual(result['index_rows'], 1)
        self.assertEqual(opened, ['planning/evidence-intake/certificate.schema.json',
                                  'planning/evidence-intake/private-manifest.schema.json', 'evidence/index.tsv', CERT])

    def test_public_raw_transcript_and_description(self):
        self.public()
        self.assertEqual(checker.verify(self.root)['certificates'], 1)

    def test_sanitized_derivative_and_transcript_match_manifest(self):
        self.derivative()
        self.assertEqual(checker.verify(self.root)['certificates'], 1)

    def test_sanitized_text_without_public_transcript(self):
        self.derivative(transcript=False)
        self.assertEqual(checker.verify(self.root)['certificates'], 1)

    def test_all_relationships_and_repeated_targets_remain_distinct(self):
        value = certificate()
        types = ['supports', 'contradicts', 'limits', 'context', 'duplicate', 'same_source_family',
                 'supersedes', 'provenance_only', 'unresolved']
        value['relationships'] = [dict(value['relationships'][0], relationship=kind) for kind in types]
        self.install(value)
        self.assertEqual(checker.verify(self.root)['certificates'], 1)
        self.assertEqual(row_for(value)['related_issues'].count('claim:synthetic'), len(types))

    def test_review_flags_are_metadata_not_authenticated_approval(self):
        value = certificate()
        value['review'].update(source_authenticated=True, human='Synthetic attributed reviewer metadata')
        self.install(value)
        result = checker.verify(self.root)
        self.assertIn('disclosure permission', result['limits'])
        self.assertIn('not source authentication', result['limits'])

    def test_schema_rejects_missing_unknown_malformed_and_invalid_formats(self):
        mutations = [lambda c: c.pop('limits'), lambda c: c.update(approval=True),
                     lambda c: c['review'].update(source_authenticated='yes'),
                     lambda c: c.update(intake_date_utc='not-a-date'),
                     lambda c: c.update(certificate_version=0),
                     lambda c: c['relationships'][0].update(relationship='proves'),
                     lambda c: c['integrity'].update(raw_salt_hex=SENTINEL),
                     lambda c: c.update(private_repository_name=SENTINEL)]
        for mutate in mutations:
            with self.subTest(mutation=mutations.index(mutate)):
                value = certificate(); mutate(value)
                self.install(value, row=row_for(certificate()))
                self.rejects('certificate-schema')

    def test_classification_cannot_select_incompatible_custody(self):
        value = certificate('PUBLIC_OPEN')
        value['public_exposure_basis'] = 'NO_PUBLIC_PRECEDENT'
        self.install(value)
        self.rejects('class-custody')

    def test_private_raw_path_rejected_before_target_read(self):
        value = certificate()
        value['custody']['public_raw_path'] = f'/tmp/{SENTINEL}'
        self.install(value)
        self.rejects('private-raw-disclosure')

    def test_private_raw_hash_and_size_cannot_be_exposed(self):
        for field, payload in [('raw_sha256', 'f' * 64), ('raw_bytes', 200)]:
            with self.subTest(field=field):
                value = certificate(); value['integrity'][field] = payload
                self.install(value)
                self.rejects()

    def test_private_mode_requires_real_shaped_commitment(self):
        for field in ['public_commitment', 'commitment_scheme']:
            value = certificate(); value['integrity'].pop(field)
            self.install(value)
            self.rejects('private-commitment')

    def test_withheld_transcript_and_description_cannot_name_private_paths(self):
        for field in ['transcription', 'description']:
            value = certificate(); value[field]['path'] = f'/tmp/{SENTINEL}'
            self.install(value)
            self.rejects(f'withheld-{field}-path')

    def test_withheld_private_transcript_cannot_publish_untyped_fingerprint(self):
        value = certificate()
        value['transcription']['sha256_or_commitment'] = 'f' * 64
        self.install(value)
        self.rejects('withheld-transcription-fingerprint')

    def test_active_export_requires_recorded_disclosure_review_without_authenticating_it(self):
        value = certificate()
        value['review']['public_disclosure_reviewed'] = False
        self.install(value)
        self.rejects('active-disclosure-review-record')
        value['status'] = 'blocked'
        self.install(value)
        self.assertEqual(checker.verify(self.root)['certificates'], 1)

    def test_private_sensitive_cannot_publish_derivative(self):
        value, _ = self.derivative()
        value['classification'] = 'PRIVATE_SENSITIVE'
        self.install(value)
        self.rejects('sensitive-derivative')

    def test_same_facts_public_does_not_establish_already_disclosed_object(self):
        value = self.public()
        value.update(classification='PUBLIC_ALREADY_DISCLOSED', public_exposure_basis='SAME_FACTS_PUBLIC')
        self.install(value)
        self.rejects('exposure-basis')

    def test_public_raw_byte_hash_and_size_are_checked(self):
        value = self.public()
        value['integrity']['raw_bytes'] += 1
        self.install(value); self.rejects('raw-size')
        value['integrity']['raw_bytes'] -= 1
        value['integrity']['raw_sha256'] = '0' * 64
        self.install(value); self.rejects('raw-hash')

    def test_public_transcript_hash_is_checked(self):
        value = self.public()
        value['transcription']['sha256_or_commitment'] = '0' * 64
        self.install(value); self.rejects('transcript-hash')

    def test_derivative_hash_size_coverage_and_schema_are_checked(self):
        value, original = self.derivative(transcript=False)
        mutations = [lambda m: m['derivatives'][0].update(sha256='0' * 64),
                     lambda m: m['derivatives'][0].update(bytes=0),
                     lambda m: m['derivatives'][0].update(path=f'evidence/derivatives/{OTHER}/public-v1.txt'),
                     lambda m: m['derivatives'].append(copy.deepcopy(m['derivatives'][0])),
                     lambda m: m.update(evidence_id=OTHER), lambda m: m.update(salt=SENTINEL)]
        for mutate in mutations:
            manifest = copy.deepcopy(original); mutate(manifest)
            self.write(f'evidence/derivatives/{EID}/manifest.json', json.dumps(manifest).encode())
            self.rejects()
        (self.root / f'evidence/derivatives/{EID}/manifest.json').unlink()
        self.rejects('missing-derivative-manifest')

    def test_derivative_path_cannot_escape_or_cross_evidence_identity(self):
        for path in [f'../{SENTINEL}', f'/tmp/{SENTINEL}', f'evidence/derivatives/{EID}/../{SENTINEL}',
                     f'evidence/derivatives/{OTHER}/public.txt', f'evidence/derivatives/{EID}\\{SENTINEL}']:
            value = certificate('PRIVATE_RAW_PUBLIC_DERIVATIVE')
            value['custody']['public_derivative_paths'] = [path]
            self.install(value); self.rejects()

    def test_duplicate_derivative_paths_are_not_collapsed(self):
        value, _ = self.derivative()
        value['custody']['public_derivative_paths'] *= 2
        self.install(value); self.rejects('duplicate-derivative')

    def test_strict_index_header_row_width_and_duplicates(self):
        value = self.install()
        canonical = (self.root / 'evidence/index.tsv').read_bytes()
        for raw in [b'', b'wrong\n', canonical.replace(b'evidence_id', b'certificate', 1),
                    canonical.rstrip(b'\n'), canonical + b'\n', canonical + b'too\tfew\n',
                    canonical.replace(b'\n', b'\r\n'), canonical.replace(b'active\n', b'active\textra\n')]:
            self.write('evidence/index.tsv', raw); self.rejects()
        self.index([row_for(value), row_for(value)]); self.rejects('index-identity')

    def test_all_index_metadata_must_match_certificate(self):
        value = self.install()
        for field in [key for key in checker.HEADER if key not in {'evidence_id', 'certificate'}]:
            row = row_for(value); row[field] += '-wrong'
            self.index([row]); self.rejects('index-certificate-mismatch')

    def test_certificate_reference_cannot_traverse_or_select_other_file(self):
        value = self.install()
        for path in [f'../{SENTINEL}', f'/tmp/{SENTINEL}', 'evidence/README.md',
                     f'evidence/certificates/{OTHER}.json']:
            row = row_for(value); row['certificate'] = path
            self.index([row]); self.rejects('index-certificate-path')

    def test_missing_or_unindexed_certificates_reject(self):
        value = self.install()
        (self.root / CERT).unlink(); self.rejects('missing-certificate')
        self.install(value)
        self.write(f'evidence/certificates/{OTHER}.json', json.dumps(certificate()).encode())
        self.rejects('certificate-coverage')

    def test_unreferenced_payload_is_not_silently_admitted(self):
        self.install()
        self.write(f'evidence/public/{EID}/unreferenced.txt', SENTINEL.encode())
        self.rejects('unreferenced-public-file')

    def test_duplicate_json_keys_and_nonfinite_numbers_reject_without_echo(self):
        self.install()
        for raw in [f'{{"x":"{SENTINEL}","x":2}}'.encode(), b'{"x":NaN}', b'not JSON', b'\xff']:
            self.write(CERT, raw); self.rejects()

    def test_symlink_file_and_directory_are_rejected_without_target_read(self):
        value = self.public()
        raw = self.root / value['custody']['public_raw_path']
        outside = self.root.parent / f'{self.root.name}-synthetic-outside'
        outside.write_text(SENTINEL)
        self.addCleanup(lambda: outside.unlink(missing_ok=True))
        raw.unlink(); raw.symlink_to(outside)
        self.rejects('symlink-path')
        raw.unlink(); raw.write_bytes(b'Synthetic raw.\n')
        cert = self.root / CERT
        saved = cert.read_bytes(); cert.unlink()
        cert.symlink_to(outside)
        self.rejects('symlink-path')
        cert.unlink(); cert.write_bytes(saved)
        folder = self.root / 'evidence/derivatives'
        folder.symlink_to(outside.parent, target_is_directory=True)
        self.rejects('symlink-path')

    def test_final_read_rejects_symlink_substituted_after_enumeration(self):
        value = self.public()
        raw = self.root / value['custody']['public_raw_path']
        original = checker.PublicTree.files
        def files(tree):
            result = original(tree)
            raw.unlink(); raw.symlink_to(self.root / 'evidence/README.md')
            return result
        with patch.object(checker.PublicTree, 'files', files):
            self.rejects('unreadable-or-invalid-public-input')

    @unittest.skipUnless(hasattr(os, 'mkfifo'), 'FIFO creation unavailable')
    def test_nonregular_payload_is_rejected_without_blocking(self):
        self.install()
        path = self.root / 'evidence/fifo'
        os.mkfifo(path)
        self.rejects('nonregular-path')

    def test_schema_file_symlink_rejects(self):
        path = self.root / 'planning/evidence-intake/certificate.schema.json'
        path.unlink(); path.symlink_to(PROTOCOL / 'certificate.schema.json')
        self.rejects('unreadable-or-invalid-public-input')

    def test_private_manifest_schema_validates_synthetic_records_only(self):
        schema = json.loads((PROTOCOL / 'private-manifest.schema.json').read_text())
        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        Draft202012Validator.check_schema(schema)
        value = {'schema_version': 1, 'evidence_id': EID, 'classification': 'PRIVATE_SENSITIVE',
                 'original': {'filename': 'synthetic.txt', 'mime_type': 'text/plain', 'bytes': 3,
                              'sha256': 'a' * 64, 'intake_date_utc': '2026-09-24T00:00:00Z', 'acquisition_channel': 'synthetic fixture'},
                 'custody': {'repository': 'synthetic-placeholder', 'path': 'synthetic-placeholder', 'repository_verified_private': True},
                 'sensitivity': {'triggers': ['synthetic'], 'public_exposure_basis': 'UNKNOWN',
                                 'analysis': 'Synthetic only', 'existence_safe_to_disclose': False},
                 'transcription': {'verbatim_path': 'synthetic.txt', 'verbatim_sha256': 'b' * 64, 'status': 'synthetic'},
                 'description': {'full_path': 'synthetic.md', 'full_sha256': 'c' * 64},
                 'commitments': {'domain_separator': 'HUEY-EVIDENCE-COMMIT-v1', 'raw_salt_hex': 'd' * 64, 'raw_public_commitment': 'e' * 64},
                 'relationships': [], 'history': []}
        self.assertTrue(validator.is_valid(value))
        for mutate in [lambda c: c['custody'].update(repository_verified_private=False),
                       lambda c: c['original'].update(intake_date_utc='not-a-time'),
                       lambda c: c['original'].update(sha256='not-a-hash'),
                       lambda c: c['commitments'].update(raw_salt_hex='short'),
                       lambda c: c.update(unknown=True)]:
            changed = copy.deepcopy(value); mutate(changed)
            self.assertFalse(validator.is_valid(changed))


if __name__ == '__main__':
    unittest.main()
