import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadParagraphBindings } from './paragraph_bindings.mjs';
import { validateParagraphBindings } from '../reader/src/paragraphs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const EVIDENCE = new RegExp(`^HUEY-EV-${UUID}$`), LINK = new RegExp(`^hl_${UUID}$`);
const FAMILY = new RegExp(`^hsf_${UUID}$`), HASH = /^[0-9a-f]{64}$/;
const RELATIONS = ['supports', 'contradicts', 'limits', 'context', 'duplicate', 'same_source_family', 'supersedes', 'provenance_only', 'unresolved'];
const TARGETS = ['core', 'ancillary', 'authority', 'incidents', 'care-law'];
const PARAGRAPH_FIELDS = ['chapterId', 'chapterBlob', 'ordinal', 'rawSha256', 'entityId', 'entityVersion'];
const fail = reason => { throw new Error(`EVIDENCE_LINKAGE: ${reason}`); };
const check = (condition, reason) => { if (!condition) fail(reason); };
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const reference = value => typeof value === 'string' && /^https:\/\/github\.com\/grwtsk\/huey\/(?:issues|pull)\/[1-9][0-9]*(?:#[A-Za-z0-9_-]+)?$/.test(value);

function shape(value, fields, reason) {
  check(value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value)), reason);
  const keys = Reflect.ownKeys(value);
  check(keys.length === fields.length && keys.every(key => fields.includes(key)), reason);
  check(keys.every(key => Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')), reason);
}

export function parseLinkageJson(bytes) {
  check(typeof bytes === 'string' || Buffer.isBuffer(bytes), 'certificate-bytes-required');
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(bytes));
    let position = 0;
    const whitespace = () => { while (/[\t\r\n ]/.test(text[position] ?? '') && position < text.length) position++; };
    const string = () => {
      check(text[position] === '"', 'invalid-public-json');
      const start = position++;
      while (position < text.length) {
        if (text[position++] === '"') return JSON.parse(text.slice(start, position));
        if (text[position - 1] === '\\') position++;
      }
      fail('invalid-public-json');
    };
    const value = () => {
      whitespace();
      const token = text[position];
      if (token === '{' || token === '[') {
        const object = token === '{', end = object ? '}' : ']', seen = new Set();
        position++; whitespace();
        if (text[position] === end) { position++; return; }
        while (true) {
          if (object) {
            whitespace(); const key = string();
            check(!seen.has(key), 'duplicate-json-key'); seen.add(key);
            whitespace(); check(text[position++] === ':', 'invalid-public-json');
          }
          value(); whitespace();
          if (text[position] === end) { position++; return; }
          check(text[position++] === ',', 'invalid-public-json');
        }
      }
      if (token === '"') { string(); return; }
      const scalar = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(position));
      check(scalar !== null, 'invalid-public-json'); position += scalar[0].length;
    };
    value(); whitespace(); check(position === text.length, 'invalid-public-json');
    return JSON.parse(text, (_key, value) => {
      check(typeof value !== 'number' || Number.isFinite(value), 'invalid-public-json'); return value;
    });
  } catch (error) {
    if (error.message === 'EVIDENCE_LINKAGE: duplicate-json-key') throw error;
    fail('invalid-public-json');
  }
}
const parse = parseLinkageJson;

/**
 * Validate linkage against already checked public certificate bytes, existing
 * public claim registries and exact paragraph bindings. This is not a substitute
 * for verify_public_evidence.py or a source/disclosure/semantic review. No source
 * URL, private locator, raw evidence hash or source text is accepted by the ledger.
 */
