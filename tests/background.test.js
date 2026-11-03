const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(resolve(__dirname, '../src/entry/background.js'), 'utf8');

function video(id, chargeOnly = false) {
  return { id_str: id, type: 'DYNAMIC_TYPE_AV', modules: {
    module_dynamic: { major: { archive: { badge: { text: chargeOnly ? '充电专属' : '' } } } },
  } };
}

async function background(items, popupSettings, updateBaseline = 'baseline') {
  const storage = { updateBaseline, popupSettings };
  let badge;
  let onAlarm;
  let onMessage;
  const context = vm.createContext({
    console: { log() {} },
    setInterval() {},
    fetch: async () => ({ json: async () => ({ code: 0, data: { items } }) }),
    chrome: {
      action: { setBadgeText({ text }) { badge = text; } },
      storage: { local: {
        get(keys, callback) { callback(Object.fromEntries(keys.map(key => [key, storage[key]]))); },
        set(values, callback) { Object.assign(storage, values); callback?.(); },
      } },
      runtime: { onMessage: { addListener(listener) { onMessage = listener; } } },
      alarms: { create() {}, onAlarm: { addListener(listener) { onAlarm = listener; } } },
    },
  });
  vm.runInContext(source, context);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  await flush();
  return {
    storage,
    badge: () => badge,
    poll: async () => { onAlarm(); await flush(); },
    nums: () => new Promise(resolve => onMessage({ getNums: true }, {}, resolve)),
  };
}

test('hidden charge-only updates do not increase the extension badge or video reminders', async () => {
  const app = await background([video('new', true), video('baseline')], { hideChargeOnly: true });
  assert.equal(app.badge(), '');
  assert.equal((await app.nums()).video, 0);
  await app.poll();
  assert.equal(app.badge(), '');
  assert.equal((await app.nums()).video, 0);
});

test('mixed updates count ordinary videos and bangumi and stop at a hidden baseline', async () => {
  const ordinary = video('ordinary');
  ordinary.modules.module_dynamic.major.archive.title = '关于充电专属的视频讨论';
  const app = await background([
    video('charge', true), ordinary,
    { id_str: 'bangumi', type: 'DYNAMIC_TYPE_PGC_UNION' },
    { id_str: 'text', type: 'DYNAMIC_TYPE_WORD' },
    video('baseline', true), video('old'),
  ], { hideChargeOnly: true });
  assert.equal(app.badge(), '2');
  const nums = await app.nums();
  assert.equal(nums.video, 1);
  assert.equal(nums.bangumi, 1);
});

test('charge-only updates still count when hiding is off, unset or invalid', async () => {
  for (const settings of [undefined, {}, { hideChargeOnly: false }, { hideChargeOnly: 'true' }]) {
    const app = await background([video('charge', true), video('baseline')], settings);
    assert.equal(app.badge(), '1');
    assert.equal((await app.nums()).video, 1);
  }
});

test('each poll reads the latest saved hiding preference', async () => {
  const app = await background([video('charge', true), video('baseline')], { hideChargeOnly: false });
  assert.equal(app.badge(), '1');
  await app.nums();
  app.storage.popupSettings = { hideChargeOnly: true };
  await app.poll();
  assert.equal(app.badge(), '');
  assert.equal((await app.nums()).video, 0);
  app.storage.popupSettings = { hideChargeOnly: false };
  await app.poll();
  assert.equal(app.badge(), '1');
});

test('badge cap applies to visible updates only', async () => {
  const items = [video('charge', true), ...Array.from({ length: 9 }, (_, i) => video(String(i)))];
  const hidden = await background(items, { hideChargeOnly: true });
  assert.equal(hidden.badge(), '9');
  const shown = await background(items, { hideChargeOnly: false });
  assert.equal(shown.badge(), '10+');
});

test('first run keeps the newest item as the baseline even if it is hidden', async () => {
  const app = await background([video('charge', true), video('old')], { hideChargeOnly: true }, null);
  assert.equal(app.storage.updateBaseline, 'charge');
  assert.equal(app.badge(), '');
  await app.poll();
  assert.equal(app.badge(), '');
  assert.equal((await app.nums()).video, 0);
});

test('video updates without archive metadata still count', async () => {
  const app = await background([{ id_str: 'new', type: 'DYNAMIC_TYPE_AV' }], { hideChargeOnly: true });
  assert.equal(app.badge(), '1');
  assert.equal((await app.nums()).video, 1);
});
