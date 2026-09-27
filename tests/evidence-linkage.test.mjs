import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, copyFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEvidenceLinkage, indexEvidenceLinkage, parseLinkageJson, loadEvidenceLinkage, loadKnownTargets } from '../scripts/evidence_linkage.mjs';
import { parseEditorialMarkdown } from '../scripts/editorial_markdown.mjs';
import { seal } from '../scripts/literary_model.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const eid = n => `HUEY-EV-${uuid(n)}`;
const clone = value => structuredClone(value);
const tuple = () => ({ chapterId: 'C01', chapterBlob: 'a'.repeat(40), ordinal: 1,
  rawSha256: sha('Synthetic paragraph.'), entityId: `he_${uuid(1)}`, entityVersion: `hev1:${'b'.repeat(64)}` });

function certificate() {
  return {
    schema_version: 1, evidence_id: eid(1), certificate_version: 1,
    classification: 'PRIVATE_SENSITIVE', public_title: 'Synthetic certificate only', evidence_type: 'synthetic document',
    custody: { raw_custody: 'private_repository', public_raw_path: null, public_derivative_paths: [] },
    integrity: { mode: 'private_salted_commitment', raw_sha256: null, commitment_scheme: 'sha256-salted-v1', public_commitment: 'c'.repeat(64) },
    transcription: { status: 'machine_typed_unreviewed', public: false, method: ['Synthetic method'], path: null, sha256_or_commitment: null },
    description: { public: false, path: null, status: 'withheld' },
    relationships: [{ target: 'SOC-C001', relationship: 'context', locator: 'Synthetic public page reference',
      contribution: 'Synthetic contextual contribution.', does_not_establish: 'No factual conclusion or actual source.' }],
    review: { machine: 'Synthetic fixture', human: null, source_authenticated: false, public_disclosure_reviewed: true },
    limits: ['Synthetic only; not an admission.'], status: 'active',
  };
}

function fixture() {
  const cert = certificate(), bytes = JSON.stringify(cert), paragraph = tuple();
  const ledger = { schema: 'huey.evidence-linkage.v1', links: [{
    id: `hl_${uuid(1)}`, certificate: { evidenceId: eid(1), version: 1, sha256: sha(bytes) }, relationshipIndex: 0,
    target: { registry: 'core', id: 'SOC-C001', sha256: 'd'.repeat(64) }, paragraph,
    mapping: { kind: 'context', fidelity: 'unknown', limits: 'Synthetic mapping remains unknown.' },
    dependence: { status: 'unknown', sourceFamily: null, limits: 'Independence has not been assessed.' },
    review: { state: 'pending', reference: null },
  }] };
  const context = { certificates: new Map([[eid(1), bytes]]), knownTargets: new Map([['core/SOC-C001', 'd'.repeat(64)]]),
    paragraphBindings: { schema: 'huey.legacy-paragraph-bindings.v1', bindings: [clone(paragraph)] } };
  return { ledger, context, cert };
}
function installCertificate(f, cert = f.cert) {
  const bytes = JSON.stringify(cert);
  f.context.certificates.set(cert.evidence_id, bytes);
  f.ledger.links[0].certificate = { evidenceId: cert.evidence_id, version: cert.certificate_version, sha256: sha(bytes) };
}
const validate = f => validateEvidenceLinkage(f.ledger, f.context);

test('empty public ledger stays empty and indexes do not infer no evidence', () => {
  const f = fixture(); f.ledger.links = [];
  assert.deepEqual(indexEvidenceLinkage(f.ledger, f.context), { schema: 'huey.evidence-linkage-index.v1',
    bySource: {}, byTarget: {}, byParagraph: {}, unlocated: [] });
});

test('one ledger supplies source, existing proposition and exact paragraph views without mutation', () => {
  const f = fixture(), before = clone(f.ledger), out = indexEvidenceLinkage(f.ledger, f.context), row = f.ledger.links[0];
  assert.deepEqual(out.bySource[eid(1)], [row.id]);
  assert.deepEqual(out.byTarget['core/SOC-C001'], [row.id]);
  assert.deepEqual(out.byParagraph[`${row.paragraph.entityId}/${row.paragraph.entityVersion}`], [row.id]);
  assert.deepEqual(f.ledger, before);
});

