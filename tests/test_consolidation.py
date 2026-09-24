"""Historical receipt fidelity; no test authenticates an account or accepts prose."""
from copy import deepcopy
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from scripts import consolidation as c


class ConsolidationTests(unittest.TestCase):
    def setUp(self):
        self.manifest = c.load(c.ROOT / c.MANIFEST)

    def reject(self, mutation, code):
        mutation(self.manifest)
        with self.assertRaisesRegex(c.Invalid, '^' + code + '$'):
            c.validate(self.manifest)

    def test_committed_receipts_exact_and_historical(self):
        result = c.validate(self.manifest)
        self.assertEqual(result['receipts'], 20)
        self.assertEqual(result['source_prs'], 18)
        self.assertEqual(result['original_git_objects_checked'], 0)
        self.assertTrue(result['historical_only'])
        self.assertTrue(result['semantic_review_required'])

    def test_missing_and_duplicate_receipts_rejected(self):
        self.reject(lambda m: m['records'].pop(), 'COVERAGE')
        self.setUp()
        self.reject(lambda m: m['records'].__setitem__(1, deepcopy(m['records'][0])), 'COVERAGE')

    def test_source_pins_cannot_change_with_matching_claimed_metadata(self):
        for field, value in [('pr', True), ('commit', 'a' * 40), ('blob', 'b' * 40)]:
            with self.subTest(field=field):
                self.setUp()
                self.reject(lambda m: m['records'][0].update({field: value}), 'SOURCE_PIN')

    def test_import_is_not_runtime_input_verification_or_acceptance(self):
        for field in ['manuscriptImported', 'claimVerificationPerformed',
                      'authorAcceptanceRecorded', 'runtimeInput']:
            with self.subTest(field=field):
                self.setUp()
                self.reject(lambda m: m.update({field: True}), 'HISTORICAL_SCOPE')
        self.setUp()
        self.reject(lambda m: m.update(historicalOnly=1), 'HISTORICAL_SCOPE')

    def test_unknown_payload_or_authority_fields_rejected(self):
        self.reject(lambda m: m.update(grant='PRIVATE_SENTINEL'), 'MANIFEST_FIELDS')
        self.setUp()
        self.reject(lambda m: m['records'][0].update(prose='PRIVATE_SENTINEL'), 'RECORD_FIELDS')

    def test_visible_supersession_cannot_be_removed(self):
        self.reject(lambda m: m.update(notice='Accepted as current instructions'), 'SUPERSESSION_NOTICE')
        self.setUp()
        self.reject(lambda m: m['records'][0].update(supersessionRefs=[]), 'SUPERSESSION_REFS')
        self.setUp()
        self.reject(lambda m: m['records'][0].update(disposition='accepted'), 'HISTORICAL_SCOPE')

    def test_issue_reference_inventory_is_exact_not_invented(self):
        self.reject(lambda m: m['records'][0]['issueRefs'].append(999999), 'ISSUE_REFS')

    def test_recorded_date_requires_real_timestamp_with_timezone(self):
        for value in ['2026-02-30T12:00:00+00:00', '2026-09-24', 'not a date']:
            with self.subTest(value=value):
                self.setUp()
                self.reject(lambda m: m['records'][0].update(recordedAt=value), 'RECORDED_DATE')

    def copy_receipts(self, root):
        for path in c.EXPECTED:
            destination = root / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(c.ROOT / path, destination)

    def test_changed_working_bytes_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.copy_receipts(root)
            (root / next(iter(c.EXPECTED))).write_text('Changed receipt.\n')
            with self.assertRaisesRegex(c.Invalid, '^RECEIPT_BYTES$'):
                c.validate(self.manifest, root)

    def test_receipts_cannot_become_editorial_source_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.copy_receipts(root)
            registry = root / 'planning/editorial-inventory/registry.json'
            registry.parent.mkdir(parents=True, exist_ok=True)
            registry.write_text(json.dumps({'sources': [{'path': next(iter(c.EXPECTED))}]}))
            with self.assertRaisesRegex(c.Invalid, '^RUNTIME_INPUT$'):
                c.validate(self.manifest, root)

    def test_loader_rejects_duplicate_keys_and_nonfinite_values(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'input.json'
            for payload in ['{"x":1,"x":2}', '{"x":NaN}']:
                path.write_text(payload)
                with self.assertRaises(c.Invalid):
                    c.load(path)

    def test_cli_read_only_and_does_not_echo_invalid_argument(self):
        paths = [c.ROOT / c.MANIFEST, *(c.ROOT / path for path in c.EXPECTED)]
        before = [path.read_bytes() for path in paths]
        result = subprocess.run([sys.executable, str(c.ROOT / 'scripts/consolidation.py')],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['receipts'], 20)
        self.assertEqual(before, [path.read_bytes() for path in paths])
        result = subprocess.run([sys.executable, str(c.ROOT / 'scripts/consolidation.py'),
                                 'PRIVATE_SENTINEL'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertNotIn('PRIVATE_SENTINEL', result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
