"""Negative-input tests for the Q03 packet; not tests of historical truth."""
import csv
import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('q03_verify', HERE/'verify.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

class PacketTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        original = HERE.parents[2]
        for relative in [MODULE.DIR, str(Path(MODULE.SOURCE).parent)]:
            shutil.copytree(original/relative, self.root/relative,
                            ignore=shutil.ignore_patterns('__pycache__'))
        self.base = self.root/MODULE.DIR

    def edit_review(self, change):
        p = self.base/'review.json'
        data = json.loads(p.read_text())
        change(data)
        p.write_text(json.dumps(data))

    def edit_table(self, name, change):
        p = self.base/name
        with p.open(newline='') as f:
            reader=csv.DictReader(f,delimiter='\t')
            columns=reader.fieldnames
            rows=list(reader)
        change(rows)
        with p.open('w',newline='') as f:
            writer=csv.DictWriter(f,fieldnames=columns,delimiter='\t',lineterminator='\n')
            writer.writeheader();writer.writerows(rows)

    def rejected(self):
        with self.assertRaises(MODULE.Invalid):
            MODULE.validate(self.root)

    def test_complete_packet(self):
        result=MODULE.validate(self.root)
        self.assertEqual((result['scalar_fields'],result['primary_text_matches']), (271,9))
        self.assertFalse(result['semantic_truth_certified'])

    def test_source_bytes_changed(self):
        p=self.root/MODULE.SOURCE;p.write_bytes(p.read_bytes()+b' ');self.rejected()

    def test_historical_source_date_changed(self):
        p=self.root/MODULE.SOURCE;p.write_text(p.read_text().replace('2026-09-18','2026-09-22'));self.rejected()

    def test_missing_field(self):
        self.edit_table('fields.tsv',lambda r:r.pop());self.rejected()

    def test_duplicate_pointer(self):
        self.edit_table('fields.tsv',lambda r:r[1].update(pointer=r[0]['pointer']));self.rejected()

    def test_wrong_field_owner(self):
        self.edit_table('fields.tsv',lambda r:r[2].update(verification_issue='https://github.com/grwtsk/neurology/issues/192'));self.rejected()

    def test_correspondence_promoted(self):
        def change(rows):
            next(r for r in rows if r['kind']=='conceptual-correspondence')['disposition']='verified'
        self.edit_table('fields.tsv',change);self.rejected()

    def test_source_date_recertified(self):
        def change(rows):
            next(r for r in rows if r['pointer']=='/verified_at')['disposition']='verified-now'
        self.edit_table('fields.tsv',change);self.rejected()

    def test_index_excerpt_promoted(self):
        self.edit_review(lambda d:d['observations'][1].update(text_result='matched-sentence'));self.rejected()

    def test_jps_edition_cleared(self):
        self.edit_review(lambda d:d['observations'][5].update(version_result='supported-as-described'));self.rejected()

    def test_quran_translator_cleared(self):
        self.edit_review(lambda d:d['observations'][6].update(version_result='supported-as-described'));self.rejected()

    def test_geneva_version_erased(self):
        self.edit_review(lambda d:d['observations'][8].update(version_result='supported-as-described'));self.rejected()

    def test_limits_erased(self):
        self.edit_review(lambda d:d['observations'][0].update(limits=''));self.rejected()

    def test_original_url_replaced(self):
        self.edit_review(lambda d:d['observations'][0]['attempts'][0].update(url='https://example.org/'));self.rejected()

    def test_unrun_read_claimed_as_match(self):
        self.edit_review(lambda d:d['observations'][0]['attempts'][0].update(result='unavailable'));self.rejected()

    def test_manuscript_accepted(self):
        self.edit_review(lambda d:d.update(manuscript_status='accepted'));self.rejected()

    def test_factual_clearance_claimed(self):
        self.edit_review(lambda d:d.update(factual_clearance=True));self.rejected()

    def test_clinical_pdf_scope_changed(self):
        self.edit_review(lambda d:d.update(raw_clinical_records_published=True));self.rejected()

    def test_orphan_claim_source(self):
        self.edit_table('claims.tsv',lambda r:r[0].update(reviews='Q03-R99'));self.rejected()

    def test_candidate_unit_missing(self):
        p=self.base/'argument-draft.md';p.write_text(p.read_text().replace('Q03-P12','Q03-P13'));self.rejected()

    def test_unlisted_candidate_paragraph(self):
        p=self.base/'argument-draft.md';p.write_text(p.read_text().replace('<!-- END CANDIDATE -->','\nUnlisted new paragraph.\n<!-- END CANDIDATE -->'));self.rejected()

    def test_readme_notice_missing(self):
        p=self.base/'README.md';p.write_text(p.read_text().replace(MODULE.TRAILER,''));self.rejected()

if __name__=='__main__':
    unittest.main()