for (const relation of ['supports', 'contradicts', 'limits', 'context', 'duplicate', 'same_source_family', 'supersedes', 'provenance_only', 'unresolved']) {
  test(`retains ${relation} with its separate contribution and limits`, () => {
    const f = fixture(); f.cert.relationships[0].relationship = relation;
    if (relation === 'duplicate' || relation === 'same_source_family') f.ledger.links[0].dependence = {
      status: relation === 'duplicate' ? 'copied' : 'same-source-family', sourceFamily: `hsf_${uuid(7)}`, limits: 'Same synthetic source family.' };
    installCertificate(f);
    assert.equal(validate(f), f.ledger);
    assert.equal(JSON.parse(f.context.certificates.get(eid(1))).relationships[0].relationship, relation);
    assert.equal(f.ledger.links[0].review.state, 'pending');
  });
}

for (const fidelity of ['exact', 'lossy', 'approximate', 'unsupported', 'unknown']) test(`mapping fidelity ${fidelity} remains an explicit declaration`, () => {
  const f = fixture(); f.ledger.links[0].mapping.fidelity = fidelity;
  assert.equal(validate(f).links[0].mapping.fidelity, fidelity);
});

for (const fidelity of ['unknown', 'unsupported']) test(`${fidelity} may remain unlocated without inventing a literary version`, () => {
  const f = fixture(); f.ledger.links[0].paragraph = null; f.ledger.links[0].mapping.fidelity = fidelity;
  assert.deepEqual(indexEvidenceLinkage(f.ledger, f.context).unlocated, [f.ledger.links[0].id]);
});

const bad = [
  ['missing ID', f => { delete f.ledger.links[0].id; }, /link-fields/],
  ['unknown ledger field', f => { f.ledger.privatePath = 'SYNTHETIC_PRIVATE_SENTINEL'; }, /ledger-fields/],
  ['private locator field', f => { f.ledger.links[0].locator = 'SYNTHETIC_PRIVATE_SENTINEL'; }, /link-fields/],
  ['raw fingerprint field', f => { f.ledger.links[0].certificate.rawSha256 = 'a'.repeat(64); }, /certificate-pin-fields/],
  ['unknown mapping field', f => { f.ledger.links[0].mapping.approved = true; }, /mapping-fields/],
  ['unknown dependence field', f => { f.ledger.links[0].dependence.independent = true; }, /dependence-fields/],
  ['unknown review field', f => { f.ledger.links[0].review.approved = true; }, /review-fields/],
  ['stale certificate bytes', f => { f.context.certificates.set(eid(1), f.context.certificates.get(eid(1)) + '\n'); }, /stale-certificate-bytes/],
  ['stale certificate version', f => { f.ledger.links[0].certificate.version++; }, /stale-certificate-version/],
  ['missing certificate', f => { f.context.certificates.clear(); }, /missing-certificate/],
  ['out of range relationship', f => { f.ledger.links[0].relationshipIndex = 1; }, /relationship-index/],
  ['unknown target', f => { f.ledger.links[0].target.id = 'SOC-C999'; }, /unknown-or-stale-target/],
  ['stale target registry', f => { f.ledger.links[0].target.sha256 = '0'.repeat(64); }, /unknown-or-stale-target/],
  ['different certificate target', f => { f.cert.relationships[0].target = 'SOC-C002'; installCertificate(f); }, /certificate-target-mismatch/],
  ['stale paragraph digest', f => { f.ledger.links[0].paragraph.rawSha256 = '0'.repeat(64); }, /unknown-or-stale-paragraph/],
  ['stale paragraph version', f => { f.ledger.links[0].paragraph.entityVersion = `hev1:${'0'.repeat(64)}`; }, /unknown-or-stale-paragraph/],
  ['ordinal only fallback', f => { delete f.ledger.links[0].paragraph.entityId; }, /paragraph-fields/],
  ['missing contribution', f => { f.cert.relationships[0].contribution = ' '; installCertificate(f); }, /certificate-relationship/],
  ['missing source limits', f => { f.cert.relationships[0].does_not_establish = ''; installCertificate(f); }, /certificate-relationship/],
  ['missing mapping limits', f => { f.ledger.links[0].mapping.limits = ''; }, /mapping/],
  ['missing dependence limits', f => { f.ledger.links[0].dependence.limits = ''; }, /dependence/],
  ['exact without paragraph', f => { f.ledger.links[0].paragraph = null; f.ledger.links[0].mapping.fidelity = 'exact'; }, /unlocated-mapping/],
  ['assessed without paragraph', f => { f.ledger.links[0].paragraph = null; f.ledger.links[0].review = { state: 'assessed', reference: 'https://github.com/grwtsk/huey/issues/363' }; }, /unlocated-review/],
  ['private review URL', f => { f.ledger.links[0].review = { state: 'assessed', reference: 'https://example.invalid/SYNTHETIC_PRIVATE_SENTINEL' }; }, /review-reference/],
  ['approval status', f => { f.ledger.links[0].review.state = 'approved'; }, /review-state/],
  ['dependent without family', f => { f.ledger.links[0].dependence.status = 'copied'; }, /dependent-source-family-required/],
  ['duplicate called independent', f => { f.cert.relationships[0].relationship = 'duplicate'; f.ledger.links[0].dependence.status = 'reported-independent'; installCertificate(f); }, /duplicate-is-dependent/],
  ['family called independent', f => { f.cert.relationships[0].relationship = 'same_source_family'; f.ledger.links[0].dependence.status = 'reported-independent'; installCertificate(f); }, /source-family-is-dependent/],
  ['duplicate assertion with fresh link ID', f => { const row = clone(f.ledger.links[0]); row.id = `hl_${uuid(2)}`; f.ledger.links.push(row); }, /duplicate-link/],
];
for (const [name, mutate, reason] of bad) test(`rejects ${name} without leaking submitted content`, () => {
  const f = fixture(); mutate(f);
  assert.throws(() => validate(f), error => reason.test(error.message) && !error.message.includes('SYNTHETIC_PRIVATE_SENTINEL'));
});

