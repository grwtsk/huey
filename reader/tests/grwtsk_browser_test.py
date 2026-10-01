"""Real loopback/Vite/Chromium private-editor checks; no canonical prose writes.

The outside-Git workspace is disposable. Generated host replies and replacement
wording below are explicitly synthetic test inputs, not model or author output.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
REPLACEMENT = "Synthetic private working paragraph for the editor test."


class GrwtskBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="huey-grwtsk-browser-")
        cls.store = str(Path(cls.temp.name) / "private")
        cls.port = 5185
        cls.url = f"http://127.0.0.1:{cls.port}"
        value = subprocess.check_output(["node", "--input-type=module", "-e", """
          import {loadSnapshot} from './scripts/chat_workspace.mjs';
          const e = loadSnapshot().entries.find(e => e.slot === 'C08A');
          console.log(JSON.stringify({id:e.id,version:e.version,path:e.source.path}));
        """], cwd=ROOT, text=True)
        cls.entity = json.loads(value)
        cls.path = f"/huey/paragraph/{cls.entity['id']}"
        cls.source = ROOT / cls.entity["path"]
        cls.source_digest = hashlib.sha256(cls.source.read_bytes()).hexdigest()
        subprocess.run(["npm", "run", "traversal:generate"], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
        subprocess.run(["npm", "run", "paragraphs:generate"], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
        cls.log = open(Path(cls.temp.name) / "vite.log", "w")
        cls.server = subprocess.Popen(["npm", "run", "dev", "--workspace", "@huey/reader", "--", "--mode", "editorial", "--port", str(cls.port)],
            cwd=ROOT, env={**os.environ, "HUEY_PRIVATE_STORE": cls.store}, stdout=cls.log, stderr=subprocess.STDOUT)
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(headless=True)
        cls.context = cls.browser.new_context(viewport={"width": 1440, "height": 1000})
        cls.page = cls.context.new_page()
        cls.page.set_default_timeout(12000)
        errors = []
        cls.page.on('pageerror', lambda error: errors.append(str(error)))
        for _ in range(8):
            try:
                cls.page.goto(cls.url + cls.path, timeout=10000)
                cls.page.get_by_role("button", name="Grwtsk", exact=True).wait_for(timeout=10000)
                break
            except Exception:
                if cls.server.poll() is not None:
                    raise RuntimeError("Private Vite server exited: " + (Path(cls.temp.name) / "vite.log").read_text())
                time.sleep(0.1)
        else:
            cls.server.terminate()
            cls.browser.close()
            cls.pw.stop()
            raise RuntimeError("Private editor did not become available: " + repr(errors) + (Path(cls.temp.name) / "vite.log").read_text())

    @classmethod
    def tearDownClass(cls):
        cls.context.close()
        cls.browser.close()
        cls.pw.stop()
        cls.server.terminate()
        cls.server.wait(timeout=15)
        cls.log.close()
        cls.temp.cleanup()
        assert hashlib.sha256(cls.source.read_bytes()).hexdigest() == cls.source_digest

    def test_01_exact_review_apply_restart_and_source_neutral_handoff(self):
        page = self.page
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.get_by_role("button", name="Grwtsk", exact=True).click()
        editor = page.get_by_label("Working paragraph (Markdown)")
        page.wait_for_function("!document.querySelector('#grwtsk-working-text').disabled")
        source_text = editor.input_value()
        editor.fill(REPLACEMENT)
        page.get_by_role("button", name="Review change", exact=True).click()
        page.locator(".grwtsk-review").wait_for(state="visible")
        self.assertEqual(page.locator(".grwtsk-review pre").nth(0).inner_text(), source_text)
        self.assertEqual(page.locator(".grwtsk-review pre").nth(1).inner_text(), REPLACEMENT)
        self.assertEqual(page.locator(f"[data-entity-id='{self.entity['id']}']").inner_text(), source_text)
        page.get_by_role("button", name="Apply to private copy", exact=True).click()
        page.wait_for_function("document.querySelector('[data-private-overlay=true]') !== null")
        self.assertEqual(page.locator(f"[data-entity-id='{self.entity['id']}']").inner_text(), REPLACEMENT)
        page.get_by_text("Issue handoff", exact=True).click()
        page.get_by_label("Existing issue or PR").fill("https://github.com/grwtsk/huey/issues/358")
        page.get_by_role("button", name="Prepare issue handoff", exact=True).click()
        page.wait_for_function("[...document.querySelectorAll('#grwtsk-panel pre')].some(e=>e.textContent.includes('preview only'))")
        packet = page.locator("#grwtsk-panel details").filter(has=page.get_by_text("Issue handoff", exact=True)).inner_text()
        self.assertNotIn(REPLACEMENT, packet)
        self.assertNotIn(source_text, packet)
        page.reload()
        page.get_by_role("button", name="Grwtsk", exact=True).wait_for()
        page.wait_for_function("document.querySelector('[data-private-overlay=true]') !== null")
        self.assertEqual(page.locator(f"[data-entity-id='{self.entity['id']}']").inner_text(), REPLACEMENT)
        self.assertEqual(errors, [])

    def test_02_pending_chat_has_only_an_actual_host_reply(self):
        page = self.page
        page.get_by_role("button", name="Grwtsk", exact=True).click()
        page.wait_for_function("!document.querySelector('#grwtsk-working-text').disabled")
        page.get_by_label("Message for the existing Codex assistant").fill("Synthetic browser test request: explain this working-copy boundary.")
        page.get_by_role("button", name="Ask Grwtsk", exact=True).click()
        page.get_by_text("1 request awaiting the existing Codex host.", exact=False).wait_for()
        self.assertEqual(page.locator(".grwtsk-message strong").count(), 1)
        subprocess.run(["node", "--input-type=module", "-e", """
          import {readFileSync} from 'node:fs';
          import {appendHostReply} from './scripts/grwtsk_bridge.mjs';
          const [root,store] = process.argv.slice(1);
          const state = JSON.parse(readFileSync(store+'/grwtsk-thread.json','utf8'));
          const request = state.requests.find(r=>r.status==='pending-host');
          appendHostReply({root,store,requestId:request.id,text:'Synthetic host reply for the browser test.',hostRef:'synthetic-browser-test-host'});
        """, str(ROOT), self.store], cwd=ROOT, check=True)
        page.get_by_role("button", name="Check reply", exact=True).click()
        page.get_by_text("Synthetic host reply for the browser test.", exact=True).wait_for()
        self.assertEqual(page.locator(".grwtsk-message strong").count(), 2)

    def test_03_issue_context_and_navigation_during_request_preserve_overlay(self):
        page = self.page
        page.get_by_text("Issues and blockers", exact=True).click()
        page.get_by_label("Huey issue numbers").fill("358, 360")
        page.get_by_role("button", name="Load issue context", exact=True).click()
        # Trigger native history/navigation while the asynchronous issue read is
        # still loading. Overlay restoration must be queued, not dropped.
        page.locator(".traversal-context a").filter(has_text="Book beginning").click()
        page.go_back()
        page.wait_for_function("document.querySelector('[data-private-overlay=true]') !== null")
        self.assertEqual(page.locator(f"[data-entity-id='{self.entity['id']}']").inner_text(), REPLACEMENT)
        page.locator("#grwtsk-panel summary").filter(has_text="#358 ·").first.wait_for()
        self.assertIn("Private working editor", page.locator(".traversal-notice").first.inner_text())
        page.get_by_role("button", name="Close", exact=True).click()
        result = Path(os.environ.get("HUEY_GRWTSK_SCREENSHOT", str(Path(self.temp.name) / "private-editor.png")))
        result.parent.mkdir(parents=True, exist_ok=True)
        page.get_by_role("button", name="Grwtsk", exact=True).click()
        page.wait_for_function("!document.querySelector('#grwtsk-panel').hasAttribute('aria-busy')")
        self.assertNotIn('outside this view', page.locator('.grwtsk-status').inner_text())
        page.screenshot(path=str(result), full_page=False)

    def test_04_missing_exact_version_never_substitutes_current_working_text(self):
        context = self.browser.new_context()
        try:
            page = context.new_page()
            page.goto(self.url + self.path + "/v/hev1:" + "0" * 64)
            page.get_by_role("button", name="Grwtsk", exact=True).wait_for()
            self.assertEqual(page.locator("#book").get_attribute("data-outcome"), "version-unavailable")
            page.get_by_role("button", name="Grwtsk", exact=True).click()
            self.assertTrue(page.get_by_label("Working paragraph (Markdown)").is_disabled())
            self.assertEqual(page.get_by_label("Working paragraph (Markdown)").input_value(), "")
            self.assertEqual(page.locator(".traversal-paragraph").count(), 0)
            page.locator(".traversal-context a").filter(has_text="Book beginning").click()
            page.goto(self.url + self.path)
            page.get_by_role("button", name="Grwtsk", exact=True).click()
            page.wait_for_function("!document.querySelector('#grwtsk-working-text').disabled")
            # SPA navigation followed by history back must also detach a prior
            # current selection when the requested exact state is unavailable.
            page.locator(".paragraph-links a").first.evaluate("(a, href) => { a.href=href; a.dataset.pageAddress=href; }", self.path + "/v/hev1:" + "0" * 64)
            page.locator(".paragraph-links a").first.click()
            page.wait_for_function("document.querySelector('#grwtsk-working-text').disabled")
            self.assertTrue(page.get_by_role("button", name="Ask Grwtsk", exact=True).is_disabled())
            self.assertEqual(page.locator(".traversal-paragraph").count(), 0)
            page.go_back()
            page.wait_for_function("!document.querySelector('#grwtsk-working-text').disabled")
            page.go_forward()
            page.wait_for_function("document.querySelector('#grwtsk-working-text').disabled")
        finally:
            context.close()

    def test_05_exact_source_link_preserves_source_wording_with_private_overlay(self):
        context = self.browser.new_context()
        try:
            page = context.new_page()
            page.goto(self.url + self.path + "/v/" + self.entity["version"])
            page.get_by_role("button", name="Grwtsk", exact=True).wait_for()
            self.assertEqual(page.locator("#book").get_attribute("data-outcome"), "resolved")
            self.assertNotEqual(page.locator(f"[data-entity-id='{self.entity['id']}']").inner_text(), REPLACEMENT)
            self.assertEqual(page.locator("[data-private-overlay=true]").count(), 0)
            page.get_by_role("button", name="Grwtsk", exact=True).click()
            page.wait_for_function("!document.querySelector('#grwtsk-working-text').disabled")
            self.assertEqual(page.get_by_label("Working paragraph (Markdown)").input_value(), REPLACEMENT)
        finally:
            context.close()

    def test_06_typing_during_chat_send_preserves_the_next_unsent_message(self):
        page = self.page
        queued = []
        page.route("**/__grwtsk/chat", lambda route: queued.append(route) if route.request.method == "POST" else route.continue_())
        try:
            draft = page.get_by_label("Message for the existing Codex assistant")
            draft.fill("Synthetic first request for delayed send test.")
            page.get_by_role("button", name="Ask Grwtsk", exact=True).click()
            page.wait_for_timeout(100)
            self.assertEqual(len(queued), 1)
            draft.fill("Synthetic next unsent message.")
            queued[0].continue_()
            page.get_by_text("1 request", exact=False).first.wait_for()
            self.assertEqual(draft.input_value(), "Synthetic next unsent message.")
        finally:
            page.unroute("**/__grwtsk/chat")


if __name__ == "__main__":
    unittest.main(verbosity=2)