export function validateEvidenceLinkage(ledger, { certificates, knownTargets, paragraphBindings }) {
  shape(ledger, ['schema', 'links'], 'ledger-fields');
  check(ledger.schema === 'huey.evidence-linkage.v1' && Array.isArray(ledger.links), 'ledger-schema');
  check(certificates instanceof Map && knownTargets instanceof Map, 'checked-context-required');
  validateParagraphBindings(paragraphBindings);
  const ids = new Set(), assertions = new Set();
  for (const link of ledger.links) {
    shape(link, ['id', 'certificate', 'relationshipIndex', 'target', 'paragraph', 'mapping', 'dependence', 'review'], 'link-fields');
    check(typeof link.id === 'string' && LINK.test(link.id) && !ids.has(link.id), 'link-id');
    ids.add(link.id);
    shape(link.certificate, ['evidenceId', 'version', 'sha256'], 'certificate-pin-fields');
    const pin = link.certificate;
    check(typeof pin.evidenceId === 'string' && EVIDENCE.test(pin.evidenceId)
      && Number.isSafeInteger(pin.version) && pin.version > 0
      && typeof pin.sha256 === 'string' && HASH.test(pin.sha256), 'certificate-pin');
    check(certificates.has(pin.evidenceId), 'missing-certificate');
    const bytes = certificates.get(pin.evidenceId);
    check(typeof bytes === 'string' || Buffer.isBuffer(bytes), 'certificate-bytes-required');
    check(digest(bytes) === pin.sha256, 'stale-certificate-bytes');
    const certificate = parse(bytes);
    check(certificate?.schema_version === 1 && certificate.evidence_id === pin.evidenceId
      && certificate.certificate_version === pin.version, 'stale-certificate-version');
    check(['active', 'superseded', 'withdrawn_public_derivative', 'blocked'].includes(certificate.status), 'certificate-status');
    check(Array.isArray(certificate.relationships) && Number.isSafeInteger(link.relationshipIndex)
      && link.relationshipIndex >= 0 && link.relationshipIndex < certificate.relationships.length, 'relationship-index');
    const relation = certificate.relationships[link.relationshipIndex];
    shape(relation, ['target', 'relationship', 'locator', 'contribution', 'does_not_establish'], 'certificate-relationship-fields');
    check(RELATIONS.includes(relation.relationship)
      && ['target', 'locator', 'contribution', 'does_not_establish'].every(key => nonempty(relation[key])), 'certificate-relationship');
    shape(link.target, ['registry', 'id', 'sha256'], 'target-fields');
    check(TARGETS.includes(link.target.registry) && nonempty(link.target.id)
      && typeof link.target.sha256 === 'string' && HASH.test(link.target.sha256), 'target-pin');
    const registered = knownTargets.get(`${link.target.registry}/${link.target.id}`);
    check(registered !== undefined && registered === link.target.sha256, 'unknown-or-stale-target');
    check(relation.target === link.target.id, 'certificate-target-mismatch');
    if (link.paragraph !== null) {
      shape(link.paragraph, PARAGRAPH_FIELDS, 'paragraph-fields');
      check(paragraphBindings.bindings.some(row => PARAGRAPH_FIELDS.every(key => row[key] === link.paragraph[key])),
        'unknown-or-stale-paragraph');
    }
    shape(link.mapping, ['kind', 'fidelity', 'limits'], 'mapping-fields');
    check(['quotation', 'derivation', 'context'].includes(link.mapping.kind)
      && ['exact', 'lossy', 'approximate', 'unsupported', 'unknown'].includes(link.mapping.fidelity)
      && nonempty(link.mapping.limits), 'mapping');
    check(link.paragraph !== null || ['unsupported', 'unknown'].includes(link.mapping.fidelity), 'unlocated-mapping');
    shape(link.dependence, ['status', 'sourceFamily', 'limits'], 'dependence-fields');
    const dependence = link.dependence;
    check(['unknown', 'copied', 'same-source-family', 'reported-independent'].includes(dependence.status)
      && (dependence.sourceFamily === null || (typeof dependence.sourceFamily === 'string' && FAMILY.test(dependence.sourceFamily)))
      && nonempty(dependence.limits), 'dependence');
    check(!['copied', 'same-source-family'].includes(dependence.status) || dependence.sourceFamily !== null, 'dependent-source-family-required');
    check(relation.relationship !== 'duplicate' || dependence.status === 'copied', 'duplicate-is-dependent');
    check(relation.relationship !== 'same_source_family'
      || ['copied', 'same-source-family'].includes(dependence.status), 'source-family-is-dependent');
    shape(link.review, ['state', 'reference'], 'review-fields');
    check(['pending', 'assessed', 'needs-reassessment'].includes(link.review.state), 'review-state');
    check(link.review.state === 'pending' ? link.review.reference === null : reference(link.review.reference), 'review-reference');
    check(link.paragraph !== null || link.review.state !== 'assessed', 'unlocated-review');
    check(certificate.status === 'active' || link.review.state !== 'assessed', 'inactive-certificate-needs-review');
    // The same certificate relationship may address several exact occurrences,
    // but duplicated rows may not masquerade as separate evidence contributions.
    const assertion = JSON.stringify([pin.evidenceId, pin.version, pin.sha256, link.relationshipIndex,
      link.target.registry, link.target.id, link.paragraph ? PARAGRAPH_FIELDS.map(key => link.paragraph[key]) : null]);
    check(!assertions.has(assertion), 'duplicate-link');
    assertions.add(assertion);
  }
  return ledger;
}

