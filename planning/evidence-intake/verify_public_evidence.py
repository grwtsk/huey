#!/usr/bin/env python3
"""Read-only structural checks for the public #335 evidence export contract.

No source authentication, private-vault access, disclosure decision or intake
execution is performed. Diagnostics contain fixed reasons, never input values.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[2]
HEADER = (
    'evidence_id', 'classification', 'public_title', 'evidence_type', 'raw_custody',
    'certificate', 'public_raw_or_derivative', 'transcription_public',
    'review_state', 'related_issues', 'status',
)
ID = re.compile(r'HUEY-EV-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\Z')
SHA256 = re.compile(r'[0-9a-f]{64}\Z')
PUBLIC = {'PUBLIC_OPEN', 'PUBLIC_ALREADY_DISCLOSED'}
PRIVATE = {'PRIVATE_RAW_PUBLIC_DERIVATIVE', 'PRIVATE_SENSITIVE'}
LIMITS = ('Structure, declared public-byte hashes and index consistency only; '
          'not source authentication, truth, private commitment verification, '
          'transcription fidelity, disclosure permission or editorial acceptance.')
DERIVATIVE_SCHEMA = {
    '$schema': 'https://json-schema.org/draft/2020-12/schema',
    'type': 'object', 'additionalProperties': False,
    'required': ['schema_version', 'evidence_id', 'derivatives', 'limits'],
    'properties': {
        'schema_version': {'const': 1}, 'evidence_id': {'type': 'string'},
        'derivatives': {'type': 'array', 'minItems': 1, 'items': {
            'type': 'object', 'additionalProperties': False,
            'required': ['path', 'sha256', 'bytes'], 'properties': {
                'path': {'type': 'string'},
                'sha256': {'type': 'string', 'pattern': '^[0-9a-f]{64}$'},
                'bytes': {'type': 'integer', 'minimum': 0},
            }}},
        'limits': {'type': 'string', 'minLength': 1},
    },
}


class EvidenceCheckError(ValueError):
    """A reason-only error safe for a public check log."""


def require(condition, reason):
    if not condition:
        raise EvidenceCheckError(reason)


def path_parts(path):
    require(isinstance(path, str) and path != '', 'unsafe-path')
    parts = path.split('/')
    require(all(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', part)
                and part not in {'.', '..'} for part in parts), 'unsafe-path')
    return parts


class PublicTree:
    """Open descendants relative to an already selected root, never symlinks.

    O_NOFOLLOW applies to each directory and final file. Public file paths are
    never resolved via Path.resolve(), and regular-file status is checked before
    reading. The caller chooses the trusted checkout root, not a certificate.
    """
    def __init__(self, root):
        self.fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)

    def close(self):
        os.close(self.fd)

    def open(self, path, directory=False):
        parts = path_parts(path)
        fd = os.dup(self.fd)
        try:
            for index, part in enumerate(parts):
                flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
                if index < len(parts) - 1 or directory:
                    flags |= os.O_DIRECTORY
                next_fd = os.open(part, flags, dir_fd=fd)
                os.close(fd)
                fd = next_fd
            mode = os.fstat(fd).st_mode
            require(stat.S_ISDIR(mode) if directory else stat.S_ISREG(mode), 'nonregular-path')
            return fd
        except BaseException:
            os.close(fd)
            raise

    def read(self, path):
        fd = self.open(path)
        with os.fdopen(fd, 'rb') as stream:
            return stream.read()

    def files(self):
        """Enumerate the public area without following links or opening payloads."""
        directory = self.open('evidence', directory=True)
        result = set()
        def walk(fd, prefix):
            for name in os.listdir(fd):
                path = f'{prefix}/{name}'
                path_parts(path)
                mode = os.stat(name, dir_fd=fd, follow_symlinks=False).st_mode
                require(not stat.S_ISLNK(mode), 'symlink-path')
                if stat.S_ISDIR(mode):
                    child = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                    try:
                        walk(child, path)
                    finally:
                        os.close(child)
                else:
                    require(stat.S_ISREG(mode), 'nonregular-path')
                    result.add(path)
        try:
            walk(directory, 'evidence')
        finally:
            os.close(directory)
        return result


def json_data(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'duplicate-json-key')
            result[key] = value
        return result
    def constant(_value):
        raise EvidenceCheckError('nonfinite-json')
    return json.loads(raw.decode('utf-8'), object_pairs_hook=pairs, parse_constant=constant)


def schema_validator(tree, name):
    schema = json_data(tree.read(f'planning/evidence-intake/{name}.schema.json'))
    # Imported draft contracts contain no external references. Never resolve
    # certificate-controlled schemas or make a network request during checking.
    Draft202012Validator.check_schema(schema)
    def refs(value):
        if isinstance(value, dict):
            require('$ref' not in value and '$dynamicRef' not in value, 'schema-reference')
            for child in value.values():
                refs(child)
        elif isinstance(value, list):
            for child in value:
                refs(child)
    refs(schema)
    return Draft202012Validator(schema, format_checker=FormatChecker())


def validate_schema(validator, value, reason):
    require(validator.is_valid(value), reason)


def index_rows(raw):
    text = raw.decode('utf-8')
    require(text.endswith('\n') and '\r' not in text and '\x00' not in text, 'index-format')
    lines = text[:-1].split('\n')
    require(tuple(lines[0].split('\t')) == HEADER, 'index-header')
    rows = []
    for line in lines[1:]:
        fields = line.split('\t')
        require(len(fields) == len(HEADER), 'index-row-width')
        require(all(not any(ord(c) < 32 or ord(c) == 127 for c in field) for field in fields), 'index-control')
        rows.append(dict(zip(HEADER, fields)))
    return rows


def _verify(root):
    tree = PublicTree(root)
    try:
        certificate_validator = schema_validator(tree, 'certificate')
        schema_validator(tree, 'private-manifest')  # Schema only; never a private instance.
        derivative_validator = Draft202012Validator(DERIVATIVE_SCHEMA)
        rows = index_rows(tree.read('evidence/index.tsv'))
        actual = tree.files()
        expected = {'evidence/README.md', 'evidence/index.tsv'}
        require(expected <= actual, 'evidence-layout')
        seen = set()
        certificates = []
        # Validate every certificate and path before opening referenced payloads.
        for row in rows:
            eid = row['evidence_id']
            require(ID.fullmatch(eid) is not None and eid not in seen, 'index-identity')
            seen.add(eid)
            cert_path = f'evidence/certificates/{eid}.json'
            require(row['certificate'] == cert_path, 'index-certificate-path')
            require(cert_path in actual, 'missing-certificate')
            expected.add(cert_path)
            certificate = json_data(tree.read(cert_path))
            validate_schema(certificate_validator, certificate, 'certificate-schema')
            require(certificate['evidence_id'] == eid, 'certificate-identity')
            cls = certificate['classification']
            custody, integrity = certificate['custody'], certificate['integrity']
            private = cls in PRIVATE
            require(cls in PUBLIC | PRIVATE, 'classification')
            require(custody['raw_custody'] == ('private_repository' if private else 'huey_public'), 'class-custody')
            derivative_paths = custody['public_derivative_paths']
            require(len(set(derivative_paths)) == len(derivative_paths), 'duplicate-derivative')
            def artifact(path):
                path_parts(path)
                require(any(path.startswith(f'evidence/{area}/{eid}/') for area in ('public', 'derivatives')), 'artifact-scope')
                require(path in actual, 'missing-artifact')
                expected.add(path)
            for path in derivative_paths:
                artifact(path)
            if private:
                require(custody['public_raw_path'] is None and integrity.get('raw_sha256') is None
                        and integrity.get('raw_bytes') is None, 'private-raw-disclosure')
                require(integrity['mode'] == 'private_salted_commitment'
                        and integrity.get('commitment_scheme') == 'sha256-salted-v1'
                        and isinstance(integrity.get('public_commitment'), str)
                        and SHA256.fullmatch(integrity['public_commitment']), 'private-commitment')
            else:
                artifact(custody['public_raw_path'])
                require(custody['public_raw_path'].startswith(f'evidence/public/{eid}/'), 'raw-scope')
                require(integrity['mode'] == 'public_sha256'
                        and isinstance(integrity.get('raw_sha256'), str)
                        and SHA256.fullmatch(integrity['raw_sha256'])
                        and integrity.get('commitment_scheme') is None
                        and integrity.get('public_commitment') is None, 'public-integrity')
                if cls == 'PUBLIC_ALREADY_DISCLOSED':
                    require(certificate['public_exposure_basis'] in {'EXACT_OBJECT_PUBLIC', 'COMPLETE_CONTENT_PUBLIC'}, 'exposure-basis')
            transcription, description = certificate['transcription'], certificate['description']
            if transcription['public']:
                require(isinstance(transcription['path'], str)
                        and isinstance(transcription['sha256_or_commitment'], str)
                        and SHA256.fullmatch(transcription['sha256_or_commitment']), 'public-transcription')
                artifact(transcription['path'])
                require(transcription['status'] != 'not_applicable', 'public-transcription')
                if private:
                    require(transcription['path'] in derivative_paths, 'private-transcript-derivative')
            else:
                require(transcription['path'] is None, 'withheld-transcription-path')
                if private:
                    require(transcription['sha256_or_commitment'] is None, 'withheld-transcription-fingerprint')
            if description['public']:
                artifact(description['path'])
                require(description['status'] != 'withheld', 'public-description')
                if private:
                    require(description['path'] in derivative_paths, 'private-description-derivative')
            else:
                require(description['path'] is None and description['status'] == 'withheld', 'withheld-description-path')
            if cls == 'PRIVATE_SENSITIVE':
                require(not derivative_paths and not transcription['public'] and not description['public'], 'sensitive-derivative')
            for relation in certificate['relationships']:
                require(all(relation[field].strip() for field in ('target', 'locator', 'contribution', 'does_not_establish')), 'empty-relationship')
            require(all(limit.strip() for limit in certificate['limits']), 'empty-limit')
            require(certificate['review']['machine'].strip(), 'empty-review')
            require(certificate['status'] != 'active' or certificate['review']['public_disclosure_reviewed'] is True,
                    'active-disclosure-review-record')
            human = certificate['review']['human']
            require(human is None or human.strip(), 'empty-review')
            expected_row = {
                'evidence_id': eid, 'classification': cls,
                'public_title': certificate['public_title'], 'evidence_type': certificate['evidence_type'],
                'raw_custody': custody['raw_custody'], 'certificate': cert_path,
                'public_raw_or_derivative': ';'.join(derivative_paths) if private else custody['public_raw_path'],
                'transcription_public': str(transcription['public']).lower(),
                'review_state': 'machine_checked;human_pending' if human is None else 'machine_checked;human_reviewed',
                'related_issues': ';'.join(item['target'] for item in certificate['relationships']),
                'status': certificate['status'],
            }
            require(row == expected_row, 'index-certificate-mismatch')
            certificates.append(certificate)
        # Every indexed certificate is present and every certificate is indexed.
        require({path for path in actual if path.startswith('evidence/certificates/')}
                == {row['certificate'] for row in rows}, 'certificate-coverage')
        for certificate in certificates:
            eid, custody, integrity = certificate['evidence_id'], certificate['custody'], certificate['integrity']
            if custody['raw_custody'] == 'huey_public':
                raw = tree.read(custody['public_raw_path'])
                require(hashlib.sha256(raw).hexdigest() == integrity['raw_sha256'], 'raw-hash')
                require(integrity.get('raw_bytes') is None or integrity['raw_bytes'] == len(raw), 'raw-size')
            transcription = certificate['transcription']
            if transcription['public']:
                require(hashlib.sha256(tree.read(transcription['path'])).hexdigest()
                        == transcription['sha256_or_commitment'], 'transcript-hash')
            if custody['public_derivative_paths']:
                manifest_path = f'evidence/derivatives/{eid}/manifest.json'
                require(manifest_path in actual, 'missing-derivative-manifest')
                expected.add(manifest_path)
                manifest = json_data(tree.read(manifest_path))
                validate_schema(derivative_validator, manifest, 'derivative-schema')
                require(manifest['evidence_id'] == eid and [item['path'] for item in manifest['derivatives']]
                        == custody['public_derivative_paths'], 'derivative-coverage')
                for derivative in manifest['derivatives']:
                    raw = tree.read(derivative['path'])
                    require(len(raw) == derivative['bytes'] and hashlib.sha256(raw).hexdigest()
                            == derivative['sha256'], 'derivative-hash')
        require(actual == expected, 'unreferenced-public-file')
        return {'result': 'PASS', 'index_rows': len(rows), 'certificates': len(certificates), 'limits': LIMITS}
    finally:
        tree.close()


def verify(root=ROOT):
    """Validate a selected public checkout; errors never include path or source data."""
    try:
        return _verify(root)
    except EvidenceCheckError:
        raise
    except Exception:
        raise EvidenceCheckError('unreadable-or-invalid-public-input') from None


def main():
    try:
        require(len(sys.argv) == 1, 'usage-no-arguments')
        print(json.dumps(verify(), indent=2))
        return 0
    except EvidenceCheckError as error:
        print(f'FAIL: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
