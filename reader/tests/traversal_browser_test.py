"""Real HTTP Chromium checks for the bounded editorial traversal surface.

Start ``npm run dev:editorial`` first, then run this file with Playwright installed.
HUEY_TRAVERSAL_URL selects that local server (default http://127.0.0.1:5173).
These checks use the actual generated public editorial payload, browser history,
keyboard and wheel input. Composition/editing guards use synthetic DOM events;
touch is browser emulation. They are not native IME, VoiceOver, physical-touch,
cross-browser, literary acceptance or accessibility-certification evidence.
"""

import json
import os
from pathlib import Path
import shutil
import unittest
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("HUEY_TRAVERSAL_URL", "http://127.0.0.1:5173").rstrip("/")


def page_path(entity_id):
    return f"/huey/page/{entity_id}"


class TraversalBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        parsed = urlsplit(BASE)
        if parsed.scheme != "http" or parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
            raise ValueError("Traversal browser checks require a local HTTP server")
        cls.payload = json.loads((ROOT / "generated-editorial/data/traversal.json").read_text())
        cls.order = cls.payload["readingOrder"]
        cls.unplaced = cls.payload["unplacedOrder"]
        cls.pages = {page["id"]: page for page in cls.payload["pages"]}
        cls.targets = {target["id"]: target for target in cls.payload["routes"]["targets"]}
        cls.materialized = next(entity_id for entity_id in cls.order if cls.pages[entity_id]["blocks"])
        cls.restricted = next(entity_id for entity_id in cls.order if cls.targets[entity_id]["access"] == "restricted")
        cls.pw = sync_playwright().start()
        executable = os.environ.get("HUEY_READER_BROWSER") or shutil.which("chromium")
        options = {"headless": True}
        if executable:
            options["executable_path"] = executable
        cls.browser = cls.pw.chromium.launch(**options)
        print(f"Traversal browser: Chromium {cls.browser.version}; actual HTTP at {BASE}")

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width": 1280, "height": 800}, reduced_motion="reduce")
        self.page = self.context.new_page()
        self.page.set_default_timeout(7000)
        self.errors = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def open(self, path="/huey"):
        response = self.page.goto(BASE + path)
        self.assertEqual(response.status, 200)
        self.page.wait_for_function("document.querySelector('#book')?.hasAttribute('data-outcome')")

    def assert_page(self, entity_id):
        expect(self.page.locator("#book")).to_have_attribute("data-page-id", entity_id)

    def next_link(self):
        return self.page.get_by_role("navigation", name="Next page", exact=True).get_by_role("link")

    def previous_link(self):
        return self.page.get_by_role("navigation", name="Previous page", exact=True).get_by_role("link")

    def prepare_bottom(self):
        self.page.evaluate("""() => {
            getSelection().removeAllRanges(); document.activeElement?.blur();
            scrollTo(0, document.documentElement.scrollHeight);
        }""")
        self.page.mouse.move(10, 100)
        self.page.wait_for_timeout(100)

    def armed_scroll(self):
        self.page.keyboard.down("Alt")
        self.page.mouse.wheel(0, 70)
        self.page.wait_for_timeout(140)
        self.page.mouse.wheel(0, 70)
        self.page.wait_for_timeout(60)
        self.page.keyboard.up("Alt")

    def test_01_front_first_pending_and_semantic_navigation(self):
        self.open()
        self.assert_page(self.order[0])
        self.assertEqual(urlsplit(self.page.url).path, "/huey")
        expect(self.page.locator("#book")).to_have_attribute("data-outcome", "unavailable")
        expect(self.page.get_by_role("heading", level=1)).to_have_text(self.pages[self.order[0]]["label"])
        expect(self.page.locator(".page-outcome")).to_contain_text("Missing text does not mean omission.")
        self.assertEqual(self.page.locator(".traversal-paragraph").count(), 0)
        self.assertEqual(self.page.locator("#editor-bar").count(), 0)
        self.page.get_by_text("Editorial state", exact=True).click()
        self.assertIn("pending", self.page.locator(".traversal-states").inner_text())
        snapshot = self.page.locator("#book").aria_snapshot()
        self.assertIn('navigation "Next page"', snapshot)
        self.assertIn('navigation "Reading context"', snapshot)
        self.assertIn('link "Next page →"', snapshot)
        self.assertIn('heading', snapshot)

    def test_02_native_history_back_forward_and_deep_reload(self):
        self.open()
        length = self.page.evaluate("history.length")
        self.next_link().click()
        self.assert_page(self.order[1])
        self.assertEqual(self.page.evaluate("history.length"), length + 1)
        self.page.go_back()
        self.assert_page(self.order[0])
        self.assertEqual(urlsplit(self.page.url).path, "/huey")
        self.page.go_forward()
        self.assert_page(self.order[1])
        self.page.reload()
        self.assert_page(self.order[1])
        self.assertEqual(self.page.evaluate("history.length"), length + 1)

    def test_03_readable_page_alias_replaces_its_entry(self):
        alias = next(binding for binding in self.payload["routes"]["aliases"]
                     if binding["path"].startswith("/huey/page/") and binding["targetId"] == self.order[1])
        self.open()
        length = self.page.evaluate("history.length")
        self.open(alias["path"])
        self.assert_page(self.order[1])
        self.assertEqual(urlsplit(self.page.url).path, page_path(self.order[1]))
        self.assertEqual(self.page.evaluate("history.length"), length + 1)
        self.page.go_back()
        self.assert_page(self.order[0])

    def test_04_exact_version_miss_has_no_current_prose_fallback(self):
        path = page_path(self.materialized) + "/v/hev1:" + "0" * 64
        self.open(path)
        self.assert_page(self.materialized)
        expect(self.page.locator("#book")).to_have_attribute("data-outcome", "version-unavailable")
        self.assertEqual(self.page.locator(".traversal-paragraph").count(), 0)
        self.assertEqual(urlsplit(self.page.url).path, path)
        expect(self.page.locator(".page-outcome")).to_contain_text("Current text has not been substituted.")

    def test_05_restricted_slot_stays_visible_without_prose(self):
        self.open(page_path(self.restricted))
        self.assert_page(self.restricted)
        expect(self.page.locator("#book")).to_have_attribute("data-outcome", "restricted")
        self.assertEqual(self.pages[self.restricted]["blocks"], [])
        self.assertEqual(self.page.locator("[data-entity-id]").count(), 0)
        self.assertEqual(urlsplit(self.page.url).path, page_path(self.restricted))
        expect(self.next_link()).to_be_visible()

    def test_06_unplaced_and_book_sequence_ends_are_separate(self):
        self.open(page_path(self.order[-1]))
        self.assertEqual(self.next_link().count(), 0)
        self.page.get_by_role("link", name="Unplaced material", exact=True).click()
        self.assert_page(self.unplaced[0])
        self.assertEqual(self.previous_link().count(), 0)
        expect(self.page.get_by_text("Unplaced material · outside the book sequence", exact=True)).to_be_visible()
        self.open(page_path(self.unplaced[-1]))
        self.assertEqual(self.next_link().count(), 0)
        self.page.get_by_role("link", name="Book beginning", exact=True).click()
        self.assert_page(self.order[0])

    def test_07_every_page_keeps_order_and_identity_across_reflow(self):
        for order in [self.order, self.unplaced]:
            self.open(page_path(order[0]))
            for index, entity_id in enumerate(order):
                with self.subTest(sequence="book" if order is self.order else "unplaced", index=index):
                    self.assert_page(entity_id)
                    before = self.page.locator("[data-entity-id]").evaluate_all("nodes => nodes.map(node => node.dataset.entityId)")
                    self.page.set_viewport_size({"width": 390 if index % 2 else 1280, "height": 844 if index % 2 else 800})
                    self.page.evaluate("document.documentElement.style.setProperty('--doc-size', '24px')")
                    self.assert_page(entity_id)
                    after = self.page.locator("[data-entity-id]").evaluate_all("nodes => nodes.map(node => node.dataset.entityId)")
                    self.assertEqual(after, before)
                    if index + 1 < len(order):
                        expect(self.next_link()).to_have_attribute("href", page_path(order[index + 1]))
                        self.next_link().click()
                    else:
                        self.assertEqual(self.next_link().count(), 0)

    def test_08_materialized_text_is_read_only_and_has_stable_ids(self):
        self.open(page_path(self.materialized))
        expect(self.page.locator("#book")).to_have_attribute("data-outcome", "resolved")
        expected = [block["id"] for block in self.pages[self.materialized]["blocks"]]
        self.assertEqual(self.page.locator("[data-entity-id]").evaluate_all("nodes => nodes.map(node => node.dataset.entityId)"), expected)
        self.assertFalse(self.page.locator("#book").evaluate("node => node.isContentEditable"))
        self.assertEqual(self.page.locator(".paragraph-number").count(), 0)
        paragraphs = [block for block in self.pages[self.materialized]["blocks"] if block["kind"] == "Paragraph"]
        self.assertEqual(self.page.locator('a[href^="/huey/paragraph/"]').count(), 2 * len(paragraphs))
        for paragraph in paragraphs:
            row = self.page.locator(f'#{paragraph["id"]}').locator("..")
            expect(row.get_by_role("link", name="Current link", exact=True)).to_have_attribute(
                "href", f'/huey/paragraph/{paragraph["id"]}')
            self.assertTrue(row.get_by_role("link", name="Exact wording", exact=True).get_attribute("href").startswith(
                f'/huey/paragraph/{paragraph["id"]}/v/hev1:'))

    def test_09_native_keyboard_links_focus_and_shortcuts(self):
        self.open()
        self.page.keyboard.press("Tab")
        expect(self.page.get_by_role("link", name="Skip to the page", exact=True)).to_be_focused()
        self.page.keyboard.press("Enter")
        expect(self.page.locator("#book")).to_be_focused()
        self.page.keyboard.press("Tab")
        # The native disclosure precedes the next-page link in document order.
        expect(self.page.locator("summary")).to_be_focused()
        self.page.keyboard.press("Tab")
        expect(self.next_link()).to_be_focused()
        self.page.keyboard.press("Enter")
        self.assert_page(self.order[1])
        expect(self.page.get_by_role("heading", level=1)).to_be_focused()
        self.page.keyboard.press("Alt+PageDown")
        self.assert_page(self.order[2])
        self.page.keyboard.press("Alt+PageUp")
        self.assert_page(self.order[1])

    def test_10_forced_colors_and_reduced_motion_keep_navigation(self):
        self.page.emulate_media(forced_colors="active", reduced_motion="reduce")
        self.open()
        self.assertTrue(self.page.evaluate("matchMedia('(forced-colors: active)').matches"))
        self.assertTrue(self.page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"))
        self.next_link().focus()
        outline = self.next_link().evaluate("node => getComputedStyle(node).outlineStyle")
        self.assertNotEqual(outline, "none")
        self.page.keyboard.press("Enter")
        self.assert_page(self.order[1])
        self.page.emulate_media(reduced_motion="no-preference")
        self.next_link().click()
        self.assert_page(self.order[2])

    def test_11_emulated_phone_tap_has_no_horizontal_overflow(self):
        phone = self.browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, reduced_motion="reduce")
        page = phone.new_page()
        try:
            page.goto(BASE + "/huey")
            expect(page.locator("#book")).to_have_attribute("data-page-id", self.order[0])
            target = page.get_by_role("navigation", name="Next page", exact=True).get_by_role("link")
            target.tap()
            expect(page.locator("#book")).to_have_attribute("data-page-id", self.order[1])
            self.assertLessEqual(page.evaluate("document.documentElement.scrollWidth"), page.evaluate("innerWidth"))
            box = page.get_by_role("navigation", name="Next page", exact=True).get_by_role("link").bounding_box()
            self.assertGreaterEqual(box["height"], 24)
            self.assertGreaterEqual(box["width"], 24)
        finally:
            phone.close()

    def test_12_plain_wheel_scrolls_without_turning_at_an_edge(self):
        self.open(page_path(self.materialized))
        self.page.mouse.move(10, 100)
        self.page.mouse.wheel(0, 200)
        self.page.wait_for_timeout(150)
        self.assertGreater(self.page.evaluate("scrollY"), 0)
        self.assert_page(self.materialized)
        self.prepare_bottom()
        for _ in range(4):
            self.page.mouse.wheel(0, 300)
            self.page.wait_for_timeout(40)
        self.assert_page(self.materialized)

    def test_13_fresh_alt_edge_gesture_requires_threshold_and_turns_once(self):
        self.open()
        self.prepare_bottom()
        self.page.keyboard.down("Alt")
        self.page.mouse.wheel(0, 70)
        self.page.wait_for_timeout(140)
        self.assert_page(self.order[0])
        self.page.mouse.wheel(0, 70)
        self.assert_page(self.order[1])
        self.prepare_bottom()
        for _ in range(3):
            self.page.mouse.wheel(0, 150)
            self.page.wait_for_timeout(110)
        self.assert_page(self.order[1])
        self.page.keyboard.up("Alt")

    def test_14_selection_suppresses_edge_navigation(self):
        self.open()
        self.prepare_bottom()
        self.page.evaluate("""() => {
            const range = document.createRange(); range.selectNodeContents(document.querySelector('h1'));
            getSelection().addRange(range);
        }""")
        self.page.wait_for_timeout(30)
        self.armed_scroll()
        self.assert_page(self.order[0])

    def test_15_synthetic_composition_suppresses_edge_navigation(self):
        self.open()
        self.prepare_bottom()
        self.page.evaluate("document.dispatchEvent(new CompositionEvent('compositionstart', {bubbles:true}))")
        self.armed_scroll()
        self.assert_page(self.order[0])
        self.page.evaluate("document.dispatchEvent(new CompositionEvent('compositionend', {bubbles:true}))")
        self.prepare_bottom()
        self.armed_scroll()
        self.assert_page(self.order[1])

    def test_16_synthetic_editing_focus_and_input_cancel_edge_navigation(self):
        self.open()
        self.prepare_bottom()
        self.page.evaluate("""() => {
            const input = document.createElement('input'); input.id = 'synthetic-editor';
            input.setAttribute('aria-label', 'Synthetic editing guard');
            input.style.position = 'fixed'; input.style.top = '0';
            document.body.append(input); input.focus({preventScroll:true});
        }""")
        self.armed_scroll()
        self.assert_page(self.order[0])
        self.page.locator("#synthetic-editor").evaluate("node => node.remove()")
        self.prepare_bottom()
        self.page.keyboard.down("Alt")
        self.page.evaluate("document.dispatchEvent(new InputEvent('beforeinput', {bubbles:true, inputType:'insertText', data:'x'}))")
        self.page.mouse.wheel(0, 70)
        self.page.wait_for_timeout(140)
        self.page.mouse.wheel(0, 70)
        self.assert_page(self.order[0])
        self.page.keyboard.up("Alt")

    def test_17_escape_and_resize_cancel_edge_intent(self):
        self.open()
        for cancellation in ["escape", "resize"]:
            self.prepare_bottom()
            self.page.keyboard.down("Alt")
            if cancellation == "escape":
                self.page.keyboard.press("Escape")
            else:
                self.page.set_viewport_size({"width": 1200, "height": 790})
                self.page.wait_for_timeout(60)
            self.page.mouse.wheel(0, 70)
            self.page.wait_for_timeout(140)
            self.page.mouse.wheel(0, 70)
            self.assert_page(self.order[0])
            self.page.keyboard.up("Alt")

    def test_18_admitted_reader_stays_separate(self):
        self.open()
        self.page.get_by_role("link", name="Admitted reading copy", exact=True).click()
        expect(self.page.locator("#chapters .prose")).to_have_count(260)
        self.assertEqual(self.page.locator("#editor-bar > button").count(), 7)
        self.assertEqual(self.page.locator(".traversal-notice").count(), 0)

    def test_19_native_disclosure_focus_suppresses_shortcut_and_wheel(self):
        self.open()
        self.prepare_bottom()
        self.page.locator("summary").focus()
        self.page.keyboard.press("Alt+PageDown")
        self.assert_page(self.order[0])
        self.armed_scroll()
        self.assert_page(self.order[0])

    def test_20_generated_source_paths_do_not_bypass_payload_endpoint(self):
        paths = [
            "/generated-editorial/data/traversal.json",
            "/generated-editorial/data/traversal.json?raw",
            "/generated-editorial/data/traversal.json?url",
            "/@fs/" + str(ROOT / "generated-editorial/data/traversal.json"),
        ]
        for path in paths:
            with self.subTest(path=path):
                response = self.page.request.get(BASE + path)
                text = response.text()
                self.assertTrue("huey.editorial-traversal.v1" not in text,
                                "Generated editorial payload escaped through a direct source URL")
                self.assertTrue('"readingOrder"' not in text,
                                "Generated sequence escaped through a direct source URL")

    def test_21_back_restores_the_native_document_scroll_position(self):
        self.open(page_path(self.materialized))
        self.page.evaluate("scrollTo(0, 500)")
        self.page.wait_for_timeout(100)
        saved = self.page.evaluate("scrollY")
        self.assertGreater(saved, 0)
        self.page.keyboard.press("Alt+PageDown")
        index = self.order.index(self.materialized)
        self.assert_page(self.order[index + 1])
        self.assertEqual(self.page.evaluate("scrollY"), 0)
        self.page.go_back()
        self.assert_page(self.materialized)
        self.page.wait_for_function("saved => Math.abs(scrollY - saved) <= 2", arg=saved)

    def test_22_available_partial_slot_without_selected_prose_is_explicit(self):
        empty = next(entity_id for entity_id in self.order
                     if self.targets[entity_id]["access"] == "available"
                     and not self.pages[entity_id]["blocks"])
        self.open(page_path(empty))
        expect(self.page.locator(".page-outcome")).to_have_text("No selected prose is materialized on this page.")
        self.assertEqual(self.page.locator(".traversal-paragraph").count(), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
