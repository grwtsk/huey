"""Pinned registration and navigation tests; no source or findings certification."""
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('soc_incident', ROOT / 'scripts/soc_incident.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
SENTINEL = 'SYNTHETIC_PRIVATE_SENTINEL'


class SocIncidentTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.paths = [checker.MANIFEST, checker.CORE_MANIFEST, checker.PREDECESSOR['path'],
                      *checker.EXPECTED, *checker.NAVIGATION]
        for relative in self.paths:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / relative, target)
        self.manifest = json.loads((self.root / checker.MANIFEST).read_text())
        self.data = {p: json.loads((self.root / p).read_text())
                     for p in checker.EXPECTED if p.endswith('.json')}

    def save(self):
        (self.root / checker.MANIFEST).write_text(json.dumps(self.manifest, indent=2) + '\n')

    def rejects(self, reason=None, action=None):
        with self.assertRaises(checker.Invalid) as caught:
            (action or (lambda: checker.verify(self.root)))()
        message = str(caught.exception)
        self.assertRegex(message, r'^[a-z-]+$')
        self.assertNotIn(SENTINEL, message)
        self.assertNotIn(str(self.root), message)
        if reason:
            self.assertEqual(message, reason)

    def test_registration_counts_and_source_reference_counts_are_distinct(self):
        # No documentary originals or referenced prose are in this fixture.
        result = checker.verify(self.root)
        self.assertEqual(result['files'], 9)
        self.assertEqual(result['registered_entries'], 112)
        self.assertEqual(result['registration_classes'], {'R': 43, 'S': 40, 'Q': 14, 'C': 10, 'X': 5})
        self.assertEqual(result['declared_source_aliases'], 21)
        self.assertEqual(result['used_source_aliases'], 11)
        self.assertEqual(result['already_staged_source_references'], 15)
        self.assertEqual(result['descriptive_source_references'], 6)
        self.assertEqual(result['finding_status'], 'not-determined')
        self.assertEqual(result['new_collection_status'], 'planned-not-started')
        self.assertEqual(result['original_git_objects_checked'], 0)
        self.assertIn('no source-location access', result['limits'])

    def test_missing_duplicate_unselected_and_unknown_manifest_fields_reject(self):
        baseline = copy.deepcopy(self.manifest)
        for mutate in [lambda d: d['files'].pop(),
                       lambda d: d['files'].__setitem__(-1, copy.deepcopy(d['files'][0])),
                       lambda d: d['files'][0].update(path='sources/standard-of-care/raw/' + SENTINEL),
                       lambda d: d.update(approved=True)]:
            self.manifest = copy.deepcopy(baseline)
            mutate(self.manifest)
            self.save()
            self.rejects()

    def test_basis_source_and_scope_pins_cannot_drift(self):
        baseline = copy.deepcopy(self.manifest)
        for mutate in [lambda d: d.update(basisRevision='0' * 40),
                       lambda d: d.update(sourceCommit='0' * 40),
                       lambda d: d['scopeRefs'].append('https://example.invalid/' + SENTINEL)]:
            self.manifest = copy.deepcopy(baseline)
            mutate(self.manifest)
            self.save()
            self.rejects()

    def test_collection_findings_admission_or_authority_flags_reject(self):
        baseline = copy.deepcopy(self.manifest)
        for key, expected in checker.FLAGS.items():
            self.manifest = copy.deepcopy(baseline)
            self.manifest[key] = not expected
            self.save()
            self.rejects('completion-or-authority-claim')

    def test_register_source_locations_and_executable_bytes_cannot_be_rebound(self):
        for name in ['register.json', 'sources.json', 'verify.py']:
            path = checker.REVIEW + name
            target = self.root / path
            original = target.read_bytes()
            target.write_bytes(original + b' ')
            self.rejects('staged-byte-drift')
            row = next(row for row in self.manifest['files'] if row['path'] == path)
            previous = row['stagedBlob']
            row['sourceBlob'] = row['stagedBlob'] = checker.blob(target.read_bytes())
            self.save()
            self.rejects('exact-copy-pin')
            row['sourceBlob'] = row['stagedBlob'] = previous
            self.save()
            target.write_bytes(original)

    def test_predecessor_selection_is_fixed_before_read(self):
        baseline = copy.deepcopy(self.manifest)
        for key, value in [('path', '../' + SENTINEL), ('blob', '0' * 40)]:
            self.manifest = copy.deepcopy(baseline)
            self.manifest['predecessorManifest'][key] = value
            self.save()
            self.rejects('predecessor-pin')

    def test_historical_authority_receipt_cannot_be_rewritten(self):
        path = self.root / checker.PREDECESSOR['path']
        value = json.loads(path.read_text())
        value['navigationChanges'][0]['stagedBlob'] = 'a' * 40
        path.write_text(json.dumps(value))
        self.rejects('predecessor-byte-drift')

    def test_navigation_cannot_skip_predecessor_or_adapt_register(self):
        baseline = copy.deepcopy(self.manifest)
        for field in ['sourceBlob', 'priorStagedBlob']:
            self.manifest = copy.deepcopy(baseline)
            self.manifest['navigationChanges'][0][field] = '0' * 40
            self.save()
            self.rejects('navigation-prior-pin')
        self.manifest = copy.deepcopy(baseline)
        self.manifest['navigationChanges'][0]['path'] = checker.REVIEW + 'register.json'
        self.save()
        self.rejects('navigation-selection')

    def test_current_navigation_needs_exact_endpoint_and_core_agreement(self):
        row = self.manifest['navigationChanges'][0]
        path = self.root / row['path']
        original = path.read_bytes()
        path.write_bytes(original + b' ')
        self.rejects('navigation-byte-drift')
        path.write_bytes(original)
        core_path = self.root / checker.CORE_MANIFEST
        core = json.loads(core_path.read_text())
        next(r for r in core['files'] if r['path'] == row['path'])['stagedBlob'] = 'a' * 40
        core_path.write_text(json.dumps(core))
        self.rejects('navigation-core-pin')

    def test_historical_receipt_and_alias_membership_remain_incomplete(self):
        changes = [
            lambda d: d[checker.REVIEW + 'register.json'].update(finding_status='proven'),
            lambda d: d[checker.REVIEW + 'register.json'].update(all_incidents_enumerated=True),
            lambda d: d[checker.REVIEW + 'checks.json'].update(new_external_evidence_collection='received'),
            lambda d: d[checker.REVIEW + 'checks.json'].update(full_repository_suite='passed'),
            lambda d: d[checker.REVIEW + 'sources.json']['sources'].pop('JUL26'),
            lambda d: d[checker.REVIEW + 'register.json']['entries'][0].__setitem__(3, SENTINEL),
        ]
        for mutate in changes:
            data = copy.deepcopy(self.data)
            mutate(data)
            self.rejects(action=lambda: checker.validate_metadata(data))

    def test_missing_predecessor_and_symlink_components_reject_before_execution(self):
        path = self.root / checker.PREDECESSOR['path']
        original = path.read_bytes()
        path.unlink()
        self.rejects('unreadable-or-malformed-input')
        path.write_bytes(original)
        folder = self.root / checker.REVIEW
        moved = self.root / SENTINEL
        folder.rename(moved)
        folder.symlink_to(moved, target_is_directory=True)
        with patch.object(checker.subprocess, 'run') as run:
            self.rejects('unreadable-or-malformed-input')
            run.assert_not_called()

    def test_duplicate_and_nonfinite_json_do_not_echo_input(self):
        path = self.root / checker.MANIFEST
        for raw in [f'{{"x":"{SENTINEL}","x":2}}', '{"x":NaN}', '{']:
            path.write_text(raw)
            self.rejects()

    def test_history_is_local_only_and_missing_objects_fail(self):
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True, capture_output=True)
        self.rejects('git-input-unavailable', lambda: checker.verify(self.root, source_objects=True))

    def test_no_export_override_or_selected_byte_changes(self):
        before = {p: (self.root / p).read_bytes() for p in self.paths}
        checker.verify(self.root)
        self.assertEqual(before, {p: (self.root / p).read_bytes() for p in self.paths})
        self.assertFalse(list(self.root.rglob('__pycache__')))
        for option in ['--root', '--output-dir']:
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/soc_incident.py'),
                                     option, str(self.root / 'forbidden')], capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertFalse((self.root / 'forbidden').exists())


if __name__ == '__main__':
    unittest.main()
