import { resolveRouteAddress, validateRouteProjection } from './routes.mjs';

const fail = message => { throw new Error(`HUEY_TRAVERSAL: ${message}`); };
const check = (condition, message) => { if (!condition) fail(message); };

/**
 * A snapshot of the selected projection's authored navigation order. ReadingPage
 * membership is independent of admission, rendering, viewport size and history.
 * The browser remains responsible for history and explicit URL changes.
 */
export function createTraversal({ routes, readingOrder, unplacedOrder }) {
  validateRouteProjection(routes);
  check(Array.isArray(readingOrder) && Array.isArray(unplacedOrder), 'missing page sequences');
  const pages = new Set(routes.targets.filter(target => target.kind === 'ReadingPage').map(target => target.id));
  const ordered = [...readingOrder, ...unplacedOrder];
  check(ordered.length === pages.size && new Set(ordered).size === ordered.length
    && ordered.every(id => pages.has(id)), 'sequences must contain every ReadingPage exactly once');
  check(routes.entryPageId === (readingOrder[0] ?? null), 'entry must be the first book page');
  check(routes.projection === 'publication' || readingOrder.length > 0, 'editorial book sequence is empty');
  // Mutation of a caller's data after validation cannot silently alter traversal.
  const catalog = structuredClone(routes);
  const book = Object.freeze([...readingOrder]), unplaced = Object.freeze([...unplacedOrder]);
  const positions = new Map();
  for (const [sequence, order] of [['book', book], ['unplaced', unplaced]]) {
    order.forEach((pageId, index) => positions.set(pageId, {
      pageId, sequence, index, previous: order[index - 1] ?? null, next: order[index + 1] ?? null,
    }));
  }
  return Object.freeze({
    readingOrder: book,
    unplacedOrder: unplaced,
    locate(address) {
      const resolution = resolveRouteAddress(address, catalog);
      const position = resolution.kind === 'ReadingPage' ? positions.get(resolution.entityId) : null;
      return { resolution, ...(position ?? {
        pageId: null, sequence: null, index: null, previous: null, next: null,
      }) };
    },
  });
}

export const EDGE_INTENT_DEFAULTS = Object.freeze({
  ttlMs: 1500,
  distancePx: 120,
  minDurationMs: 100,
  minEvents: 2,
});

const directionIsValid = direction => ['previous', 'next'].includes(direction);
const positiveFinite = value => Number.isFinite(value) && value > 0;

/**
 * One deliberate edge-scroll gesture per fresh arm. Only a new, non-repeated
 * Alt keydown at an edge may call arm; wheel/momentum must never call it.
 * The DOM adapter cancels on key release, focus/selection/composition changes,
 * editing, resizing and navigation. Ordinary scroll always remains ordinary.
 */
export class EdgeIntent {
  #options;
  #armed = null;
  #lastTime = 0;

  constructor(options = {}) {
    const config = { ...EDGE_INTENT_DEFAULTS, ...options };
    check(positiveFinite(config.ttlMs) && positiveFinite(config.distancePx)
      && positiveFinite(config.minDurationMs) && config.minDurationMs <= config.ttlMs
      && Number.isInteger(config.minEvents) && config.minEvents >= 2,
    'invalid edge-intent thresholds');
    this.#options = Object.freeze(config);
  }

  cancel() {
    this.#armed = null;
  }

  arm({ direction, now, blocked, atEdge }) {
    this.cancel();
    if (!positiveFinite(now) || now <= this.#lastTime) return false;
    this.#lastTime = now;
    if (!directionIsValid(direction) || blocked !== false || atEdge !== true) return false;
    this.#armed = { direction, at: now, firstWheelAt: null, distance: 0, events: 0 };
    return true;
  }

  wheel({ direction, delta, now, blocked, atEdge, altKey }) {
    if (!positiveFinite(now) || now <= this.#lastTime) {
      this.cancel();
      return null;
    }
    this.#lastTime = now;
    const arm = this.#armed;
    if (!arm) return null;
    if (!directionIsValid(direction) || direction !== arm.direction || !positiveFinite(delta)
      || blocked !== false || atEdge !== true || altKey !== true
      || now - arm.at > this.#options.ttlMs) {
      this.cancel();
      return null;
    }
    arm.firstWheelAt ??= now;
    arm.events += 1;
    arm.distance += delta;
    if (!Number.isFinite(arm.distance)) {
      this.cancel();
      return null;
    }
    if (arm.events >= this.#options.minEvents && arm.distance >= this.#options.distancePx
      && now - arm.firstWheelAt >= this.#options.minDurationMs) {
      this.cancel();
      return direction;
    }
    return null;
  }
}