for (const status of ['superseded', 'blocked', 'withdrawn_public_derivative']) test(`${status} certificate cannot retain an assessed current mapping`, () => {
  const f = fixture(); f.cert.status = status; installCertificate(f);
  f.ledger.links[0].review = { state: 'assessed', reference: 'https://github.com/grwtsk/huey/issues/363' };
  assert.throws(() => validate(f), /inactive-certificate-needs-review/);
  f.ledger.links[0].review.state = 'needs-reassessment';
  assert.equal(validate(f), f.ledger);
});

test('markup-only raw change can retain inscription version while invalidating evidence binding', () => {
  const f = fixture(), before = 'The *same*.', after = 'The **same**.', id = tuple().entityId;
  const version = text => seal({ id, kind: 'Paragraph', state: parseEditorialMarkdown(text)[0].state }).version;
  assert.equal(version(before), version(after));
  f.ledger.links[0].paragraph.rawSha256 = sha(before);
  f.ledger.links[0].paragraph.entityVersion = version(before);
  f.context.paragraphBindings.bindings[0] = { ...f.ledger.links[0].paragraph, rawSha256: sha(after) };
  assert.throws(() => validate(f), /unknown-or-stale-paragraph/);
});

test('distinct evidence delivery IDs and equal content do not establish independent corroboration', () => {
  const f = fixture(), other = clone(f.cert); other.evidence_id = eid(2);
  const bytes = JSON.stringify(other), row = clone(f.ledger.links[0]); row.id = `hl_${uuid(2)}`;
  row.certificate = { evidenceId: eid(2), version: 1, sha256: sha(bytes) };
  f.context.certificates.set(eid(2), bytes); f.ledger.links.push(row);
  validate(f);
  assert.deepEqual(f.ledger.links.map(link => link.dependence.status), ['unknown', 'unknown']);
  assert.equal(Object.keys(indexEvidenceLinkage(f.ledger, f.context).bySource).length, 2);
});

for (const raw of ['{"links":[],"links":[]}', '{"x":{"a":1,"a":2}}', '{"a":1,"\\u0061":2}']) test(`duplicate keys rejected: ${raw}`, () => {
  assert.throws(() => parseLinkageJson(raw), /duplicate-json-key/);
});
for (const raw of ['{"a":1,}', '[1,]', '{"a":01}', '1e999', '{"a":NaN}', '{"a":"unterminated}', '{} {}']) test(`invalid JSON rejected: ${raw}`, () => {
  assert.throws(() => parseLinkageJson(raw), /invalid-public-json/);
});
test('strict parser accepts escaped strings and separate object keys', () => {
  const value = [{ x: 'quote " and slash \\ and newline\n', n: -2.3e4 }, { x: null, y: [true, false] }];
  assert.deepEqual(parseLinkageJson(JSON.stringify(value)), value);
});

