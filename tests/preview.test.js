const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const load = file => import(`data:text/javascript;base64,${readFileSync(resolve(__dirname, '../src/utils', file)).toString('base64')}`);
const sheet = (extra = {}) => ({ img_x_len: 2, img_y_len: 2, img_x_size: 160, img_y_size: 90,
  image: ['//i0.hdslb.com/first.jpg', 'http://i0.hdslb.com/second.jpg'], index: [0, 10, 20, 30, 40, 50, 60], ...extra });

test('preview targets distinguish archive, episode and history parts without using episode IDs as aids', async () => {
  const { normalizePreviewTarget, previewTargetKey } = await load('preview.js');
  assert.equal(previewTargetKey({ aid: '42' }), 'av42::1');
  assert.equal(previewTargetKey({ epid: 42 }), 'ep42::1');
  assert.equal(previewTargetKey({ bvid: 'BV1xx411c7mD', cid: 12, page: 2 }), 'BV1xx411c7mD:12:2');
  assert.notEqual(previewTargetKey({ aid: 42, cid: 12 }), previewTargetKey({ aid: 42, cid: 13 }));
  for (const value of [null, {}, { aid: -1 }, { bvid: 'BVwrong' }, { aid: Infinity }, { aid: '9'.repeat(400) }]) {
    assert.equal(normalizePreviewTarget(value), null);
  }
});

test('snapshot selection crosses rows and sheets, honors timestamps and bounds both ends', async () => {
  const { normalizePreviewData, previewFrame } = await load('preview.js');
  const data = normalizePreviewData(sheet(), '01:00');
  assert.equal(data.duration, 60);
  assert.deepEqual(data.images, ['https://i0.hdslb.com/first.jpg', 'https://i0.hdslb.com/second.jpg']);
  const start = previewFrame(data, -1);
  assert.equal(start.index, 1, 'the first reserved sprite cell is skipped');
  assert.equal(start.style.backgroundPosition, '100% 0%');
  assert.equal(previewFrame(data, 19 / 60).index, 2);
  assert.equal(previewFrame(data, 20 / 60).style.backgroundPosition, '100% 100%');
  const nextSheet = previewFrame(data, 0.5);
  assert.equal(nextSheet.url, data.images[1]);
  assert.equal(nextSheet.style.backgroundPosition, '0% 0%');
  assert.equal(nextSheet.style.backgroundSize, '200% 200%');
  assert.equal(previewFrame(data, 2).index, 7);
  assert.equal(previewFrame(data, NaN).index, 1);
});

test('missing trailing sprites, duplicate timestamps and one-cell sheets stay in range', async () => {
  const { normalizePreviewData, previewFrame } = await load('preview.js');
  const short = normalizePreviewData(sheet({ image: ['//i0.hdslb.com/one.jpg'], index: [0, 0, 5, 10, 20] }), 60);
  assert.equal(previewFrame(short, 0).index, 2);
  assert.equal(previewFrame(short, 1).index, 3);
  assert.equal(previewFrame(short, 1).url, short.images[0]);
  const single = normalizePreviewData(sheet({ img_x_len: 1, img_y_len: 1, image: ['//i0.hdslb.com/one.jpg'], index: [0] }));
  assert.equal(previewFrame(single, 1).index, 0);
  assert.equal(previewFrame(single, 1).style.backgroundPosition, '0% 0%');
});

test('invalid or incomplete sheets fail closed instead of rendering unsafe or incorrect frames', async () => {
  const { normalizePreviewData } = await load('preview.js');
  for (const data of [null, sheet({ image: [] }), sheet({ index: [] }), sheet({ img_x_len: 0 }),
    sheet({ img_y_len: 1.5 }), sheet({ index: [0, 20, 10] }), sheet({ index: [0, NaN] }),
    sheet({ image: ['javascript:alert(1)'] }), sheet({ image: [null] }), sheet({ image: ['not-a-url'] })]) {
    assert.equal(normalizePreviewData(data), null);
  }
});

test('concurrent hovers share one request and successful data is reused across cards', async () => {
  const { createPreviewLoader } = await load('preview.js');
  let calls = 0;
  let complete;
  const loader = createPreviewLoader(() => { calls++; return new Promise(resolve => { complete = resolve; }); });
  const first = loader({ aid: 42 });
  const second = loader({ aid: 42 });
  assert.equal(calls, 1);
  complete({ code: 0, data: sheet(), duration: 60 });
  assert.equal(await first, await second);
  assert.equal(await loader({ aid: 42 }), await first);
  assert.equal(calls, 1);
  assert.equal(await loader(null), null);
  assert.equal(calls, 1, 'unsupported cards never request preview data');
});

test('transient failures remain retryable and incomplete indexes are retried before caching', async () => {
  const { createPreviewLoader } = await load('preview.js');
  let calls = 0;
  const loader = createPreviewLoader(async () => {
    calls++;
    if (calls === 1) throw new Error('offline');
    return { code: 0, data: sheet({ index: calls === 2 ? [] : [0, 10, 20] }) };
  });
  await assert.rejects(loader({ aid: 42 }), /offline/);
  assert.ok(await loader({ aid: 42 }));
  assert.equal(calls, 3);
  await loader({ aid: 42 });
  assert.equal(calls, 3);
});

test('an unavailable part duration falls back to the snapshot timeline instead of aggregate feed duration', async () => {
  const { createPreviewLoader } = await load('preview.js');
  const loader = createPreviewLoader(async () => ({ code: 0, data: sheet(), duration: undefined }));
  const data = await loader({ aid: 42, duration: 9999 });
  assert.equal(data.duration, 60);
});

test('preview settings migrate off and bound update intervals to avoid runaway timers', async () => {
  const { normalizeSettings } = await load('settings.js');
  const defaults = normalizeSettings({});
  assert.equal(defaults.hoverPreview, false);
  assert.equal(defaults.previewDelay, true);
  assert.equal(defaults.previewAuto, true);
  assert.equal(defaults.previewInterval, 700);
  assert.equal(normalizeSettings({ previewInterval: 0 }).previewInterval, 100);
  assert.equal(normalizeSettings({ previewInterval: 99999 }).previewInterval, 2000);
  assert.equal(normalizeSettings({ previewInterval: 450.4 }).previewInterval, 450);
  for (const previewInterval of ['100', null, NaN, Infinity]) {
    assert.equal(normalizeSettings({ previewInterval }).previewInterval, 700);
  }
  const saved = normalizeSettings({ hoverPreview: true, previewDelay: false, previewAuto: false, previewInterval: 250 });
  assert.equal(saved.hoverPreview, true);
  assert.equal(saved.previewDelay, false);
  assert.equal(saved.previewAuto, false);
  assert.equal(saved.previewInterval, 250);
});
