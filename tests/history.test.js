const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const load = () => import(`data:text/javascript;base64,${readFileSync(resolve(__dirname, '../src/utils/history.js')).toString('base64')}`);
const item = (id, extra = {}) => ({ kid: id, view_at: 100 - id,
  history: { business: 'archive', bvid: `BV${id}` }, ...extra });

test('history continues short pages, preserves the full cursor and deduplicates overlaps', async () => {
  const { createHistoryState, appendHistoryPage } = await load();
  const state = createHistoryState();
  const first = { max: 7, view_at: 90, business: 'archive', ps: 20 };
  appendHistoryPage(state, { cursor: first, list: [item(1), item(2)] }, String);
  assert.equal(state.noMore, false);
  assert.deepEqual(state.cursor, { max: 7, view_at: 90, business: 'archive' });
  appendHistoryPage(state, { cursor: { ...first, view_at: 80 }, list: [item(2), item(3)] }, String);
  assert.equal(state.cards.length, 3);
  assert.equal(state.cards[2].viewed_at, '97');
  assert.equal(state.noMore, false, 'a changed timestamp advances the cursor even with the same max');
  appendHistoryPage(state, { cursor: { max: 0, view_at: 0, business: '' }, list: [] }, String);
  assert.equal(state.noMore, true);
  assert.equal(state.cards.length, 3);
});

test('history stops missing, zero or repeated cursors without duplicating cards', async () => {
  const { createHistoryState, appendHistoryPage } = await load();
  for (const cursor of [undefined, { max: 0, view_at: 0, business: '' }]) {
    const state = createHistoryState();
    appendHistoryPage(state, { cursor, list: [item(1)] }, String);
    assert.equal(state.noMore, true);
  }
  const state = createHistoryState();
  const page = { cursor: { max: 7, view_at: 90, business: 'archive' }, list: [item(1)] };
  appendHistoryPage(state, page, String);
  appendHistoryPage(state, page, String);
  assert.equal(state.cards.length, 1);
  assert.equal(state.noMore, true);
});

test('unusable records do not stop history while the server cursor advances', async () => {
  const { createHistoryState, appendHistoryPage } = await load();
  const state = createHistoryState();
  appendHistoryPage(state, { cursor: { max: 1, view_at: 99, business: 'archive' }, list: [item(1, { history: {} })] }, String);
  assert.equal(state.cards.length, 0);
  assert.equal(state.noMore, false);
  appendHistoryPage(state, { cursor: { max: 2, view_at: 98, business: 'archive' }, list: [item(2)] }, String);
  assert.equal(state.cards.length, 1);
});

test('history maps every known device code and labels missing or unknown platforms', async () => {
  const { historyCard } = await load();
  for (const [type, codes] of Object.entries({ phone: [1, 3, 5, 7, 12], computer: [2, 14],
    tablet: [4, 6, 10, 13], car: [8], speaker: [9], tv: [11, 33], unknown: [0, 99, undefined, null] })) {
    for (const dt of codes) {
      const card = historyCard(item(1, { history: { bvid: 'BV1', business: 'archive', dt } }), '刚刚');
      assert.equal(card.watch_device.type, type, `platform code ${dt}`);
      assert.ok(card.watch_device.label);
    }
  }
});
