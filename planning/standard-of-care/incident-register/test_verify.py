import copy
import json
import unittest
from pathlib import Path
import verify

ROOT = Path(__file__).resolve().parent


class RegistrationTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / 'register.json').read_text())
        self.sources = json.loads((ROOT / 'sources.json').read_text())

    def reject(self, change):
        changed = copy.deepcopy(self.data)
        change(changed)
        with self.assertRaises(ValueError):
            verify.validate(changed, self.sources)

    def test_initial_snapshot(self):
        self.assertEqual(verify.validate(self.data, self.sources)['entries'], 112)

    def test_rendered_index(self):
        verify.validate(self.data, self.sources, (ROOT / 'index.md').read_text())

    def test_duplicate_identifier(self):
        self.reject(lambda d: d['entries'][1].__setitem__(0, 1))

    def test_missing_entry(self):
        self.reject(lambda d: d['entries'].pop())

    def test_wrong_issue(self):
        self.reject(lambda d: d['entries'][0].__setitem__(1, 125))

    def test_missing_source(self):
        self.reject(lambda d: d['entries'][0].__setitem__(3, 'INVENTED'))

    def test_missing_locator(self):
        self.reject(lambda d: d['entries'][0].__setitem__(4, ''))

    def test_promotion_to_finding(self):
        self.reject(lambda d: d.__setitem__('finding_status', 'proven'))

    def test_false_exhaustive_claim(self):
        self.reject(lambda d: d.__setitem__('all_incidents_enumerated', True))

    def test_invented_collection(self):
        self.reject(lambda d: d.__setitem__('new_collection_status', 'collected'))

    def test_status_swap_preserving_counts(self):
        def swap(d):
            d['entries'][4][2], d['entries'][5][2] = d['entries'][5][2], d['entries'][4][2]
        self.reject(swap)

    def test_wrong_repository(self):
        self.reject(lambda d: d.__setitem__('repository', 'grwtsk/neurology'))

    def test_missing_disclaimer(self):
        self.reject(lambda d: d.pop('disclaimer'))

    def test_missing_remaining_owner(self):
        self.reject(lambda d: d.pop('coverage_issue'))

    def test_changed_render(self):
        with self.assertRaises(ValueError):
            verify.validate(self.data, self.sources, 'all proved')

    def test_publication_boundary_present(self):
        self.assertIn('Raw clinical PDFs', (ROOT / 'README.md').read_text())
        self.assertIn('New evidence is not automatically', self.sources['publication_scope'])


if __name__ == '__main__':
    unittest.main()
