"""In-memory Chromium regression tests; synthetic chapters and mocked speech.

This tests the real DOM/CSS/client modules, not Vite transport or audible output.
Run: python reader/tests/playback_browser_test.py (requires Playwright/Chromium).
"""
import os
from pathlib import Path
import re
import shutil
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SPEECH = """
const voice={name:'Local test voice',voiceURI:'local',lang:'en-US',localService:true};
class TestSynth extends EventTarget {
 constructor(){super();this.spoken=[];}
 getVoices(){return [voice];}
 cancel(){}
 speak(u){this.spoken.push(u);u.onstart?.();}
}
window.__speech=new TestSynth();
Object.defineProperty(window,'speechSynthesis',{value:window.__speech,configurable:true});
Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(t){this.text=t;}},configurable:true});
"""

def fixture():
    chapters = []
    for n in range(1, 4):
        blocks = []
        for p in range(1, 21):
            text = f'Paragraph {p}. ' + ('Synthetic prose for testing chapter navigation and playback. ' * 3)
            blocks.append(dict(type='paragraph', id=f'C{n:02}-p{p:04}', chapterId=f'C{n:02}', number=p,
                label=f'{n}:{p}', text=text, tokens=[dict(type='text', text=text)],
                sourceUrl='https://example.com/source', startLine=p, endLine=p,
                evidence=dict(coverage='pending', claims=[], referenceIds=[], mappingIssue='https://example.com/mapping')))
        chapters.append(dict(id=f'C{n:02}', label=str(n), title=f'Synthetic chapter {n}', movement='Preamble',
            status='admitted', blob=str(n)*40, blocks=blocks, paragraphCount=20,
            admission='https://example.com/admission'))
    return dict(schemaVersion=1, title='Synthetic test book', author='Fixture', notice='Test fixture only.', chapters=chapters, sources=[])

class PlaybackTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(headless=True,
            executable_path=os.environ.get('HUEY_READER_BROWSER') or shutil.which('chromium'))

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport=dict(width=1440, height=1000), reduced_motion='reduce')
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.load(fixture())

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def load(self, data):
        self.page.goto('about:blank')
        html = (ROOT/'index.html').read_text()
        html = re.sub(r'<link rel="stylesheet"[^>]+>', '', html)
        html = re.sub(r'<script type="module"[^>]+></script>', '', html)
        self.page.set_content(html)
        self.page.add_style_tag(content=(ROOT/'src/style.css').read_text())
        self.page.add_script_tag(content=SPEECH)
        self.page.evaluate('(data)=>{window.fetch=async()=>new Response(JSON.stringify(data));}', data)
        modules = []
        for name in ['text.mjs', 'speech.mjs', 'main.mjs']:
            source = (ROOT/'src'/name).read_text()
            source = re.sub(r'^import .*?;\n', '', source, flags=re.M)
            source = re.sub(r'^export ', '', source, flags=re.M)
            source = source.replace("new URL('./data/book.json', document.baseURI)", "'./data/book.json'")
            modules.append(source)
        self.page.add_script_tag(content='(function(){\n'+'\n'.join(modules)+'\n})();')
        self.page.locator('.paragraph').first.wait_for()
        self.page.wait_for_timeout(80)

    def seek(self, fraction):
        box = self.page.locator('#chapter-progress').bounding_box()
        self.page.mouse.click(box['x']+box['width']*fraction, box['y']+box['height']/2)
        self.page.wait_for_timeout(80)

    def test_01_title_only_top_and_bottom_geometry(self):
        for width, height in [(1440,1000),(1024,800),(768,1024),(390,844),(320,720),(720,500)]:
            self.page.set_viewport_size(dict(width=width,height=height))
            self.page.wait_for_timeout(100)
            header = self.page.locator('.reader-title')
            self.assertEqual(header.inner_text(), 'Synthetic chapter 1')
            self.assertEqual(header.locator('button, input, select, summary').count(), 0)
            title = self.page.locator('#current-title').bounding_box()
            self.assertAlmostEqual(title['x']+title['width']/2,width/2,delta=2)
            bar = self.page.locator('.chapter-progress-track').bounding_box()
            self.assertEqual(bar['height'],3)
            self.assertAlmostEqual(bar['y']+bar['height'],height,delta=1)
            self.assertAlmostEqual(bar['width'],width,delta=1)
            dock = self.page.locator('.reader-controls').bounding_box()
            self.assertAlmostEqual(dock['y']+dock['height'],height,delta=1)
            self.assertGreaterEqual(self.page.locator('#play').bounding_box()['y'], dock['y'])
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)

    def test_02_pointer_seek_selects_word_and_does_not_autoplay(self):
        self.seek(.5)
        self.assertTrue(self.page.get_by_role('button',name='Resume',exact=True).is_visible())
        self.assertEqual(self.page.evaluate('__speech.spoken.length'),0)
        self.assertTrue(self.page.locator('#current-location').inner_text().startswith('1:'))
        self.assertAlmostEqual(float(self.page.locator('#chapter-progress').input_value()),500,delta=20)
        self.page.get_by_role('button',name='Resume',exact=True).click()
        self.assertEqual(self.page.evaluate('__speech.spoken.length'),1)
        self.assertTrue(self.page.get_by_role('button',name='Pause',exact=True).is_visible())

    def test_03_drag_while_playing_only_resumes_on_release(self):
        self.page.get_by_role('button',name='Play',exact=True).click()
        box=self.page.locator('#chapter-progress').bounding_box()
        y=box['y']+12
        self.page.mouse.move(box['x']+10,y);self.page.mouse.down()
        self.page.mouse.move(box['x']+box['width']*.6,y,steps=8)
        self.assertEqual(self.page.evaluate('__speech.spoken.length'),1)
        self.page.mouse.up()
        self.assertEqual(self.page.evaluate('__speech.spoken.length'),2)
        self.assertTrue(self.page.get_by_role('button',name='Pause',exact=True).is_visible())
        before=self.page.locator('#chapter-progress').input_value()
        self.page.evaluate('__speech.spoken[0].onend();__speech.spoken[0].onboundary({charIndex:1})')
        self.assertEqual(self.page.locator('#chapter-progress').input_value(),before)

    def test_04_paused_seek_and_keyboard_endpoints(self):
        self.page.get_by_role('button',name='Play',exact=True).click()
        self.page.get_by_role('button',name='Pause',exact=True).click()
        self.seek(.7)
        self.assertEqual(self.page.evaluate('__speech.spoken.length'),1)
        slider=self.page.get_by_role('slider',name='Seek within chapter')
        slider.focus();self.page.keyboard.press('End')
        self.assertEqual(slider.input_value(),'1000')
        self.assertEqual(self.page.locator('#current-location').inner_text(),'1:20')
        self.assertEqual(self.page.evaluate('__speech.spoken.length'),1)
        self.page.keyboard.press('Home')
        self.assertEqual(slider.input_value(),'0')
        self.assertEqual(self.page.locator('#current-location').inner_text(),'1:1')
        self.page.keyboard.press('ArrowRight')
        self.assertIn('estimated',slider.get_attribute('aria-valuetext'))

    def test_05_chapter_navigation_resets_timeline_and_title(self):
        self.seek(.8)
        self.page.locator('.chapter-link[data-chapter="C02"]').click()
        self.page.wait_for_timeout(100)
        self.assertEqual(self.page.locator('#current-title').inner_text(),'Synthetic chapter 2')
        self.assertEqual(self.page.locator('#chapter-progress').input_value(),'0')
        self.seek(.5)
        self.assertTrue(self.page.locator('#current-location').inner_text().startswith('2:'))
        self.assertEqual(self.page.locator('.chapter-link[aria-current]').get_attribute('data-chapter'),'C02')

    def test_06_progress_uses_speech_boundaries_and_rate_estimates(self):
        self.page.get_by_role('button',name='Play',exact=True).click()
        self.page.evaluate('__speech.spoken[0].onboundary({charIndex:60})')
        self.assertGreater(float(self.page.locator('#chapter-progress').input_value()),0)
        timer=self.page.locator('#chapter-timer').inner_text()
        self.assertTrue(timer.startswith('≈'))
        self.page.locator('summary').click()
        self.page.locator('#rate').fill('1.5')
        self.assertNotEqual(self.page.locator('#chapter-timer').inner_text(),timer)
        self.assertEqual(self.page.evaluate('__speech.spoken.length'),1)

    def test_07_options_open_upwards_and_evidence_dialog_still_works(self):
        self.page.set_viewport_size(dict(width=390,height=844))
        self.page.locator('summary').click()
        self.page.wait_for_timeout(100)
        panel=self.page.locator('.options-panel').bounding_box()
        summary=self.page.locator('summary').bounding_box()
        self.assertLessEqual(panel['y']+panel['height'],summary['y'])
        self.assertGreaterEqual(panel['y'],0)
        self.page.keyboard.press('Escape')
        self.page.locator('.paragraph-number').first.click()
        self.page.get_by_role('dialog').wait_for(state='visible')
        self.assertIn('Claim mapping pending',self.page.locator('#dialog-body').inner_text())
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.evaluate('document.activeElement.className'),'paragraph-number')

    def test_08_text_is_not_hidden_behind_bottom_controls_at_end(self):
        self.page.set_viewport_size(dict(width=390,height=844))
        self.page.evaluate('window.scrollTo(0,document.documentElement.scrollHeight)')
        self.page.wait_for_timeout(100)
        last=self.page.locator('.prose').last.bounding_box()
        dock=self.page.locator('.reader-controls').bounding_box()
        self.assertLess(last['y']+last['height'],dock['y'])

    def test_09_long_index_remains_scrollable_above_dock(self):
        data=fixture()
        for n in range(4,18):
            data['chapters'].append(dict(id=f'C{n:02}',label=str(n),title=f'Unavailable fixture {n}',
                status='unavailable',blocks=[],paragraphCount=0,workIssue='https://example.com/work'))
        self.page.set_viewport_size(dict(width=1440,height=500))
        self.load(data)
        rail=self.page.locator('.chapter-index').bounding_box()
        dock=self.page.locator('.reader-controls').bounding_box()
        self.assertLessEqual(rail['y']+rail['height'],dock['y'])
        self.assertEqual(self.page.locator('#chapter-list').evaluate('(e)=>getComputedStyle(e).overflowY'),'auto')
        self.page.locator('.chapter-link').last.focus()
        last=self.page.locator('.chapter-link').last.bounding_box()
        self.assertLessEqual(last['y']+last['height'],rail['y']+rail['height']+1)

    def test_10_touch_tap_scrubs_without_starting_speech(self):
        self.context.close()
        self.context=self.browser.new_context(viewport=dict(width=390,height=844),has_touch=True,reduced_motion='reduce')
        self.page=self.context.new_page()
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.load(fixture())
        box=self.page.locator('#chapter-progress').bounding_box()
        self.page.touchscreen.tap(box['x']+box['width']*.6,box['y']+12)
        self.assertAlmostEqual(float(self.page.locator('#chapter-progress').input_value()),600,delta=30)
        self.assertEqual(self.page.evaluate('__speech.spoken.length'),0)

if __name__=='__main__':
    unittest.main(verbosity=2)