async function temporaryPublicFixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'huey-linkage-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const write = async (path, bytes) => { const full = resolve(root, path); await mkdir(dirname(full), { recursive: true }); await writeFile(full, bytes); };
  for (const name of ['verify_public_evidence.py', 'certificate.schema.json', 'private-manifest.schema.json']) {
    const path = `planning/evidence-intake/${name}`; await mkdir(dirname(resolve(root, path)), { recursive: true });
    await copyFile(resolve(ROOT, path), resolve(root, path));
  }
  // Public registry fixtures retain the actual complete schemas. The certificate
  // relationship and paragraph remain synthetic and never enter the real ledger.
  for (const path of ['claims.tsv', 'ancillary-r02/claims.tsv', 'authority-q03/claims.tsv', 'incident-register/register.json', 'care-law/revision.md']) {
    await write(`planning/standard-of-care/${path}`, await readFile(resolve(ROOT, `planning/standard-of-care/${path}`)));
  }
  await write('evidence/README.md', 'Synthetic public fixture.\n');
  const f = fixture(), known = loadKnownTargets(root);
  f.ledger.links[0].target.sha256 = known.get('core/SOC-C001');
  const header = ['evidence_id', 'classification', 'public_title', 'evidence_type', 'raw_custody', 'certificate', 'public_raw_or_derivative', 'transcription_public', 'review_state', 'related_issues', 'status'];
  const row = [eid(1), f.cert.classification, f.cert.public_title, f.cert.evidence_type, 'private_repository', `evidence/certificates/${eid(1)}.json`, '', 'false', 'machine_checked;human_pending', 'SOC-C001', 'active'];
  await write(`evidence/certificates/${eid(1)}.json`, JSON.stringify(f.cert));
  await write('evidence/index.tsv', `${header.join('\t')}\n${row.join('\t')}\n`);
  await write('planning/evidence-linkage/ledger.json', JSON.stringify(f.ledger));
  return { ...f, root, write, options: { loadBindings: async () => clone(f.context.paragraphBindings) } };
}

test('nonempty loader executes real public certificate/schema/index checks before linking', async t => {
  const f = await temporaryPublicFixture(t), result = await loadEvidenceLinkage(f.root, f.options);
  assert.equal(result.ledger.links.length, 1);
  assert.equal(result.context.knownTargets.size, 640);
  const index = await readFile(resolve(f.root, 'evidence/index.tsv'), 'utf8');
  await f.write('evidence/index.tsv', index.replace('machine_checked;human_pending', 'machine_checked;human_reviewed'));
  await assert.rejects(loadEvidenceLinkage(f.root, f.options), /public-evidence-check-failed/);
});

test('nonempty loader rejects forbidden private certificate fields via existing verifier', async t => {
  const f = await temporaryPublicFixture(t); f.cert.private_path = 'SYNTHETIC_PRIVATE_SENTINEL';
  await f.write(`evidence/certificates/${eid(1)}.json`, JSON.stringify(f.cert));
  await assert.rejects(loadEvidenceLinkage(f.root, f.options), /public-evidence-check-failed/);
});

test('loader rejects duplicate ledger keys before inspecting certificates or manuscript', async t => {
  const f = await temporaryPublicFixture(t);
  await f.write('planning/evidence-linkage/ledger.json', '{"schema":"huey.evidence-linkage.v1","links":[],"links":[]}');
  await assert.rejects(loadEvidenceLinkage(f.root, { loadBindings: () => { throw new Error('Unexpected manuscript read'); } }), /duplicate-json-key/);
});

for (const [path, text] of [
  ['claims.tsv', 'claim_id\ttarget\tverification_issue\tsupport_level\nSOC-C001\n'],
  ['incident-register/register.json', '{"entries":[[999]]}'],
  ['care-law/revision.md', 'Synthetic only. <!-- C999 | testimony | 178 | S00 -->\n'],
]) test(`target loader rejects truncated ${path}`, async t => {
  const f = await temporaryPublicFixture(t); await f.write(`planning/standard-of-care/${path}`, text);
  assert.throws(() => loadKnownTargets(f.root), /registry/);
});
