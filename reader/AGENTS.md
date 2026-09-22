# Reader implementation scope

Follow root AGENTS and `planning/pre-release.md`. Target `pre-release`; do not
promote the reader or manuscript to main as a side effect of UI work.

Preserve the canonical manuscript bytes. All served text must pass the explicit
content allowlist and digest checks. Missing chapters/claims remain missing;
no private-source discovery, upload, invented narration or evidence certification.
No raw medical files, secrets, protected ending previews, analytics, external
fonts, deployment configuration or replication activation belong in this app.

Keep the prose in a centered serif column, gray-dot chapter rail and opposite
paragraph-evidence margin. Provide keyboard/touch access wherever hover is used.
Do not add a brand. Browser SpeechSynthesis is not programmatic Apple VoiceOver.
No autoplay or hidden online TTS fallback; local-voice classification is reported
by the browser, not independently verified by the application.

Run Node tests, content generation, actual Vite build when dependencies are
available, and browser checks. Distinguish in-memory/mocked tests from HTTP,
real OS voices and native screen-reader testing. Record actual limitations.
#314 owns substantive claim mapping; #315 owns outstanding dependency/runtime
and native browser checks. Neither is resolved by a successful software test.
