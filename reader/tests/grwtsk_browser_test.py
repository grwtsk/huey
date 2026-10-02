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
from playwright.sync_api import sync_playwright, TimeoutError as BrowserTimeout

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

    def test_07_stale_private_edit_can_be_compared_and_resumed_without_losing_history(self):
        # Seed a synthetic earlier-revision overlay in this disposable private
        # store. The real checked host now has a newer basis, with source bytes
        # untouched. No repository file or author workspace is mutated.
        value = subprocess.check_output(["node", "--input-type=module", "-e", """
          import {ChatWorkspace,loadSnapshot} from './scripts/chat_workspace.mjs';
          const [root,store] = process.argv.slice(1);
          const historical = loadSnapshot(root);
          const entity = historical.entries.filter(e=>e.slot==='C08A')[1];
          historical.basis = 'sha256:'+'0'.repeat(64); historical.revision = '0'.repeat(40);
          const workspace = new ChatWorkspace({root,store,snapshot:()=>historical});
          const current = workspace.read(entity.id);
          const op = workspace.propose({id:entity.id,baseVersion:current.version,beforeDigest:current.rawDigest,
            after:'Synthetic historical private contribution for recovery.',key:'synthetic-history',
            actor:'synthetic-browser-test',session:'synthetic-browser-session',requestRef:'synthetic earlier revision'});
          workspace.decide({operationId:op.id,reviewDigest:op.digest,status:'applied-private',approvalRef:'synthetic historical apply'});
          console.log(JSON.stringify({id:entity.id,raw:entity.raw,version:entity.version,operationId:op.id}));
        """, str(ROOT), self.store], cwd=ROOT, text=True)
        historical = json.loads(value)
        state_file = Path(self.store) / "workspace.json"
        original = json.loads(state_file.read_text())
        context = self.browser.new_context(viewport={"width": 390, "height": 844})
        try:
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            path = f"/huey/paragraph/{historical['id']}"
            page.goto(self.url + path)
            page.get_by_role("button", name="Grwtsk", exact=True).click()
            comparison = page.get_by_role("region", name="Stale private edit comparison")
            comparison.wait_for(state="visible")
            blocks = comparison.locator("pre")
            self.assertEqual(blocks.nth(0).inner_text(), historical["raw"])
            self.assertEqual(blocks.nth(1).inner_text(), "Synthetic historical private contribution for recovery.")
            self.assertEqual(blocks.nth(2).inner_text(), historical["raw"])
            self.assertTrue(page.get_by_label("Working paragraph (Markdown)").is_disabled())
            self.assertTrue(page.get_by_role("button", name="Ask Grwtsk", exact=True).is_disabled())
            self.assertEqual(page.locator(f"[data-entity-id='{historical['id']}']").inner_text(), historical["raw"])
            page.get_by_role("button", name="Refresh comparison", exact=True).click()
            page.wait_for_function("!document.querySelector('#grwtsk-panel').hasAttribute('aria-busy')")
            self.assertTrue(comparison.is_visible())
            page.get_by_role("button", name="Resume from current source", exact=True).click()
            comparison.wait_for(state="hidden")
            page.wait_for_function("!document.querySelector('#grwtsk-working-text').disabled")
            self.assertEqual(page.get_by_label("Working paragraph (Markdown)").input_value(), historical["raw"])
            retained = json.loads(state_file.read_text())
            for key in ["proposals", "decisions", "links"]:
                self.assertEqual(retained[key], original[key])
            self.assertEqual(len(retained["reconciliations"]), 1)
            self.assertIn(historical["operationId"], retained["reconciliations"][0]["retiredOperationIds"])
            page.get_by_text("Retained private history", exact=True).click()
            page.get_by_text("Earlier private edit · retained after source resume", exact=True).click()
            page.get_by_text("Synthetic historical private contribution for recovery.", exact=True).last.wait_for(state="visible")
            # A new edit requires its own exact review; the old result is never
            # silently reapplied to the newly resumed source.
            editor = page.get_by_label("Working paragraph (Markdown)")
            editor.fill("Synthetic fresh edit after explicit source recovery.")
            page.get_by_role("button", name="Review change", exact=True).click()
            page.locator(".grwtsk-review").wait_for(state="visible")
            self.assertEqual(page.locator(".grwtsk-review pre").nth(0).inner_text(), historical["raw"])
            page.get_by_role("button", name="Apply to private copy", exact=True).click()
            page.get_by_text("Applied to the private working copy.", exact=False).wait_for()
            page.reload()
            page.get_by_role("button", name="Grwtsk", exact=True).click()
            page.wait_for_function("!document.querySelector('#grwtsk-working-text').disabled")
            self.assertFalse(page.locator(".grwtsk-recovery").is_visible())
            self.assertEqual(page.get_by_label("Working paragraph (Markdown)").input_value(), "Synthetic fresh edit after explicit source recovery.")
            self.assertEqual(errors, [])
        finally:
            context.close()

    def test_08_source_unavailable_after_resume_preserves_receipt_and_disables_editing(self):
        value = subprocess.check_output(["node", "--input-type=module", "-e", """
          import {ChatWorkspace,loadSnapshot} from './scripts/chat_workspace.mjs';
          const [root,store] = process.argv.slice(1), historical = loadSnapshot(root);
          const entity = historical.entries.filter(e=>e.slot==='C08A')[2];
          historical.basis = 'sha256:'+'1'.repeat(64); historical.revision = '1'.repeat(40);
          const workspace = new ChatWorkspace({root,store,snapshot:()=>historical});
          const current = workspace.read(entity.id);
          const op = workspace.propose({id:entity.id,baseVersion:current.version,beforeDigest:current.rawDigest,
            after:'Synthetic historical contribution for an unavailable-source race.',key:'synthetic-unavailable-race',
            actor:'synthetic-browser-test',session:'synthetic-browser-session',requestRef:'synthetic historical context'});
          workspace.decide({operationId:op.id,reviewDigest:op.digest,status:'applied-private',approvalRef:'synthetic historical apply'});
          console.log(JSON.stringify({id:entity.id,operationId:op.id}));
        """, str(ROOT), self.store], cwd=ROOT, text=True)
        historical = json.loads(value)
        context = self.browser.new_context()
        try:
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            resumed = []

            def resume_request(route):
                response = route.fetch()
                self.assertEqual(response.status, 200)
                resumed.append(response.json())
                route.fulfill(response=response)

            def inspect_request(route):
                response = route.fetch()
                value = response.json()
                if resumed:
                    # Explicitly synthetic UI race response: the real resume
                    # receipt was committed, then the selected source vanished.
                    value.update(status="unavailable", current=None, source=None,
                                 conflict="Synthetic post-resume source unavailable")
                route.fulfill(response=response, json=value)

            page.route("**/__grwtsk/resume-source", resume_request)
            page.route(f"**/__grwtsk/inspect?id={historical['id']}", inspect_request)
            page.goto(self.url + f"/huey/paragraph/{historical['id']}")
            page.get_by_role("button", name="Grwtsk", exact=True).click()
            page.get_by_role("region", name="Stale private edit comparison").wait_for(state="visible")
            page.get_by_role("button", name="Resume from current source", exact=True).click()
            page.get_by_text("Private source-resume receipt retained.", exact=False).wait_for()
            self.assertTrue(page.get_by_label("Working paragraph (Markdown)").is_disabled())
            self.assertTrue(page.get_by_role("button", name="Ask Grwtsk", exact=True).is_disabled())
            self.assertEqual(page.get_by_label("Working paragraph (Markdown)").input_value(), "")
            self.assertEqual(len(resumed), 1)
            retained = json.loads((Path(self.store) / "workspace.json").read_text())
            self.assertTrue(any(r["target"] == historical["id"] for r in retained["reconciliations"]))
            self.assertTrue(any(p["id"] == historical["operationId"] for p in retained["proposals"]))
            self.assertEqual(errors, [])
        finally:
            context.close()

    def test_09_saved_review_and_cancellation_survive_reload(self):
        page = self.page
        editor = page.get_by_label("Working paragraph (Markdown)")
        page.wait_for_function("!document.querySelector('#grwtsk-panel').hasAttribute('aria-busy')")
        original = editor.input_value()
        candidate = "Synthetic saved proposal recovered after reload."
        editor.fill(candidate)
        page.get_by_role("button", name="Review change", exact=True).click()
        page.locator(".grwtsk-review").wait_for(state="visible")
        state_file = Path(self.store) / "workspace.json"
        saved = json.loads(state_file.read_text())
        operation = saved["proposals"][-1]
        page.reload()
        page.get_by_role("button", name="Grwtsk", exact=True).click()
        page.wait_for_function("!document.querySelector('#grwtsk-working-text').disabled")
        self.assertEqual(editor.input_value(), original)
        page.get_by_text("Saved paragraph changes", exact=True).click()
        page.get_by_role("button", name="Load saved changes", exact=True).click()
        row = page.locator(f".grwtsk-queue-entry[data-operation-id='{operation['id']}']")
        row.wait_for()
        self.assertIn("proposed-private", row.inner_text())
        row.get_by_role("button", name="Review saved change", exact=True).click()
        page.locator(".grwtsk-review").wait_for(state="visible")
        self.assertEqual(page.locator(".grwtsk-review pre").nth(0).inner_text(), original)
        self.assertEqual(page.locator(".grwtsk-review pre").nth(1).inner_text(), candidate)
        self.assertEqual(editor.input_value(), original)
        page.get_by_role("button", name="Cancel proposal", exact=True).click()
        page.get_by_text("Decision retained; working text unchanged.", exact=True).wait_for()
        page.reload()
        page.get_by_role("button", name="Grwtsk", exact=True).click()
        page.wait_for_function("!document.querySelector('#grwtsk-working-text').disabled")
        page.get_by_text("Saved paragraph changes", exact=True).click()
        page.get_by_role("button", name="Load saved changes", exact=True).click()
        row.wait_for()
        self.assertIn("cancelled", row.inner_text())
        row.get_by_role("button", name="Review saved change", exact=True).click()
        page.locator(".grwtsk-review").wait_for(state="visible")
        self.assertTrue(page.get_by_role("button", name="Apply to private copy", exact=True).is_disabled())
        self.assertTrue(page.get_by_role("button", name="Cancel proposal", exact=True).is_disabled())
        retained = json.loads(state_file.read_text())
        self.assertEqual(len(retained["proposals"]), len(saved["proposals"]))
        self.assertTrue(any(d["operationId"] == operation["id"] and d["status"] == "cancelled" for d in retained["decisions"]))
        self.assertEqual(editor.input_value(), original)

    def test_10_lost_response_has_manual_queue_recovery_without_duplicate_or_invented_receipt(self):
        page = self.page
        editor = page.get_by_label("Working paragraph (Markdown)")
        candidate = "Synthetic proposal whose HTTP acknowledgment was lost."
        before_count = len(json.loads((Path(self.store) / "workspace.json").read_text())["proposals"])

        def lose_response(route):
            response = route.fetch()
            self.assertEqual(response.status, 200)
            route.abort("failed")

        page.route("**/__grwtsk/propose", lose_response)
        try:
            editor.fill(candidate)
            page.get_by_role("button", name="Review change", exact=True).click()
            page.get_by_text("Private request unavailable; no new receipt was confirmed.", exact=False).wait_for()
            self.assertEqual(editor.input_value(), candidate)
            self.assertFalse(editor.is_disabled())
            saved = json.loads((Path(self.store) / "workspace.json").read_text())
            self.assertEqual(len(saved["proposals"]), before_count + 1)
            operation = saved["proposals"][-1]
            page.get_by_role("button", name="Load saved changes", exact=True).click()
            row = page.locator(f".grwtsk-queue-entry[data-operation-id='{operation['id']}']")
            row.wait_for()
            row.get_by_role("button", name="Review saved change", exact=True).click()
            page.locator(".grwtsk-review").wait_for(state="visible")
            self.assertEqual(editor.input_value(), candidate)
            page.get_by_role("button", name="Apply to private copy", exact=True).click()
            page.get_by_text("Applied to the private working copy.", exact=False).wait_for()
            self.assertEqual(editor.input_value(), candidate)
            self.assertEqual(len(json.loads((Path(self.store) / "workspace.json").read_text())["proposals"]), before_count + 1)
        finally:
            page.unroute("**/__grwtsk/propose")

    def test_11_typing_while_proposal_is_pending_and_reviewing_saved_diff_preserves_newer_draft(self):
        page = self.page
        editor = page.get_by_label("Working paragraph (Markdown)")
        delayed = []
        page.route("**/__grwtsk/propose", lambda route: delayed.append(route))
        try:
            editor.fill("Synthetic older draft submitted for review.")
            page.get_by_role("button", name="Review change", exact=True).click()
            page.wait_for_timeout(100)
            self.assertEqual(len(delayed), 1)
            self.assertFalse(editor.is_disabled())
            newer = "Synthetic newer draft typed during the pending request."
            editor.fill(newer)
            delayed[0].continue_()
            page.get_by_text("Working text changed while reviewing.", exact=False).wait_for()
            self.assertEqual(editor.input_value(), newer)
            operation = json.loads((Path(self.store) / "workspace.json").read_text())["proposals"][-1]
            page.get_by_role("button", name="Load saved changes", exact=True).click()
            row = page.locator(f".grwtsk-queue-entry[data-operation-id='{operation['id']}']")
            row.wait_for()
            row.get_by_role("button", name="Review saved change", exact=True).click()
            page.get_by_text("Saved diff shown; your current draft is retained.", exact=False).wait_for()
            self.assertEqual(editor.input_value(), newer)
            self.assertTrue(page.get_by_role("button", name="Apply to private copy", exact=True).is_disabled())
            page.get_by_role("button", name="Cancel proposal", exact=True).click()
            page.get_by_text("Private decision retained; newer or unapplied draft text remains", exact=False).wait_for()
            self.assertEqual(editor.input_value(), newer)
            page.get_by_role("button", name="Discard unreviewed text", exact=True).click()
        finally:
            page.unroute("**/__grwtsk/propose")

    def test_12_typing_while_private_application_is_pending_requires_another_review(self):
        page = self.page
        editor = page.get_by_label("Working paragraph (Markdown)")
        accepted = "Synthetic explicitly reviewed private application."
        editor.fill(accepted)
        page.get_by_role("button", name="Review change", exact=True).click()
        page.locator(".grwtsk-review").wait_for(state="visible")
        delayed = []
        page.route("**/__grwtsk/decide", lambda route: delayed.append(route))
        try:
            page.get_by_role("button", name="Apply to private copy", exact=True).click()
            page.wait_for_timeout(100)
            self.assertEqual(len(delayed), 1)
            self.assertFalse(editor.is_disabled())
            newer = "Synthetic new text typed while the previous application is pending."
            editor.fill(newer)
            delayed[0].continue_()
            page.get_by_text("Private decision retained; newer or unapplied draft text remains", exact=False).wait_for()
            self.assertEqual(editor.input_value(), newer)
            self.assertEqual(page.locator(f"[data-entity-id='{self.entity['id']}']").inner_text(), accepted)
            self.assertFalse(page.locator(".grwtsk-review").is_visible())
            self.assertTrue(page.get_by_role("button", name="Review change", exact=True).is_enabled())
            page.get_by_role("button", name="Discard unreviewed text", exact=True).click()
            self.assertEqual(editor.input_value(), accepted)
        finally:
            page.unroute("**/__grwtsk/decide")

    def test_13_native_reload_guard_preserves_unstored_private_draft(self):
        page = self.page
        editor = page.get_by_label("Working paragraph (Markdown)")
        wording = "Synthetic unreviewed private text protected from reload."
        editor.fill(wording)
        dialogs = []

        def keep_draft(dialog):
            dialogs.append(dialog.type)
            dialog.dismiss()

        page.on("dialog", keep_draft)
        try:
            with self.assertRaises(BrowserTimeout):
                page.reload(timeout=1000, wait_until="domcontentloaded")
            self.assertEqual(dialogs, ["beforeunload"])
            self.assertEqual(editor.input_value(), wording)
            page.get_by_role("button", name="Discard unreviewed text", exact=True).click()
        finally:
            page.remove_listener("dialog", keep_draft)

    def test_14_private_queue_timeout_keeps_typing_and_does_not_retry(self):
        page = self.page
        editor = page.get_by_label("Working paragraph (Markdown)")
        page.clock.install()
        delayed = []
        page.route("**/__grwtsk/queue?*", lambda route: delayed.append(route))
        try:
            page.get_by_role("button", name="Load saved changes", exact=True).click()
            page.wait_for_timeout(100)
            self.assertEqual(len(delayed), 1)
            wording = "Synthetic draft typed while queue access is unavailable."
            self.assertFalse(editor.is_disabled())
            editor.fill(wording)
            page.clock.fast_forward(30001)
            page.get_by_text("Private request unavailable; no new receipt was confirmed.", exact=False).wait_for()
            self.assertEqual(editor.input_value(), wording)
            self.assertFalse(editor.is_disabled())
            self.assertTrue(page.get_by_role("button", name="Load saved changes", exact=True).is_enabled())
            page.clock.fast_forward(60000)
            self.assertEqual(len(delayed), 1)
            self.assertIn("Private queue unavailable", page.locator("#grwtsk-queue").inner_text())
            page.get_by_role("button", name="Discard unreviewed text", exact=True).click()
        finally:
            for route in delayed:
                route.abort("failed")
            page.unroute("**/__grwtsk/queue?*")

    def test_15_confirmed_decision_is_not_downgraded_by_a_failed_followup_read(self):
        page = self.page
        editor = page.get_by_label("Working paragraph (Markdown)")
        candidate = "Synthetic confirmed private change with unavailable follow-up read."
        editor.fill(candidate)
        page.get_by_role("button", name="Review change", exact=True).click()
        page.locator(".grwtsk-review").wait_for(state="visible")
        page.route("**/__grwtsk/inspect?*", lambda route: route.abort("failed"))
        try:
            page.get_by_role("button", name="Apply to private copy", exact=True).click()
            page.get_by_text("Private decision applied-private is confirmed; current source refresh is unavailable.", exact=False).wait_for()
            self.assertEqual(editor.input_value(), candidate)
            self.assertTrue(page.get_by_role("button", name="Apply to private copy", exact=True).is_disabled())
            saved = json.loads((Path(self.store) / "workspace.json").read_text())
            self.assertEqual(saved["decisions"][-1]["status"], "applied-private")
            self.assertEqual(saved["proposals"][-1]["after"], candidate)
        finally:
            page.unroute("**/__grwtsk/inspect?*")
        page.get_by_role("button", name="Discard unreviewed text", exact=True).click()
        page.get_by_role("button", name="Refresh selection", exact=True).click()
        page.get_by_text("Private working overlay loaded.", exact=True).wait_for()
        self.assertEqual(editor.input_value(), candidate)

    def test_16_saved_proposal_is_not_downgraded_by_an_unavailable_review(self):
        page = self.page
        editor = page.get_by_label("Working paragraph (Markdown)")
        candidate = "Synthetic saved proposal with an unavailable exact review."
        editor.fill(candidate)
        page.route("**/__grwtsk/review?*", lambda route: route.abort("failed"))
        try:
            page.get_by_role("button", name="Review change", exact=True).click()
            page.get_by_text("Proposal saved privately; exact review is unavailable.", exact=False).wait_for()
            self.assertEqual(editor.input_value(), candidate)
            self.assertFalse(page.locator(".grwtsk-review").is_visible())
            saved = json.loads((Path(self.store) / "workspace.json").read_text())
            operation = saved["proposals"][-1]
            self.assertEqual(operation["after"], candidate)
            self.assertFalse(any(d["operationId"] == operation["id"] for d in saved["decisions"]))
        finally:
            page.unroute("**/__grwtsk/review?*")
        page.get_by_role("button", name="Load saved changes", exact=True).click()
        row = page.locator(f".grwtsk-queue-entry[data-operation-id='{operation['id']}']")
        row.wait_for()
        row.get_by_role("button", name="Review saved change", exact=True).click()
        page.locator(".grwtsk-review").wait_for(state="visible")
        page.get_by_role("button", name="Cancel proposal", exact=True).click()
        page.get_by_text("Private decision retained; newer or unapplied draft text remains", exact=False).wait_for()
        page.get_by_role("button", name="Discard unreviewed text", exact=True).click()

    def test_17_confirmed_source_resume_survives_failed_inspection_until_manual_refresh(self):
        value = subprocess.check_output(["node", "--input-type=module", "-e", """
          import {ChatWorkspace,loadSnapshot} from './scripts/chat_workspace.mjs';
          const [root,store] = process.argv.slice(1), historical = loadSnapshot(root);
          const entity = historical.entries.filter(e=>e.slot==='C08A')[3];
          historical.basis = 'sha256:'+'2'.repeat(64); historical.revision = '2'.repeat(40);
          const workspace = new ChatWorkspace({root,store,snapshot:()=>historical});
          const current = workspace.read(entity.id);
          const op = workspace.propose({id:entity.id,baseVersion:current.version,beforeDigest:current.rawDigest,
            after:'Synthetic earlier private contribution for a failed refresh.',key:'synthetic-resume-refresh-failure',
            actor:'synthetic-browser-test',session:'synthetic-browser-session',requestRef:'synthetic historical context'});
          workspace.decide({operationId:op.id,reviewDigest:op.digest,status:'applied-private',approvalRef:'synthetic historical apply'});
          console.log(JSON.stringify({id:entity.id,operationId:op.id}));
        """, str(ROOT), self.store], cwd=ROOT, text=True)
        historical = json.loads(value)
        state_file = Path(self.store) / "workspace.json"
        before = json.loads(state_file.read_text())
        context = self.browser.new_context()
        try:
            page = context.new_page()
            page.set_default_timeout(12000)
            errors, receipts, failed_inspections = [], [], []
            page.on("pageerror", lambda error: errors.append(str(error)))

            def resume_request(route):
                response = route.fetch()
                self.assertEqual(response.status, 200)
                receipts.append(response.json())
                route.fulfill(response=response)

            def inspect_request(route):
                if receipts:
                    failed_inspections.append(route.request.url)
                    route.abort("failed")
                else:
                    route.continue_()

            page.route("**/__grwtsk/resume-source", resume_request)
            inspect_pattern = f"**/__grwtsk/inspect?id={historical['id']}"
            page.route(inspect_pattern, inspect_request)
            page.goto(self.url + f"/huey/paragraph/{historical['id']}")
            page.get_by_role("button", name="Grwtsk", exact=True).click()
            comparison = page.get_by_role("region", name="Stale private edit comparison")
            comparison.wait_for(state="visible")
            exact_source = comparison.locator("pre").nth(2).inner_text()
            page.get_by_role("button", name="Resume from current source", exact=True).click()
            page.get_by_text("Private source-resume receipt is confirmed; current source refresh is unavailable.", exact=False).wait_for()
            self.assertTrue(comparison.is_visible())
            self.assertTrue(page.get_by_label("Working paragraph (Markdown)").is_disabled())
            self.assertTrue(page.get_by_role("button", name="Ask Grwtsk", exact=True).is_disabled())
            self.assertEqual(page.get_by_label("Working paragraph (Markdown)").input_value(), exact_source)
            self.assertEqual(len(receipts), 1)
            self.assertEqual(len(failed_inspections), 1)
            retained = json.loads(state_file.read_text())
            for key in ["proposals", "decisions", "links"]:
                self.assertEqual(retained[key], before[key])
            self.assertEqual(len(retained["reconciliations"]), len(before["reconciliations"]) + 1)
            self.assertEqual(retained["reconciliations"][-1]["id"], receipts[0]["id"])
            self.assertIn(historical["operationId"], receipts[0]["retiredOperationIds"])
            page.get_by_text("Retained private history", exact=True).click()
            page.get_by_text("Applied private edit", exact=True).click()
            page.get_by_text("Synthetic earlier private contribution for a failed refresh.", exact=True).last.wait_for(state="visible")
            # Advancing local timers must not retry either a confirmed mutation
            # or its failed read. Recovery remains an explicit user action.
            page.clock.install()
            page.clock.fast_forward(60000)
            self.assertEqual(len(receipts), 1)
            self.assertEqual(len(failed_inspections), 1)
            self.assertEqual(json.loads(state_file.read_text()), retained)
            page.unroute(inspect_pattern, inspect_request)
            page.get_by_role("button", name="Refresh selection", exact=True).click()
            page.get_by_text("Exact source paragraph loaded.", exact=True).wait_for()
            self.assertFalse(comparison.is_visible())
            self.assertTrue(page.get_by_label("Working paragraph (Markdown)").is_enabled())
            self.assertEqual(page.get_by_label("Working paragraph (Markdown)").input_value(), exact_source)
            page.get_by_text("Earlier private edit · retained after source resume", exact=True).click()
            page.get_by_text("Synthetic earlier private contribution for a failed refresh.", exact=True).last.wait_for(state="visible")
            self.assertEqual(json.loads(state_file.read_text()), retained)
            self.assertEqual(len(receipts), 1)
            self.assertEqual(errors, [])
        finally:
            # Every intercepted request is immediately continued, fulfilled or
            # aborted above; no delayed route survives the disposable context.
            context.close()


    def _new_draft_context(self):
        context = self.browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        page.set_default_timeout(12000)
        page.goto(self.url + self.path)
        page.get_by_role("button", name="Grwtsk", exact=True).click()
        page.wait_for_function("!document.querySelector('#grwtsk-working-text').disabled")
        return context, page, page.get_by_label("Working paragraph (Markdown)")

    def _saved_checkpoint(self):
        state = json.loads((Path(self.store) / "workspace.json").read_text())
        return next((row for row in state.get("draftCheckpoints", {}).get("checkpoints", [])
                     if row["target"] == self.entity["id"]), None)

    def test_18_checkpoint_reload_requires_explicit_load_restore_and_fresh_proposal(self):
        context, page, editor = self._new_draft_context()
        try:
            before = editor.input_value()
            unfinished = "Synthetic unfinished recovery draft *\n\n"
            state_file = Path(self.store) / "workspace.json"
            history_before = json.loads(state_file.read_text()) if state_file.exists() else {}
            editor.fill(unfinished)
            page.get_by_role("button", name="Save draft", exact=True).click()
            page.get_by_text("Draft saved privately for explicit recovery.", exact=False).wait_for()
            saved = self._saved_checkpoint()
            self.assertEqual(saved["before"], before)
            self.assertEqual(saved["draft"], unfinished)
            page.reload()
            page.get_by_role("button", name="Grwtsk", exact=True).click()
            page.wait_for_function("!document.querySelector('#grwtsk-working-text').disabled")
            self.assertEqual(editor.input_value(), before)
            self.assertFalse(page.locator("#grwtsk-draft-text").is_visible())
            self.assertTrue(page.get_by_role("button", name="Restore saved draft", exact=True).is_disabled())
            page.get_by_role("button", name="Load saved draft", exact=True).click()
            page.get_by_text("Exact saved draft", exact=True).wait_for()
            page.get_by_text("Exact saved draft", exact=True).click()
            self.assertEqual(page.locator("#grwtsk-draft-before").inner_text(), before)
            self.assertEqual(page.locator("#grwtsk-draft-text").inner_text(), unfinished)
            self.assertEqual(editor.input_value(), before)
            page.get_by_role("button", name="Restore saved draft", exact=True).click()
            page.wait_for_function("document.querySelector('#grwtsk-working-text').value === " + json.dumps(unfinished))
            self.assertFalse(page.locator(".grwtsk-review").is_visible())
            self.assertTrue(page.get_by_role("button", name="Apply to private copy", exact=True, include_hidden=True).is_disabled())
            state = json.loads((Path(self.store) / "workspace.json").read_text())
            for key in ["proposals", "decisions", "links", "reconciliations"]:
                self.assertEqual(state.get(key, []), history_before.get(key, []))
            # The unfinished draft remains recoverable; a valid subsequent edit
            # still needs its own exact proposal and explicit private decision.
            editor.fill("Synthetic recovered draft completed for fresh review.")
            page.get_by_role("button", name="Review change", exact=True).click()
            page.locator(".grwtsk-review").wait_for(state="visible")
            self.assertEqual(page.locator(".grwtsk-review pre").nth(0).inner_text(), before)
            page.get_by_role("button", name="Cancel proposal", exact=True).click()
            page.get_by_role("button", name="Discard saved draft", exact=True).click()
            page.get_by_text("Saved draft discarded.", exact=False).wait_for()
            self.assertIsNone(self._saved_checkpoint())
        finally:
            context.close()

    def test_19_delayed_checkpoint_save_and_restore_preserve_intervening_typing(self):
        context, page, editor = self._new_draft_context()
        pending_save, pending_restore = [], []
        try:
            original = editor.input_value()
            older = "Synthetic older draft being checkpointed."
            newer = "Synthetic newer typing while checkpoint save is pending."
            page.route("**/__grwtsk/draft-save", lambda route: pending_save.append(route))
            editor.fill(older)
            page.get_by_role("button", name="Save draft", exact=True).click()
            page.wait_for_timeout(100)
            self.assertEqual(len(pending_save), 1)
            self.assertFalse(editor.is_disabled())
            editor.fill(newer)
            pending_save[0].continue_()
            page.get_by_text("Earlier draft saved privately; newer typing remains", exact=False).wait_for()
            self.assertEqual(editor.input_value(), newer)
            self.assertEqual(self._saved_checkpoint()["draft"], older)
            page.get_by_role("button", name="Load saved draft", exact=True).click()
            page.get_by_text("Exact saved draft", exact=True).wait_for()
            self.assertEqual(editor.input_value(), newer)
            self.assertTrue(page.get_by_role("button", name="Restore saved draft", exact=True).is_disabled())
            page.get_by_role("button", name="Discard unreviewed text", exact=True).click()
            self.assertEqual(editor.input_value(), original)
            page.route("**/__grwtsk/draft-restore", lambda route: pending_restore.append(route))
            page.get_by_role("button", name="Restore saved draft", exact=True).click()
            page.wait_for_timeout(100)
            self.assertEqual(len(pending_restore), 1)
            latest = "Synthetic typing after restore was requested."
            self.assertFalse(editor.is_disabled())
            editor.fill(latest)
            pending_restore[0].continue_()
            page.get_by_text("Saved draft was checked, but newer typing", exact=False).wait_for()
            self.assertEqual(editor.input_value(), latest)
            self.assertEqual(self._saved_checkpoint()["draft"], older)
            page.get_by_role("button", name="Discard saved draft", exact=True).click()
            page.get_by_text("Saved draft discarded.", exact=False).wait_for()
            self.assertEqual(editor.input_value(), latest)
            self.assertIsNone(self._saved_checkpoint())
        finally:
            context.close()

    def test_20_lost_checkpoint_acknowledgment_uses_manual_inspection_without_retry(self):
        context, page, editor = self._new_draft_context()
        saves = []
        try:
            wording = "Synthetic draft with a lost checkpoint acknowledgment."

            def lose_ack(route):
                response = route.fetch()
                self.assertEqual(response.status, 200)
                saves.append(response.json())
                route.abort("failed")

            page.route("**/__grwtsk/draft-save", lose_ack)
            editor.fill(wording)
            page.get_by_role("button", name="Save draft", exact=True).click()
            page.get_by_text("Private request unavailable; no new receipt was confirmed.", exact=False).wait_for()
            self.assertEqual(len(saves), 1)
            self.assertEqual(editor.input_value(), wording)
            self.assertEqual(self._saved_checkpoint()["draft"], wording)
            page.clock.install()
            page.clock.fast_forward(60000)
            self.assertEqual(len(saves), 1)
            page.get_by_role("button", name="Load saved draft", exact=True).click()
            page.get_by_text("Exact saved draft", exact=True).click()
            self.assertEqual(page.locator("#grwtsk-draft-text").inner_text(), wording)
            self.assertEqual(editor.input_value(), wording)
            self.assertEqual(len(saves), 1)
            page.get_by_role("button", name="Discard saved draft", exact=True).click()
            page.get_by_text("Saved draft discarded.", exact=False).wait_for()
            self.assertEqual(editor.input_value(), wording)
            self.assertIsNone(self._saved_checkpoint())
        finally:
            context.close()

    def test_21_explicit_replace_and_discard_send_exact_loaded_digest_and_generation(self):
        context, page, editor = self._new_draft_context()
        replaced, discarded = [], []
        try:
            editor.fill("Synthetic first saved draft for explicit replacement.")
            page.get_by_role("button", name="Save draft", exact=True).click()
            page.get_by_text("Draft saved privately for explicit recovery.", exact=False).wait_for()
            first = self._saved_checkpoint()
            first_state = json.loads((Path(self.store) / "workspace.json").read_text())

            def replace_request(route):
                replaced.append(route.request.post_data_json)
                route.continue_()

            page.route("**/__grwtsk/draft-save", replace_request)
            newer = "Synthetic explicit saved-draft replacement."
            editor.fill(newer)
            page.get_by_role("button", name="Replace saved draft", exact=True).click()
            page.get_by_text("Draft saved privately for explicit recovery.", exact=False).wait_for()
            page.wait_for_function("document.querySelector('#grwtsk-draft-text').textContent === " + json.dumps(newer))
            second = self._saved_checkpoint()
            self.assertEqual(len(replaced), 1)
            self.assertEqual(replaced[0]["expectedDigest"], first["digest"])
            self.assertEqual(replaced[0]["generation"], first_state["draftCheckpointGeneration"])
            self.assertNotEqual(second["digest"], first["digest"])
            state_before = json.loads((Path(self.store) / "workspace.json").read_text())

            def discard_request(route):
                discarded.append(route.request.post_data_json)
                route.continue_()

            page.route("**/__grwtsk/draft-discard", discard_request)
            page.get_by_role("button", name="Discard saved draft", exact=True).click()
            page.get_by_text("Saved draft discarded.", exact=False).wait_for()
            self.assertEqual(len(discarded), 1)
            self.assertEqual(discarded[0]["expectedDigest"], second["digest"])
            self.assertEqual(discarded[0]["generation"], state_before["draftCheckpointGeneration"])
            self.assertEqual(editor.input_value(), newer)
            state_after = json.loads((Path(self.store) / "workspace.json").read_text())
            for key in ["proposals", "decisions", "links", "reconciliations"]:
                self.assertEqual(state_after.get(key, []), state_before.get(key, []))
            self.assertEqual(state_after["draftCheckpoints"]["checkpoints"], [])
            self.assertEqual(state_after["draftCheckpointGeneration"], state_before["draftCheckpointGeneration"] + 1)
        finally:
            context.close()

    def test_22_changed_private_working_context_retains_checkpoint_but_blocks_restore(self):
        context, page, editor = self._new_draft_context()
        try:
            unfinished = "Synthetic recovery draft retained across a working-version change."
            editor.fill(unfinished)
            page.get_by_role("button", name="Save draft", exact=True).click()
            page.get_by_text("Draft saved privately for explicit recovery.", exact=False).wait_for()
            checkpoint = self._saved_checkpoint()
            changed = "Synthetic separately reviewed new working version makes recovery stale."
            editor.fill(changed)
            page.get_by_role("button", name="Review change", exact=True).click()
            page.locator(".grwtsk-review").wait_for(state="visible")
            page.get_by_role("button", name="Apply to private copy", exact=True).click()
            page.get_by_text("Applied to the private working copy.", exact=False).wait_for()
            page.get_by_role("button", name="Load saved draft", exact=True).click()
            page.get_by_text("Exact saved draft", exact=True).click()
            self.assertIn("stale", page.get_by_role("region", name="Saved unreviewed draft").inner_text())
            self.assertTrue(page.get_by_role("button", name="Restore saved draft", exact=True).is_disabled())
            self.assertEqual(editor.input_value(), changed)
            self.assertEqual(page.locator("#grwtsk-draft-text").inner_text(), unfinished)
            self.assertEqual(self._saved_checkpoint()["digest"], checkpoint["digest"])
            page.get_by_role("button", name="Discard saved draft", exact=True).click()
            page.get_by_text("Saved draft discarded.", exact=False).wait_for()
            self.assertEqual(editor.input_value(), changed)
        finally:
            context.close()

    def test_23_unadmitted_checkpoint_source_stays_ineligible_without_creating_rows(self):
        value = subprocess.check_output(["node", "--input-type=module", "-e", """
          import {loadSnapshot} from './scripts/chat_workspace.mjs';
          console.log(JSON.stringify({id:loadSnapshot().entries.find(e=>e.slot==='C01').id}));
        """], cwd=ROOT, text=True)
        identity = json.loads(value)["id"]
        state_file = Path(self.store) / "workspace.json"
        before = state_file.read_bytes() if state_file.exists() else None
        context = self.browser.new_context()
        try:
            page = context.new_page()
            page.goto(self.url + f"/huey/paragraph/{identity}")
            page.get_by_role("button", name="Grwtsk", exact=True).click()
            page.wait_for_function("!document.querySelector('#grwtsk-working-text').disabled")
            editor = page.get_by_label("Working paragraph (Markdown)")
            editor.fill("Synthetic unadmitted recovery draft that must remain unsaved.")
            self.assertTrue(page.get_by_role("button", name="Save draft", exact=True).is_disabled())
            page.get_by_role("button", name="Load saved draft", exact=True).click()
            page.get_by_text("Draft recovery is unavailable for this source/version.", exact=False).wait_for()
            self.assertTrue(page.get_by_role("button", name="Restore saved draft", exact=True).is_disabled())
            self.assertEqual(state_file.read_bytes() if state_file.exists() else None, before)
            self.assertEqual(editor.input_value(), "Synthetic unadmitted recovery draft that must remain unsaved.")
        finally:
            context.close()


    def test_24_lost_discard_acknowledgment_restores_unload_guard_until_manual_inspection(self):
        context, page, editor = self._new_draft_context()
        discards = []
        try:
            wording = "Synthetic saved draft whose discard acknowledgment will be lost."
            editor.fill(wording)
            page.get_by_role("button", name="Save draft", exact=True).click()
            page.get_by_text("Draft saved privately for explicit recovery.", exact=False).wait_for()

            def lose_discard(route):
                response = route.fetch()
                self.assertEqual(response.status, 200)
                discards.append(response.json())
                route.abort("failed")

            page.route("**/__grwtsk/draft-discard", lose_discard)
            page.get_by_role("button", name="Discard saved draft", exact=True).click()
            page.get_by_text("Private request unavailable; no new receipt was confirmed.", exact=False).wait_for()
            self.assertIsNone(self._saved_checkpoint())
            self.assertEqual(editor.input_value(), wording)
            self.assertTrue(page.get_by_role("button", name="Restore saved draft", exact=True).is_disabled())
            dialogs = []

            def keep_text(dialog):
                dialogs.append(dialog.type)
                dialog.dismiss()

            page.on("dialog", keep_text)
            try:
                with self.assertRaises(BrowserTimeout):
                    page.reload(timeout=1000, wait_until="domcontentloaded")
                self.assertEqual(dialogs, ["beforeunload"])
                self.assertEqual(editor.input_value(), wording)
            finally:
                page.remove_listener("dialog", keep_text)
            page.get_by_role("button", name="Load saved draft", exact=True).click()
            page.get_by_text("No saved unreviewed draft for this paragraph.", exact=False).wait_for()
            self.assertEqual(editor.input_value(), wording)
            page.clock.install()
            page.clock.fast_forward(60000)
            self.assertEqual(len(discards), 1)
            self.assertIsNone(self._saved_checkpoint())
            page.get_by_role("button", name="Discard unreviewed text", exact=True).click()
        finally:
            context.close()

    def test_25_lost_replace_acknowledgment_does_not_treat_old_matching_text_as_saved(self):
        context, page, editor = self._new_draft_context()
        replacements = []
        try:
            older = "Synthetic earlier checkpoint text retained in an outdated display."
            newer = "Synthetic later checkpoint text whose replacement response is lost."
            editor.fill(older)
            page.get_by_role("button", name="Save draft", exact=True).click()
            page.get_by_text("Draft saved privately for explicit recovery.", exact=False).wait_for()

            def lose_replacement(route):
                response = route.fetch()
                self.assertEqual(response.status, 200)
                replacements.append(response.json())
                route.abort("failed")

            page.route("**/__grwtsk/draft-save", lose_replacement)
            editor.fill(newer)
            page.get_by_role("button", name="Replace saved draft", exact=True).click()
            page.get_by_text("Private request unavailable; no new receipt was confirmed.", exact=False).wait_for()
            self.assertEqual(self._saved_checkpoint()["draft"], newer)
            self.assertEqual(editor.input_value(), newer)
            # Returning to the text of the earlier displayed checkpoint cannot
            # imply that text is still recoverable after an unknown mutation.
            editor.fill(older)
            self.assertTrue(page.get_by_role("button", name="Restore saved draft", exact=True).is_disabled())
            dialogs = []

            def keep_text(dialog):
                dialogs.append(dialog.type)
                dialog.dismiss()

            page.on("dialog", keep_text)
            try:
                with self.assertRaises(BrowserTimeout):
                    page.reload(timeout=1000, wait_until="domcontentloaded")
                self.assertEqual(dialogs, ["beforeunload"])
                self.assertEqual(editor.input_value(), older)
            finally:
                page.remove_listener("dialog", keep_text)
            page.get_by_role("button", name="Load saved draft", exact=True).click()
            page.wait_for_function("document.querySelector('#grwtsk-draft-text').textContent === " + json.dumps(newer))
            page.get_by_text("Exact saved draft", exact=True).click()
            self.assertEqual(page.locator("#grwtsk-draft-text").inner_text(), newer)
            self.assertEqual(editor.input_value(), older)
            page.clock.install()
            page.clock.fast_forward(60000)
            self.assertEqual(len(replacements), 1)
            page.get_by_role("button", name="Discard saved draft", exact=True).click()
            page.get_by_text("Saved draft discarded.", exact=False).wait_for()
            self.assertEqual(editor.input_value(), older)
            self.assertIsNone(self._saved_checkpoint())
        finally:
            context.close()


    def test_26_retained_checkpoint_recovery_survives_unavailable_source_catalog(self):
        context, page, editor = self._new_draft_context()
        index_reads, inspected = [], []
        try:
            before = editor.input_value()
            wording = "Synthetic retained recovery draft whose source catalog is unavailable after reload."
            editor.fill(wording)
            page.get_by_role("button", name="Save draft", exact=True).click()
            page.get_by_text("Draft saved privately for explicit recovery.", exact=False).wait_for()
            checkpoint = self._saved_checkpoint()
            state = json.loads((Path(self.store) / "workspace.json").read_text())
            generation = state["draftCheckpointGeneration"]
            page.route("**/__grwtsk/catalog", lambda route: route.abort("failed"))

            def retain_unavailable(route):
                inspected.append(route.request.url)
                route.fulfill(status=200, content_type="application/json", body=json.dumps({
                    "checkpoint": checkpoint, "compatibility": {"status": "unavailable", "reasons": ["SOURCE_UNAVAILABLE"]},
                    "eligible": False, "generation": generation,
                }))

            def read_real_index(route):
                response = route.fetch()
                self.assertEqual(response.status, 200)
                index_reads.append(response.json())
                route.fulfill(response=response)

            page.route("**/__grwtsk/draft?id=*", retain_unavailable)
            page.route("**/__grwtsk/draft-index", read_real_index)
            page.reload()
            page.get_by_role("button", name="Grwtsk", exact=True).click()
            page.get_by_role("button", name="Find saved drafts", exact=True).click()
            page.get_by_role("button", name="Inspect saved draft", exact=True).wait_for()
            self.assertEqual(len(index_reads), 1)
            self.assertEqual(index_reads[0], {"generation": generation, "checkpoints": [
                {"target": checkpoint["target"], "createdAt": checkpoint["createdAt"]}
            ]})
            encoded_index = json.dumps(index_reads[0])
            for private_value in [before, wording, checkpoint["id"], checkpoint["digest"], checkpoint["beforeDigest"],
                                  checkpoint["sourceVersion"], checkpoint["baseVersion"]]:
                self.assertNotIn(private_value, encoded_index)
            page.get_by_role("button", name="Inspect saved draft", exact=True).click()
            page.get_by_text("Saved draft inspected privately.", exact=False).wait_for()
            page.get_by_text("Exact saved draft", exact=True).click()
            self.assertEqual(len(inspected), 1)
            self.assertEqual(page.locator("#grwtsk-draft-before").inner_text(), before)
            self.assertEqual(page.locator("#grwtsk-draft-text").inner_text(), wording)
            recovery = page.get_by_role("region", name="Saved unreviewed draft")
            self.assertIn("unavailable", recovery.inner_text())
            for saved_version in [checkpoint["sourceVersion"], checkpoint["baseVersion"], checkpoint["revision"]]:
                self.assertIn(saved_version, recovery.inner_text())
            self.assertTrue(editor.is_disabled())
            self.assertEqual(editor.input_value(), "")
            self.assertTrue(page.get_by_role("button", name="Restore saved draft", exact=True).is_disabled())
            self.assertNotIn(wording, page.locator("#book").inner_text())
            self.assertEqual(self._saved_checkpoint()["digest"], checkpoint["digest"])
            # Disposal remains an explicit local action even without current
            # source; it cannot amend immutable history or substitute old text.
            page.get_by_role("button", name="Discard saved draft", exact=True).click()
            page.get_by_text("Saved draft discarded.", exact=False).wait_for()
            self.assertIsNone(self._saved_checkpoint())
            self.assertEqual(editor.input_value(), "")
            retained = json.loads((Path(self.store) / "workspace.json").read_text())
            for key in ["proposals", "decisions", "links", "reconciliations"]:
                self.assertEqual(retained.get(key, []), state.get(key, []))
        finally:
            context.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