/** Derived lookup views reference the single ledger; they do not count support. */
export function indexEvidenceLinkage(ledger, context) {
  validateEvidenceLinkage(ledger, context);
  const bySource = {}, byTarget = {}, byParagraph = {}, unlocated = [];
  const add = (index, key, id) => { (index[key] ??= []).push(id); };
  for (const link of ledger.links) {
    add(bySource, link.certificate.evidenceId, link.id);
    add(byTarget, `${link.target.registry}/${link.target.id}`, link.id);
    if (link.paragraph) add(byParagraph, `${link.paragraph.entityId}/${link.paragraph.entityVersion}`, link.id);
    else unlocated.push(link.id);
  }
  return { schema: 'huey.evidence-linkage-index.v1', bySource, byTarget, byParagraph, unlocated };
}

function readPublic(root, path) {
  // Callers provide only fixed registry paths or an ID-derived certificate path.
  check(typeof path === 'string' && /^(?:planning|evidence)\//.test(path)
    && path.split('/').every(part => part && part !== '.' && part !== '..')
    && !/[\\\x00-\x1f\x7f:]/.test(path), 'public-path');
  let cursor = realpathSync(root);
  for (const part of path.split('/')) {
    cursor = resolve(cursor, part);
    check(!lstatSync(cursor).isSymbolicLink(), 'public-symlink');
  }
  check(lstatSync(cursor).isFile(), 'public-file');
  const rel = relative(realpathSync(root), realpathSync(cursor));
  check(rel && rel !== '..' && !rel.startsWith(`..${sep}`), 'public-containment');
  return readFileSync(cursor);
}

/** Existing public identifiers only; no new claim wording or identity is minted. */
export function loadKnownTargets(root = ROOT) {
  const known = new Map();
  const add = (registry, id, hash) => {
    const key = `${registry}/${id}`;
    check(nonempty(id) && !known.has(key), 'invalid-or-duplicate-registry-id');
    known.set(key, hash);
  };
  for (const [registry, path, header, count, prefix, width] of [
    ['core', 'planning/standard-of-care/claims.tsv', ['claim_id', 'target', 'verification_issue', 'support_level'], 188, 'SOC-C', 3],
    ['ancillary', 'planning/standard-of-care/ancillary-r02/claims.tsv', ['id', 'source', 'pointer', 'exact_json', 'kind', 'issue', 'support', 'disposition'], 70, 'ANC-C', 3],
    ['authority', 'planning/standard-of-care/authority-q03/claims.tsv', ['id', 'proposition', 'reviews', 'type', 'verification_issue', 'disposition'], 14, 'Q03-C', 2],
  ]) {
    const bytes = readPublic(root, path), text = bytes.toString('utf8');
    check(text.endsWith('\n') && !/[\r\x00]/.test(text), 'registry-format');
    const lines = text.slice(0, -1).split('\n');
    check(lines.shift() === header.join('\t') && lines.length === count, 'registry-format');
    for (const [index, line] of lines.entries()) {
      const fields = line.split('\t');
      check(fields.length === header.length && fields.every(nonempty), 'registry-row');
      const id = fields[0];
      check(id === `${prefix}${String(index + 1).padStart(width, '0')}`, 'registry-id');
      if (registry === 'core') check(/^[1-9][0-9]*$/.test(fields[2])
        && ['attribution', 'integrity', 'primary-source', 'substantial'].includes(fields[3]), 'registry-row');
      if (registry === 'ancillary') {
        check(['audio', 'dignity', 'harm', 'painting', 'site'].includes(fields[1]) && fields[2].startsWith('/')
          && /^[1-9][0-9]*$/.test(fields[5]) && ['artifact', 'provenance', 'reasoning', 'substantial'].includes(fields[6])
          && !['verified', 'proved', 'true'].includes(fields[7]), 'registry-row');
        // This bounded snapshot has one physical line per TSV row. Decode CSV
        // quoting before checking its exact_json field; embedded tabs/newlines
        // require an explicit later adapter rather than silent truncation.
        const field = fields[3], unquoted = field.startsWith('"') ? field.slice(1, -1).replaceAll('""', '"') : field;
        check(!field.startsWith('"') || field.endsWith('"'), 'registry-row'); parse(unquoted);
      }
      if (registry === 'authority') check(fields[2].split(' ').every(value => /^Q03-R(?:0[1-9]|1[0-2])$/.test(value))
        && /^https:\/\/github\.com\/grwtsk\/huey\/issues\/(?:192|160|142|144)$/.test(fields[4])
        && ['supported-in-current-source', 'reasoning-not-empirical-finding', 'reasoning-not-case-verdict'].includes(fields[5]), 'registry-row');
      add(registry, id, digest(bytes));
    }
  }
  const incidentBytes = readPublic(root, 'planning/standard-of-care/incident-register/register.json');
  const incidents = parse(incidentBytes);
  shape(incidents, ['schema_version', 'repository', 'register_issue', 'coverage_issue', 'evidence_intake_issue', 'date', 'scope', 'entry_details',
    'new_collection_status', 'finding_status', 'all_incidents_enumerated', 'classifications', 'columns', 'entries', 'disclaimer'], 'incident-registry');
  check(incidents.schema_version === 1 && incidents.repository === 'grwtsk/huey'
    && incidents.register_issue === 193 && incidents.coverage_issue === 306 && incidents.evidence_intake_issue === 307
    && incidents.finding_status === 'not-determined' && incidents.new_collection_status === 'planned-not-started'
    && incidents.all_incidents_enumerated === false
    && JSON.stringify(incidents.columns) === JSON.stringify(['number', 'issue', 'class', 'source', 'locator', 'title'])
    && Array.isArray(incidents.entries) && incidents.entries.length === 112, 'incident-registry');
  for (const [index, row] of incidents.entries.entries()) {
    check(Array.isArray(row) && row.length === 6 && row[0] === index + 1 && row[1] === index + 194
      && ['R', 'S', 'Q', 'C', 'X'].includes(row[2]) && row.slice(2).every(nonempty), 'incident-id');
    add('incidents', `SOC-I${String(row[0]).padStart(3, '0')}`, digest(incidentBytes));
  }
  const careBytes = readPublic(root, 'planning/standard-of-care/care-law/revision.md');
  const careIds = [...careBytes.toString('utf8').matchAll(/^.+?\s*<!-- (C[0-9]{3}) \| (?:proposal|testimony|question|inference|ethics|law|framework|metaphor|document|policy) \| (?:17[89]|18[0-5]|187) \| S[0-9]{2}(?:,S[0-9]{2})* -->$/gm)];
  check(careIds.length === 256, 'care-law-registry');
  const expectedCareIds = new Set(Array.from({ length: 256 }, (_value, index) => `C${String(index + 1).padStart(3, '0')}`));
  for (const match of careIds) {
    check(expectedCareIds.delete(match[1]), 'care-law-id');
    add('care-law', match[1], digest(careBytes));
  }
  return known;
}

