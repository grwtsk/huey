import test from 'node:test';
import assert from 'node:assert/strict';
import { createTraversal, EdgeIntent, EDGE_INTENT_DEFAULTS } from '../src/traversal.mjs';
import { formatEntityRoute } from '../src/routes.mjs';

const id = n => `he_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const version = `hev1:${'a'.repeat(64)}`, older = `hev1:${'b'.repeat(64)}`;
const address = n => formatEntityRoute({ id: id(n), kind: 'ReadingPage' });

function fixture() {
  const readingOrder = [1, 2, 3, 4, 5].map(id), unplacedOrder = [6, 7].map(id);
  const routes = {
    schema: 'huey.route-projection.v1', projection: 'editorial', entryPageId: id(1),
    targets: [], slots: [], aliases: [{ path: '/huey/page/opening', targetId: id(1) }],
  };
  for (let n = 1; n <= 7; n += 1) {
    const access = n === 4 ? 'restricted' : [1, 5].includes(n) ? 'unavailable-on-this-client' : 'available';
    routes.slots.push({
      id: id(n + 10), group: n === 1 ? 'front' : n >= 6 ? 'unplaced' : 'book',
      presence: n === 1 ? 'pending' : 'present',
      editorialMaterialization: n === 1 ? 'placeholder' : n >= 6 ? 'unplaced' : n === 3 ? 'partial' : 'full',
      access, publicationAnnotation: { label: n === 3 ? 'held' : 'working', authoritative: false },
      observedReaderAdmission: n === 2 ? 'admitted' : 'not-listed',
    });
    const common = { version: access === 'available' ? version : null, access,
      unresolved: n === 1, pageIds: [id(n)], slotIds: [id(n + 10)] };
    routes.targets.push({ id: id(n + 10), kind: n === 1 ? 'MatterUnit' : 'Chapter', ...common });
    routes.targets.push({ id: id(n), kind: 'ReadingPage', ...common });
  }
  routes.targets.push({ id: id(20), kind: 'Paragraph', version, access: 'available', unresolved: false,
    pageIds: [id(2)], slotIds: [id(12)] });
  return { routes, readingOrder, unplacedOrder };
}

test('entry preserves pending front matter and no traversal step skips a denied page', () => {
  const traversal = createTraversal(fixture()), first = traversal.locate('/huey');
  assert.equal(first.resolution.status, 'unavailable');
  assert.equal(first.resolution.slots[0].presence, 'pending');
  assert.deepEqual({ ...first, resolution: undefined }, {
    resolution: undefined, pageId: id(1), sequence: 'book', index: 0, previous: null, next: id(2),
  });
  for (let n = 2; n <= 5; n += 1) {
    const page = traversal.locate(address(n));
    assert.equal(page.pageId, id(n));
    assert.equal(page.index, n - 1);
    assert.equal(page.previous, id(n - 1));
    assert.equal(page.next, n === 5 ? null : id(n + 1));
  }
  assert.equal(traversal.locate(address(4)).resolution.status, 'restricted');
  assert.equal(traversal.locate(address(5)).resolution.status, 'unavailable');
});

test('partial held and non-admitted pages remain in editorial traversal', () => {
  const data = fixture(), traversal = createTraversal(data), page = traversal.locate(address(3));
  assert.equal(page.resolution.status, 'resolved');
  assert.equal(page.resolution.slots[0].editorialMaterialization, 'partial');
  assert.equal(page.resolution.slots[0].publicationAnnotation.label, 'held');
  assert.equal(page.resolution.slots[0].observedReaderAdmission, 'not-listed');
  data.routes.slots.find(slot => slot.id === id(13)).observedReaderAdmission = 'admitted';
  assert.deepEqual(createTraversal(data).readingOrder, traversal.readingOrder);
  assert.equal(page.previous, id(2)); assert.equal(page.next, id(4));
});

test('unplaced material has its own sequence with hard ends and no fourth movement', () => {
  const traversal = createTraversal(fixture());
  const first = traversal.locate(address(6)), last = traversal.locate(address(7));
  assert.equal(first.sequence, 'unplaced'); assert.equal(first.previous, null); assert.equal(first.next, id(7));
  assert.equal(last.sequence, 'unplaced'); assert.equal(last.previous, id(6)); assert.equal(last.next, null);
  assert.equal(traversal.locate(address(5)).next, null);
});

test('explicit order changes retain stable page identity and update only adjacency', () => {
  const data = fixture(), original = createTraversal(data);
  data.readingOrder = [1, 3, 2, 4, 5].map(id);
  const changed = createTraversal(data), before = original.locate(address(3)), after = changed.locate(address(3));
  assert.deepEqual(after.resolution, before.resolution);
  assert.equal(after.pageId, before.pageId);
  assert.equal(after.previous, id(1)); assert.equal(after.next, id(2));
  assert.equal(before.previous, id(2)); assert.equal(before.next, id(4));
});

test('traversal snapshots caller data and exposes frozen orders', () => {
  const data = fixture(), traversal = createTraversal(data), before = traversal.locate(address(3));
  data.readingOrder.reverse(); data.unplacedOrder.pop(); data.routes.targets.length = 0;
  assert.deepEqual(traversal.locate(address(3)), before);
  assert.throws(() => traversal.readingOrder.reverse(), TypeError);
  assert.throws(() => traversal.unplacedOrder.push(id(99)), TypeError);
  const returned = traversal.locate(address(3));
  returned.resolution.slots[0].presence = 'omitted'; returned.next = id(99);
  assert.deepEqual(traversal.locate(address(3)), before);
  assert.ok(Object.isFrozen(traversal));
});

test('alias normalization remains an explicit resolution outcome, without changing location or history', () => {
  const traversal = createTraversal(fixture());
  const alias = traversal.locate('/huey/page/opening/'), direct = traversal.locate(address(1));
  assert.equal(alias.resolution.redirectTo, address(1));
  assert.equal(alias.pageId, direct.pageId); assert.equal(alias.next, direct.next);
  assert.equal(direct.resolution.redirectTo, null);
  assert.equal(traversal.locate('/huey').resolution.canonicalPath, '/huey');
});

test('exact-version miss keeps denial and requested version without falling back to current content', () => {
  const page = createTraversal(fixture()).locate(`${address(2)}/v/${older}`);
  assert.equal(page.resolution.status, 'version-unavailable');
  assert.equal(page.resolution.entityVersion, null);
  assert.equal(page.resolution.requestedVersion, older);
  assert.equal(page.resolution.canonicalPath, `${address(2)}/v/${older}`);
  assert.equal(page.pageId, id(2)); assert.equal(page.previous, id(1)); assert.equal(page.next, id(3));
});

test('non-page routes preserve route outcomes without implementing paragraph focus or choosing a page', () => {
  const traversal = createTraversal(fixture());
  for (const route of [`/huey/paragraph/${id(20)}`, `/huey/entity/${id(12)}`]) {
    const location = traversal.locate(route);
    assert.equal(location.resolution.status, 'resolved');
    assert.deepEqual(location.resolution.pageIds, [id(2)]);
    for (const field of ['pageId', 'sequence', 'index', 'previous', 'next']) assert.equal(location[field], null);
  }
  for (const route of ['/huey?projection=editorial', address(99), `/huey/page/${id(20)}`]) {
    const location = traversal.locate(route);
    assert.ok(['invalid-route', 'unknown'].includes(location.resolution.status));
    for (const field of ['pageId', 'sequence', 'index', 'previous', 'next']) assert.equal(location[field], null);
  }
});

test('an empty publication projection is explicit and does not manufacture a book entry', () => {
  const routes = { schema: 'huey.route-projection.v1', projection: 'publication', entryPageId: null,
    targets: [], slots: [], aliases: [] };
  const traversal = createTraversal({ routes, readingOrder: [], unplacedOrder: [] });
  assert.deepEqual(traversal.locate('/huey'), {
    resolution: { status: 'unresolved', projection: 'publication', entryPageId: null },
    pageId: null, sequence: null, index: null, previous: null, next: null,
  });
  routes.projection = 'editorial';
  assert.throws(() => createTraversal({ routes, readingOrder: [], unplacedOrder: [] }), /editorial book sequence is empty/);
});

for (const [name, change] of [
  ['missing book sequence', data => { delete data.readingOrder; }],
  ['missing unplaced sequence', data => { delete data.unplacedOrder; }],
  ['missing page', data => { data.readingOrder.pop(); }],
  ['duplicate in book', data => { data.readingOrder[1] = id(1); }],
  ['duplicate across sequences', data => { data.unplacedOrder[0] = id(1); }],
  ['paragraph in sequence', data => { data.readingOrder[1] = id(20); }],
  ['unknown page', data => { data.readingOrder[1] = id(99); }],
  ['sparse sequence', data => { delete data.readingOrder[1]; }],
  ['wrong entry', data => { data.routes.entryPageId = id(2); }],
  ['missing entry', data => { data.routes.entryPageId = null; }],
  ['unplaced as entry', data => { data.routes.entryPageId = id(6); }],
]) test(`invalid traversal rejects ${name}`, () => {
  const data = fixture(); change(data);
  assert.throws(() => createTraversal(data), /HUEY_TRAVERSAL/);
});

const arm = (intent, extra = {}) => intent.arm({ direction: 'next', now: 100, blocked: false, atEdge: true, ...extra });
const wheel = (intent, extra = {}) => intent.wheel({ direction: 'next', delta: 60, now: 110,
  blocked: false, atEdge: true, altKey: true, ...extra });

test('production edge thresholds require distance, duration and multiple events within a finite arm', () => {
  assert.deepEqual(EDGE_INTENT_DEFAULTS, { ttlMs: 1500, distancePx: 120, minDurationMs: 100, minEvents: 2 });
  assert.ok(Object.isFrozen(EDGE_INTENT_DEFAULTS));
  const intent = new EdgeIntent();
  assert.equal(arm(intent), true);
  assert.equal(wheel(intent), null);
  assert.equal(wheel(intent, { now: 210 }), 'next');
});

test('ordinary and inertial wheel events never arm traversal or turn a second page', () => {
  const intent = new EdgeIntent();
  assert.equal(wheel(intent, { now: 10, altKey: false, delta: 1000 }), null);
  assert.equal(wheel(intent, { now: 20, delta: 1000 }), null);
  assert.equal(arm(intent), true);
  assert.equal(wheel(intent), null);
  assert.equal(wheel(intent, { now: 210 }), 'next');
  for (const now of [220, 330, 440, 550]) assert.equal(wheel(intent, { now, delta: 1000 }), null);
  assert.equal(arm(intent, { now: 600 }), true);
  assert.equal(wheel(intent, { now: 610 }), null);
  assert.equal(wheel(intent, { now: 710 }), 'next');
});

test('one large impulse and two near-simultaneous momentum events do not satisfy deliberation', () => {
  const intent = new EdgeIntent(); arm(intent);
  assert.equal(wheel(intent, { delta: 1000 }), null);
  assert.equal(wheel(intent, { now: 111, delta: 1000 }), null);
  assert.equal(wheel(intent, { now: 210, delta: 1 }), 'next');
});

test('time held before the first wheel event does not substitute for sustained gesture time', () => {
  const intent = new EdgeIntent(); arm(intent);
  assert.equal(wheel(intent, { now: 1000 }), null);
  assert.equal(wheel(intent, { now: 1001 }), null);
  assert.equal(wheel(intent, { now: 1100, delta: 1 }), 'next');
});

test('insufficient distance remains ordinary scrolling even after sufficient time', () => {
  const intent = new EdgeIntent(); arm(intent);
  assert.equal(wheel(intent, { delta: 1 }), null);
  assert.equal(wheel(intent, { now: 210, delta: 1 }), null);
  assert.equal(wheel(intent, { now: 220, delta: 118 }), 'next');
});

test('previous-page intent uses the same threshold without wrapping or deciding navigation', () => {
  const intent = new EdgeIntent(); assert.equal(arm(intent, { direction: 'previous' }), true);
  assert.equal(wheel(intent, { direction: 'previous' }), null);
  assert.equal(wheel(intent, { direction: 'previous', now: 210 }), 'previous');
});

for (const [name, change] of [
  ['blocked selection/composition/editing', { blocked: true }],
  ['missing blocked state', { blocked: undefined }],
  ['not at the edge', { atEdge: false }],
  ['missing edge state', { atEdge: undefined }],
  ['unknown direction', { direction: 'down' }],
  ['zero timestamp', { now: 0 }],
  ['negative timestamp', { now: -1 }],
  ['infinite timestamp', { now: Infinity }],
  ['NaN timestamp', { now: NaN }],
]) test(`edge arm fails closed for ${name}`, () => {
  const intent = new EdgeIntent();
  assert.equal(arm(intent, change), false);
  assert.equal(wheel(intent, { now: 200, delta: 1000 }), null);
  assert.equal(wheel(intent, { now: 400, delta: 1000 }), null);
});

for (const [name, change] of [
  ['direction reversal', { direction: 'previous' }],
  ['unknown direction', { direction: 'down' }],
  ['selection/composition/editing block', { blocked: true }],
  ['missing blocked state', { blocked: undefined }],
  ['leaving the edge', { atEdge: false }],
  ['missing edge state', { atEdge: undefined }],
  ['Alt release', { altKey: false }],
  ['missing Alt state', { altKey: undefined }],
  ['zero distance', { delta: 0 }],
  ['negative distance', { delta: -1 }],
  ['NaN distance', { delta: NaN }],
  ['infinite distance', { delta: Infinity }],
  ['zero timestamp', { now: 0 }],
  ['negative timestamp', { now: -1 }],
  ['NaN timestamp', { now: NaN }],
  ['infinite timestamp', { now: Infinity }],
  ['stale timestamp', { now: 109 }],
  ['duplicate timestamp', { now: 110 }],
]) test(`edge wheel cancels rather than pausing for ${name}`, () => {
  const intent = new EdgeIntent(); arm(intent); wheel(intent);
  assert.equal(wheel(intent, { now: 210, ...change }), null);
  assert.equal(wheel(intent, { now: 400, delta: 1000 }), null);
  assert.equal(wheel(intent, { now: 600, delta: 1000 }), null);
});

test('explicit cancellation discards accumulated intent until a fresh arm', () => {
  const intent = new EdgeIntent(); arm(intent); wheel(intent); intent.cancel();
  assert.equal(wheel(intent, { now: 210 }), null);
  assert.equal(arm(intent, { now: 300 }), true);
  assert.equal(wheel(intent, { now: 310 }), null);
  assert.equal(wheel(intent, { now: 410 }), 'next');
});

test('expired arms cannot be revived by residual scroll or by stale key events', () => {
  const intent = new EdgeIntent(); arm(intent); wheel(intent);
  assert.equal(wheel(intent, { now: 1601, delta: 1000 }), null);
  assert.equal(arm(intent, { now: 1500 }), false);
  assert.equal(wheel(intent, { now: 1800, delta: 1000 }), null);
  assert.equal(arm(intent, { now: 1900 }), true);
  assert.equal(wheel(intent, { now: 1910 }), null);
  assert.equal(wheel(intent, { now: 2010 }), 'next');
});

test('rearming starts a new gesture and never carries accumulated distance or duration', () => {
  const intent = new EdgeIntent(); arm(intent); wheel(intent);
  assert.equal(arm(intent, { now: 200 }), true);
  assert.equal(wheel(intent, { now: 210 }), null);
  assert.equal(wheel(intent, { now: 310 }), 'next');
});

test('overflowed cumulative distance cancels rather than converting a malformed event into intent', () => {
  const intent = new EdgeIntent(); arm(intent);
  assert.equal(wheel(intent, { delta: Number.MAX_VALUE }), null);
  assert.equal(wheel(intent, { now: 210, delta: Number.MAX_VALUE }), null);
  assert.equal(wheel(intent, { now: 400, delta: 1000 }), null);
});

test('configured thresholds remain bounded and still require at least two events', () => {
  const intent = new EdgeIntent({ ttlMs: 100, distancePx: 10, minDurationMs: 20, minEvents: 3 });
  arm(intent);
  assert.equal(wheel(intent, { delta: 10 }), null);
  assert.equal(wheel(intent, { now: 130, delta: 10 }), null);
  assert.equal(wheel(intent, { now: 140, delta: 10 }), 'next');
  for (const options of [
    { ttlMs: 0 }, { ttlMs: Infinity }, { distancePx: 0 }, { distancePx: NaN },
    { minDurationMs: 0 }, { minDurationMs: 1501 }, { minEvents: 1 }, { minEvents: 2.5 },
  ]) assert.throws(() => new EdgeIntent(options), /invalid edge-intent thresholds/);
});
