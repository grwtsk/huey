"""Pinned care-law recovery boundaries; no fresh source research or adjudication."""
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
spec = importlib.util.spec_from_file_location('soc_care_law', ROOT / 'scripts/soc_care_law.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
SENTINEL = 'SYNTHETIC_PRIVATE_SENTINEL'


class SocCareLawTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.paths = [checker.MANIFEST, checker.PREDECESSOR['path'], *checker.EXPECTED]
        for relative in self.paths:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / relative, target)
        self.manifest = json.loads((self.root / checker.MANIFEST).read_text())
        self.raw = {p: (self.root / p).read_bytes() for p in checker.EXPECTED}
        self.data = {p: json.loads(raw) for p, raw in self.raw.items() if p.endswith('.json')}

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

    def test_copy_and_historical_counts_are_distinct_from_findings(self):
        result = checker.verify(self.root)
        expected = {'files': 8, 'exact_copies': 8, 'prose_units': 256, 'declared_sources': 41,
                    'prose_source_references': 39, 'review_rows': 34, 'candidate_section_joins': 17,
                    'historical_edited_units': 10, 'historical_added_units': 105,
                    'historical_detailed_review_units': 115, 'retained_units_with_deeper_review_open': 141,
                    'inherited_negative_cases': 21, 'exports_written': 0, 'original_git_objects_checked': 0}
        for key, value in expected.items():
            self.assertEqual(result[key], value)
        self.assertEqual(result['historical_inspection_states'], checker.INSPECTIONS)
        self.assertIn('no source-location access', result['limits'])
        self.assertIn('not independent events or verified findings', result['limits'])

    def test_missing_duplicate_unselected_and_unknown_manifest_fields_reject(self):
        baseline = copy.deepcopy(self.manifest)
        for mutate in [lambda d: d['files'].pop(),
                       lambda d: d['files'].__setitem__(-1, copy.deepcopy(d['files'][0])),
                       lambda d: d['files'][0].update(path='../' + SENTINEL),
                       lambda d: d.update(approved=True)]:
            self.manifest = copy.deepcopy(baseline)
            mutate(self.manifest)
            self.save()
            self.rejects()

    def test_source_basis_and_scope_pins_cannot_drift(self):
        baseline = copy.deepcopy(self.manifest)
        for mutate in [lambda d: d.update(basisRevision='0' * 40),
                       lambda d: d.update(sourceCommit='0' * 40),
                       lambda d: d['scopeRefs'].append('https://example.invalid/' + SENTINEL)]:
            self.manifest = copy.deepcopy(baseline)
            mutate(self.manifest)
            self.save()
            self.rejects()

    def test_findings_adoption_research_or_authority_flags_reject(self):
        baseline = copy.deepcopy(self.manifest)
        for key, expected in checker.FLAGS.items():
            self.manifest = copy.deepcopy(baseline)
            self.manifest[key] = not expected
            self.save()
            self.rejects('completion-or-authority-claim')

    def test_source_review_prose_and_verifier_cannot_change_or_rebind(self):
        for name in ['sources.json', 'review.json', 'revision.md', 'verify.py']:
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

    def test_historical_incident_receipt_cannot_be_rewritten(self):
        path = self.root / checker.PREDECESSOR['path']
        value = json.loads(path.read_text())
        value['navigationChanges'][0]['stagedBlob'] = 'a' * 40
        path.write_text(json.dumps(value))
        self.rejects('predecessor-byte-drift')

    def test_navigation_cannot_skip_predecessor_or_adapt_prose(self):
        baseline = copy.deepcopy(self.manifest)
        for field in ['sourceBlob', 'priorStagedBlob']:
            self.manifest = copy.deepcopy(baseline)
            self.manifest['navigationChanges'][0][field] = '0' * 40
            self.save()
            self.rejects('navigation-prior-pin')
        self.manifest = copy.deepcopy(baseline)
        self.manifest['navigationChanges'][0]['path'] = checker.REVIEW + 'revision.md'
        self.save()
        self.rejects('navigation-selection')

    def test_historical_navigation_receipt_cannot_be_rewritten(self):
        self.manifest['navigationChanges'][0]['stagedBlob'] = 'a' * 40
        self.save()
        self.rejects('historical-receipt-drift')

    def test_standalone_uses_historical_receipt_without_current_navigation(self):
        result = checker.verify(self.root)
        self.assertTrue(result['historical_navigation_receipt'])
        self.assertIn('for current navigation', result['limits'])
        self.assertFalse((self.root / checker.CORE_MANIFEST).exists())
        self.assertTrue(all(not (self.root / p).exists() for p in checker.NAVIGATION))

    def test_historical_dates_access_failures_and_adoption_limits_remain(self):
        changes = [
            lambda d: d[checker.REVIEW + 'sources.json'].update(review_date='2099-01-01'),
            lambda d: d[checker.REVIEW + 'sources.json']['sources'][13].update(inspection='read-this-pass'),
            lambda d: d[checker.REVIEW + 'sources.json']['sources'][39].update(inspection='read-this-pass'),
            lambda d: d[checker.REVIEW + 'review.json'].update(raw_sources_included=True),
            lambda d: d[checker.REVIEW + 'review.json'].update(external_contact_performed=True),
            lambda d: d[checker.REVIEW + 'review.json']['review_rows'][0].update(institutional_status='opened'),
            lambda d: d[checker.REVIEW + 'book-integration.json'].update(status='applied'),
            lambda d: d[checker.REVIEW + 'lineage.json']['checks'].update(prose_text_changes_on_repository_correction=1),
        ]
        for mutate in changes:
            data = copy.deepcopy(self.data)
            mutate(data)
            self.rejects(action=lambda: checker.validate_metadata(data))

    def test_recovery_functions_preserve_candidate_joins_and_source_limits(self):
        for name, mutate in [
            ('book-integration.json', lambda d: d['sections'].pop()),
            ('book-integration.json', lambda d: d['sections'][0].update(chapters=[16])),
            ('sources.json', lambda d: d['sources'][13].update(inspection='read-this-pass')),
            ('lineage.json', lambda d: d['pass_two_text_changes'].pop()),
        ]:
            data = copy.deepcopy(self.data)
            mutate(data[checker.REVIEW + name])
            self.rejects('inherited-recovery-check', lambda: checker.inspect_packet(self.raw, data))

    def test_no_unpinned_executable_is_loaded(self):
        raw = dict(self.raw)
        raw[checker.REVIEW + 'verify.py'] = b'raise RuntimeError("' + SENTINEL.encode() + b'")'
        self.rejects('verifier-byte-drift', lambda: checker.inspect_packet(raw, self.data))

    def test_missing_file_and_symlink_components_reject_before_execution(self):
        path = self.root / (checker.REVIEW + 'sources.json')
        original = path.read_bytes()
        path.unlink()
        self.rejects('unreadable-or-malformed-input')
        path.write_bytes(original)
        folder = self.root / checker.REVIEW
        moved = self.root / SENTINEL
        folder.rename(moved)
        folder.symlink_to(moved, target_is_directory=True)
        with patch.object(checker, 'inspect_packet') as inspect:
            self.rejects('unreadable-or-malformed-input')
            inspect.assert_not_called()

    def test_duplicate_nonfinite_and_malformed_json_do_not_echo_input(self):
        path = self.root / checker.MANIFEST
        for raw in [f'{{"x":"{SENTINEL}","x":2}}', '{"x":NaN}', '{']:
            path.write_text(raw)
            self.rejects()

    def test_history_is_local_only_and_missing_objects_fail(self):
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True, capture_output=True)
        self.rejects('git-input-unavailable', lambda: checker.verify(self.root, source_objects=True))

    def test_no_source_locators_external_repositories_or_exports_are_opened(self):
        # Fixture holds only eight packet files and two historical receipts.
        # The public/external/source-origin locators remain documentary strings.
        before = {p: (self.root / p).read_bytes() for p in self.paths}
        with patch.object(checker, 'read', wraps=checker.read) as read:
            checker.verify(self.root)
        self.assertEqual(set(call.args[1] for call in read.call_args_list), set(self.paths))
        self.assertEqual(before, {p: (self.root / p).read_bytes() for p in self.paths})
        self.assertEqual({p.relative_to(self.root).as_posix() for p in self.root.rglob('*') if p.is_file()},
                         set(self.paths))
        self.assertFalse(list(self.root.rglob('__pycache__')))

    def test_wrapper_offers_no_root_override_or_export_destination(self):
        for option in ['--root', '--output-dir']:
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/soc_care_law.py'),
                                     option, str(self.root / 'forbidden')], capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertFalse((self.root / 'forbidden').exists())


if __name__ == '__main__':
    unittest.main()