export async function loadEvidenceLinkage(root = ROOT, { loadBindings = loadParagraphBindings } = {}) {
  const ledger = parse(readPublic(root, 'planning/evidence-linkage/ledger.json'));
  shape(ledger, ['schema', 'links'], 'ledger-fields');
  check(ledger.schema === 'huey.evidence-linkage.v1' && Array.isArray(ledger.links), 'ledger-schema');
  const certificates = new Map();
  // A nonempty ledger is checked against the actual public export/index/schema
  // before any certificate is consumed. The verifier never visits the vault.
  if (ledger.links.length > 0) {
    const code = 'import sys; from pathlib import Path; sys.path.insert(0, str(Path(sys.argv[1]) / "planning/evidence-intake")); from verify_public_evidence import verify; verify(Path(sys.argv[1]))';
    try { execFileSync(process.env.HUEY_PYTHON ?? 'python3', ['-c', code, root], { stdio: 'pipe' }); }
    catch { fail('public-evidence-check-failed'); }
    for (const link of ledger.links) {
      check(typeof link?.certificate?.evidenceId === 'string' && EVIDENCE.test(link.certificate.evidenceId), 'certificate-pin');
      const id = link.certificate.evidenceId;
      if (!certificates.has(id)) certificates.set(id, readPublic(root, `evidence/certificates/${id}.json`));
    }
  }
  const context = { certificates, knownTargets: loadKnownTargets(root), paragraphBindings: await loadBindings(root) };
  validateEvidenceLinkage(ledger, context);
  return { ledger, context };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    check(process.argv.length <= 3 && ['check', 'emit'].includes(process.argv[2] ?? 'check'), 'usage-check-or-emit');
    const { ledger, context } = await loadEvidenceLinkage();
    if (process.argv[2] === 'emit') console.log(JSON.stringify(indexEvidenceLinkage(ledger, context), null, 2));
    else console.log(`Evidence linkage checked: ${ledger.links.length} proposed relationships. Empty means mapping pending; no support, disclosure or editorial clearance inferred.`);
  } catch (error) {
    // Fixed diagnostics avoid echoing source content, file paths or JSON errors.
    console.error(error.message?.startsWith('EVIDENCE_LINKAGE:') ? error.message : 'EVIDENCE_LINKAGE: checked-input-unavailable');
    process.exitCode = 1;
  }
}
