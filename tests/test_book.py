import json
import unittest

from scripts import book


class BookSourceTests(unittest.TestCase):
    def test_manifest_and_structure_validate(self):
        self.assertEqual([], book.validate())

    def test_word_horizon_is_nonbinding(self):
        manifest = book.load_manifest()
        horizon = manifest["word_horizon"]
        self.assertEqual(120000, horizon["approximate_words"])
        self.assertFalse(horizon["binding"])
        self.assertIn("not_goal", horizon["policy"])

    def test_chapter_titles_and_order_are_working_projections(self):
        manifest = book.load_manifest()
        composition = manifest["composition_policy"]
        self.assertEqual("world_first_flow_then_argument_cuts", composition["mode"])
        self.assertEqual("working_projection_not_final", composition["chapter_order_status"])
        self.assertEqual("working_projection_not_final", composition["chapter_title_status"])
        self.assertEqual("C08A", composition["centerpiece_id"])
        for item in manifest["items"]:
            self.assertEqual("working_projection_not_final", item["order_status"], item["id"])
            self.assertIn("working", item["title_status"], item["id"])
            self.assertIn("final", item["title_status"], item["id"])

    def test_planned_chapters_are_structural_placeholders(self):
        manifest = book.load_manifest()
        for item in manifest["items"]:
            if item["status"] != "planned":
                continue
            text = (book.ROOT / item["path"]).read_text(encoding="utf-8")
            self.assertEqual("", book.visible_text(text), item["id"])

    def test_emit_uses_manifest_not_directory_glob(self):
        manifest = book.load_manifest()
        emitted = book.render(manifest)
        included = [item for item in manifest["items"] if item["include"]]
        held = [item for item in manifest["items"] if not item["include"]]
        for item in included:
            self.assertIn(f"<!-- BEGIN {item['id']} ", emitted)
        for item in held:
            self.assertNotIn(f"<!-- BEGIN {item['id']} ", emitted)

    def test_experiential_insertions_preserve_distance_and_do_not_guess_ex_ids(self):
        manifest = book.load_manifest()
        ids = [item["id"] for item in manifest["items"]]
        self.assertEqual(21, len(ids))
        self.assertEqual("C02A", ids[ids.index("C02") + 1])
        self.assertEqual("C08A", ids[ids.index("C08") + 1])
        self.assertEqual("C12A", ids[ids.index("C12") + 1])
        self.assertEqual("C14A", ids[ids.index("C14") + 1])
        self.assertEqual("C14B", ids[ids.index("C14A") + 1])
        self.assertEqual("C15", ids[ids.index("C14B") + 1])
        self.assertGreater(ids.index("C08A") - ids.index("C02A"), 1)
        self.assertGreater(ids.index("C12A") - ids.index("C08A"), 1)
        structure = manifest["experiential_structure"]
        self.assertEqual(5, structure["registered_experiences"])
        self.assertEqual(3, structure["captured_in_C08A"])
        self.assertEqual("pending_private_register_reconciliation", structure["ex_id_reconciliation"])
        self.assertTrue(all(slot["exact_EX_id"] is None for slot in structure["remaining_insertion_slots"]))

    def test_count_report_is_machine_readable(self):
        report = book.count_report()
        encoded = json.dumps(report)
        self.assertIn('"included_words"', encoded)
        self.assertEqual({"approximate_words": 120000, "binding": False}, report["horizon"])


if __name__ == "__main__":
    unittest.main()
