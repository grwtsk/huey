/** Source-free end-to-end demonstration; never reads or changes manuscript. */
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChatWorkspace } from './chat_workspace.mjs';
import { seal } from './literary_model.mjs';
import { parseEditorialMarkdown } from './editorial_markdown.mjs';

const dir = mkdtempSync(join(tmpdir(), 'huey-chat-demo-'));
try {
  const root = join(dir, 'synthetic-repository'); mkdirSync(root);
  const id = 'he_00000000-0000-4000-8000-000000000001';
  const raw = 'The blue cup stood on the table.';
  const version = seal({ id, kind: 'Paragraph', state: parseEditorialMarkdown(raw)[0].state }).version;
  const snapshot = () => ({ basis: 'synthetic-demo-only', revision: 'synthetic-demo-only', slots: [{ key: 'demo', status: 'mapped' }],
    entries: [{ id, version, raw, slot: 'demo', source: { path: 'synthetic-only', lines: { start: 1, end: 1 } }, scopeRefs: [] }] });
  const ws = new ChatWorkspace({ root, store: join(dir, 'private'), snapshot });
  const before = ws.read(id);
  const op = ws.propose({ id, baseVersion: before.version, beforeDigest: before.rawDigest, after: 'The blue cup sat on the table.',
    actor: 'synthetic-demo-host', session: 'synthetic-demo', requestRef: 'synthetic-test-request', key: 'demo-operation' });
  const preview = ws.review(op.id);
  const receipt = ws.decide({ operationId: op.id, reviewDigest: preview.reviewDigest, approvalRef: 'synthetic-test-approval-only', status: 'applied-private' });
  const reopened = new ChatWorkspace({ root, store: join(dir, 'private'), snapshot });
  reopened.link(op.id, 'https://github.com/grwtsk/huey/issues/358');
  console.log(JSON.stringify({ scope: 'synthetic demonstration only; no manuscript read or changed', before: before.raw, preview: preview.diff,
    receipt, afterRestart: reopened.read(id).raw, search: reopened.search({ slot: 'demo', query: 'sat' }).total,
    sourceUnchanged: snapshot().entries[0].raw === before.raw, handoff: reopened.handoff(op.id) }, null, 2));
} finally { rmSync(dir, { recursive: true, force: true }); }
