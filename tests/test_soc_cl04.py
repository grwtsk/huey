"""Public CL04 index and private-packet boundary regressions; no private inputs."""
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
spec = importlib.util.spec_from_file_location('soc_cl04', ROOT / 'scripts/soc_cl04.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
SENTINEL = 'SYNTHETIC_PRIVATE_SENTINEL'


class SocCl04Tests(unittest.TestCase):
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
        self.index = (self.root / (checker.REVIEW + 'integration-r04.tsv')).read_bytes()
        self.rows = [line.split('\t') for line in self.index.decode().splitlines()]

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

    def index_rejects(self, rows, reason=None):
        raw = ('\n'.join('\t'.join(row) for row in rows) + '\n').encode()
        self.rejects(reason, lambda: checker.inspect_index(raw))

    def test_public_index_counts_do_not_claim_private_reconciliation(self):
        result = checker.verify(self.root)
        expected = {'files': 3, 'exact_copies': 3, 'indexed_units': 117, 'indexed_edit_groups': 16,
                    'source_aliases': 12, 'source_alias_references': 228, 'carelaw_references': 103,
                    'distinct_carelaw_references': 62,
                    'units_without_carelaw_reference': 32, 'historical_negative_cases_rerun': 0,
                    'exports_written': 0, 'original_git_objects_checked': 0}
        for key, value in expected.items():
            self.assertEqual(result[key], value)
        self.assertEqual(result['historical_chapter_counts'], {'12': 54, '13': 63})
        self.assertIs(result['private_packet_checked'], False)
        self.assertIs(result['inherited_packet_verifier_executed'], False)
        self.assertIn('not independent events or verified claims', result['limits'])
        self.assertIn('no private-packet access', result['limits'])

    def test_schema_source_scope_and_basis_pins_cannot_drift(self):
        baseline = copy.deepcopy(self.manifest)
        for mutate in [lambda d: d.update(schema='huey.soc-cl04.v2'),
                       lambda d: d.update(basisRevision='0' * 40),
                       lambda d: d.update(sourceCommit='0' * 40),
                       lambda d: d.update(sourcePR=122.0),
                       lambda d: d['scopeRefs'].append('https://example.invalid/' + SENTINEL),
                       lambda d: d.update(authority=True)]:
            self.manifest = copy.deepcopy(baseline)
            mutate(self.manifest)
            self.save()
            self.rejects()

    def test_false_completion_authority_or_private_execution_flags_reject(self):
        baseline = copy.deepcopy(self.manifest)
        for key, expected in checker.FLAGS.items():
            self.manifest = copy.deepcopy(baseline)
            self.manifest[key] = not expected
            self.save()
            self.rejects('completion-or-authority-claim')

    def test_missing_duplicate_extra_or_unselected_files_reject(self):
        baseline = copy.deepcopy(self.manifest)
        for mutate in [lambda d: d['files'].pop(),
                       lambda d: d['files'].append(copy.deepcopy(d['files'][0])),
                       lambda d: d['files'].__setitem__(-1, copy.deepcopy(d['files'][0])),
                       lambda d: d['files'][0].update(path='../' + SENTINEL)]:
            self.manifest = copy.deepcopy(baseline)
            mutate(self.manifest)
            self.save()
            self.rejects()

    def test_all_three_archived_files_are_pinned_even_after_manifest_rebinding(self):
        for path in checker.EXPECTED:
            target = self.root / path
            original = target.read_bytes()
            target.write_bytes(original + SENTINEL.encode())
            self.rejects('staged-byte-drift')
            row = next(row for row in self.manifest['files'] if row['path'] == path)
            previous = row['stagedBlob']
            row['sourceBlob'] = row['stagedBlob'] = checker.blob(target.read_bytes())
            self.save()
            self.rejects('exact-copy-pin')
            row['sourceBlob'] = row['stagedBlob'] = previous
            self.save()
            target.write_bytes(original)

    def test_index_requires_seven_named_fields_and_explicit_nonempty_values(self):
        for rows in [self.rows[:-1], self.rows + [self.rows[-1]],
                     [['other'] + self.rows[0][1:]] + self.rows[1:]]:
            self.index_rejects(rows, 'index-shape')
        for mutate in [lambda row: row.pop(), lambda row: row.append(SENTINEL),
                       lambda row: row.__setitem__(6, '')]:
            rows = copy.deepcopy(self.rows)
            mutate(rows[1])
            self.index_rejects(rows, 'index-fields')

    def test_duplicate_out_of_order_or_renumbered_units_reject(self):
        for value in ['HUEY-CL04-U002', 'HUEY-CL04-U000', 'HUEY-CL04-U999', SENTINEL]:
            rows = copy.deepcopy(self.rows)
            rows[1][0] = value
            self.index_rejects(rows, 'index-unit-identities')
        rows = copy.deepcopy(self.rows)
        rows[1], rows[2] = rows[2], rows[1]
        self.index_rejects(rows, 'index-unit-identities')

    def test_edit_group_boundaries_types_and_owners_reject_drift(self):
        for field, value, reason in [(1, 'CL04-E02', 'index-edit-membership'),
                                    (1, SENTINEL, 'index-edit-membership'),
                                    (2, '13', 'index-chapter-membership'),
                                    (2, SENTINEL, 'index-chapter-membership'),
                                    (3, 'argument', 'index-type-membership'),
                                    (3, SENTINEL, 'index-type-membership'),
                                    (4, '178', 'index-owner-membership'),
                                    (4, '999', 'index-owner-membership')]:
            rows = copy.deepcopy(self.rows)
            rows[1][field] = value
            self.index_rejects(rows, reason)

    def test_chapter_boundary_cannot_move_while_totals_stay_equal(self):
        rows = copy.deepcopy(self.rows)
        rows[54][2], rows[55][2] = rows[55][2], rows[54][2]
        self.index_rejects(rows, 'index-chapter-membership')

    def test_mapping_changes_cannot_hide_behind_unchanged_global_counts(self):
        rows = copy.deepcopy(self.rows)
        rows[1][6], rows[2][6] = rows[2][6], rows[1][6]
        raw = ('\n'.join('\t'.join(row) for row in rows) + '\n').encode()
        # A reference permutation can preserve memberships; exact copy pins remain required.
        checker.inspect_index(raw)
        (self.root / (checker.REVIEW + 'integration-r04.tsv')).write_bytes(raw)
        self.rejects('staged-byte-drift')

    def test_aliases_are_known_unique_references_never_paths(self):
        for value in ['A,A', '-', 'A,', '../' + SENTINEL, 'https://example.invalid/' + SENTINEL]:
            rows = copy.deepcopy(self.rows)
            rows[1][5] = value
            self.index_rejects(rows, 'index-source-membership')
        rows = copy.deepcopy(self.rows)
        for row in rows[1:]:
            row[5] = row[5].replace('R01', 'T')
        self.index_rejects(rows, 'index-source-coverage')

    def test_prior_corpus_reference_range_duplicates_and_selection_reject_drift(self):
        for value in ['C000', 'C257', 'C14', 'C014,C014', '-,C014', SENTINEL]:
            rows = copy.deepcopy(self.rows)
            rows[1][6] = value
            self.index_rejects(rows, 'index-carelaw-membership')
        for value in ['C001,C128', '-', 'C127,C128,C001']:
            rows = copy.deepcopy(self.rows)
            rows[1][6] = value
            self.index_rejects(rows, 'index-carelaw-coverage')

    def test_malformed_index_diagnostics_never_echo_bytes(self):
        self.rejects('index-encoding', lambda: checker.inspect_index(SENTINEL.encode() + b'\xff'))
        self.rejects('index-shape', lambda: checker.inspect_index(SENTINEL.encode()))

    def test_predecessor_is_fixed_and_historical_receipt_cannot_be_rewritten(self):
        baseline = copy.deepcopy(self.manifest)
        for key, value in [('path', '../' + SENTINEL), ('blob', '0' * 40)]:
            self.manifest = copy.deepcopy(baseline)
            self.manifest['predecessorManifest'][key] = value
            self.save()
            self.rejects('predecessor-pin')
        self.manifest = baseline
        self.save()
        path = self.root / checker.PREDECESSOR['path']
        value = json.loads(path.read_text())
        value['navigationChanges'][0]['stagedBlob'] = 'a' * 40
        path.write_text(json.dumps(value))
        self.rejects('predecessor-byte-drift')

    def test_navigation_cannot_skip_predecessor_or_adapt_private_packet(self):
        baseline = copy.deepcopy(self.manifest)
        for field in ['sourceBlob', 'priorStagedBlob']:
            self.manifest = copy.deepcopy(baseline)
            self.manifest['navigationChanges'][0][field] = '0' * 40
            self.save()
            self.rejects('navigation-prior-pin')
        self.manifest = copy.deepcopy(baseline)
        self.manifest['navigationChanges'][0]['path'] = checker.REVIEW + 'packet.json'
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

    def test_missing_files_and_symlink_components_reject(self):
        path = self.root / (checker.REVIEW + 'integration-r04.tsv')
        original = path.read_bytes()
        path.unlink()
        self.rejects('unreadable-or-malformed-input')
        path.write_bytes(original)
        folder = self.root / checker.REVIEW
        moved = self.root / SENTINEL
        folder.rename(moved)
        folder.symlink_to(moved, target_is_directory=True)
        self.rejects('unreadable-or-malformed-input')

    def test_duplicate_nonfinite_and_malformed_json_do_not_echo_input(self):
        path = self.root / checker.MANIFEST
        for raw in [f'{{"x":"{SENTINEL}","x":2}}', '{"x":NaN}', '{']:
            path.write_text(raw)
            self.rejects()

    def test_history_is_local_only_and_missing_objects_fail(self):
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True, capture_output=True)
        self.rejects('git-input-unavailable', lambda: checker.verify(self.root, source_objects=True))

    def test_archived_checker_is_not_imported_executed_or_allowed_to_read_a_packet(self):
        private_path = self.root / 'unselected-private-packet.json'
        private_path.write_text(SENTINEL)
        before = {p: (self.root / p).read_bytes() for p in self.paths}
        with patch.object(checker, 'read', wraps=checker.read) as read, \
                patch('builtins.exec', side_effect=AssertionError('execution forbidden')), \
                patch('subprocess.run', side_effect=AssertionError('subprocess forbidden')):
            checker.verify(self.root)
        self.assertEqual(set(call.args[1] for call in read.call_args_list), set(self.paths))
        self.assertEqual(before, {p: (self.root / p).read_bytes() for p in self.paths})
        self.assertEqual(private_path.read_text(), SENTINEL)
        self.assertEqual({p.relative_to(self.root).as_posix() for p in self.root.rglob('*') if p.is_file()},
                         set(self.paths) | {'unselected-private-packet.json'})
        self.assertFalse(list(self.root.rglob('__pycache__')))

    def test_wrapper_has_no_packet_root_or_export_interface(self):
        for option in ['--packet', '--root', '--output-dir']:
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/soc_cl04.py'),
                                     option, str(self.root / 'forbidden')], capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertFalse((self.root / 'forbidden').exists())


if __name__ == '__main__':
    unittest.main()
