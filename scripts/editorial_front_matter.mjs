// A metadata projection of a checked assembly, never a source reader or admission
// decision. Literary ownership resolves page members to their MatterUnits.
const fail = message => { throw new Error(`EDITORIAL_FRONT_MATTER: ${message}`); };
const requireThat = (condition, message) => { if (!condition) fail(message); };
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const unique = values => new Set(values).size === values.length;

export function buildFrontMatter(assembly) {
  requireThat(assembly?.schema === 'huey.editorial-assembly.v1', 'expected checked editorial assembly');
  const { inventory, entityRecords, unmaterializedEntities, readingOrder } = assembly;
  requireThat(inventory?.schema === 'huey.editorial-inventory.v1'
    && [inventory.slots, entityRecords, unmaterializedEntities, readingOrder].every(Array.isArray), 'missing assembly structure');
  const records = new Map(entityRecords.map(entity => [entity.id, entity]));
  const known = [...records.keys(), ...unmaterializedEntities.map(entity => entity.id)];
  requireThat(records.size === entityRecords.length && unique(known), 'duplicate entity identity');
  const knownIds = new Set(known), parent = new Map();
  for (const entity of entityRecords) {
    if (!Object.hasOwn(entity.state, 'children')) continue;
    for (const child of entity.state.children) {
      requireThat(knownIds.has(child) && !parent.has(child), 'unknown or ambiguously owned child');
      parent.set(child, entity.id);
    }
  }
  const only = kind => {
    const matches = entityRecords.filter(entity => entity.kind === kind);
    requireThat(matches.length === 1, `expected one ${kind}`);
    return matches[0];
  };
  const work = only('Work'), front = only('FrontMatter'), body = only('Body');
  requireThat(parent.get(front.id) === work.id && parent.get(body.id) === work.id,
    'FrontMatter and Body must be parallel Work divisions');
  const slots = new Map(inventory.slots.map(slot => [slot.entityId, slot]));
  requireThat(slots.size === inventory.slots.length && unique(inventory.slots.map(slot => slot.key)), 'duplicate literary slot');
  const units = inventory.slots.filter(slot => slot.group === 'front');
  requireThat(units.length > 0 && equal(front.state.children, units.map(slot => slot.entityId)),
    'FrontMatter ownership must retain every front slot in inventory order');
  for (const slot of units) {
    const entity = records.get(slot.entityId);
    requireThat(slot.kind === 'MatterUnit' && entity?.kind === 'MatterUnit'
      && entity.state.presence === slot.presence && entity.state.optional === slot.optional,
    'front MatterUnit disagrees with inventory');
  }
  // Read only structural children and page memberships. In particular, neither
  // Paragraph text nor source mappings/locators are accessed or copied here.
  const owningSlot = id => {
    requireThat(knownIds.has(id), 'unknown page member');
    const visited = new Set();
    while (!slots.has(id)) {
      requireThat(!visited.has(id), 'cyclic literary ownership');
      visited.add(id);
      id = parent.get(id);
      requireThat(id !== undefined, 'page member has no literary slot');
    }
    return slots.get(id);
  };
  requireThat(readingOrder.length > 0 && unique(readingOrder), 'empty or repeated reading order');
  const pages = [], projectedUnits = [], frontMembers = new Set();
  let leftFront = false, firstBodyPageId = null;
  for (const pageId of readingOrder) {
    const page = records.get(pageId);
    requireThat(page?.kind === 'ReadingPage' && page.state.members.length > 0
      && unique(page.state.members), 'invalid ReadingPage');
    const pageSlots = page.state.members.map(owningSlot);
    requireThat(pageSlots.every(slot => slot.group !== 'unplaced'), 'workspace page in reading order');
    const hasFront = pageSlots.some(slot => slot.group === 'front');
    if (hasFront) {
      requireThat(!leftFront && pageSlots.every(slot => slot.group === 'front'), 'front pages must be an unmixed contiguous prefix');
      for (const member of page.state.members) {
        requireThat(!frontMembers.has(member), 'front member repeated across pages');
        frontMembers.add(member);
      }
      const matterUnitIds = [];
      for (const slot of pageSlots) {
        if (matterUnitIds.at(-1) !== slot.entityId) matterUnitIds.push(slot.entityId);
        if (projectedUnits.at(-1) !== slot.entityId) projectedUnits.push(slot.entityId);
      }
      pages.push({ pageId, pageVersion: page.version, matterUnitIds });
    } else {
      if (!leftFront) {
        requireThat(pageSlots.every(slot => slot.group === 'book'), 'Body must follow front matter');
        firstBodyPageId = pageId;
      }
      leftFront = true;
    }
  }
  requireThat(pages.length > 0 && firstBodyPageId !== null
    && equal(projectedUnits, units.map(slot => slot.entityId)), 'front pages omit, repeat or reorder expected MatterUnits');
  return {
    schema: 'huey.editorial-front-matter.v1',
    workId: work.id, frontMatterId: front.id, bodyId: body.id,
    entryPageId: pages[0].pageId, firstBodyPageId,
    matterUnits: units.map(slot => ({
      key: slot.key, entityId: slot.entityId, entityVersion: records.get(slot.entityId).version,
      label: slot.label, optional: slot.optional, presence: slot.presence,
      editorialMaterialization: slot.editorialMaterialization, access: slot.access,
      publicationAnnotation: { ...slot.publicationAnnotation }, observedReaderAdmission: slot.observedReaderAdmission,
      omissionRef: slot.omissionRef, issues: [...slot.issues],
    })),
    pages,
  };
}
