const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const load = file => import(`data:text/javascript;base64,${readFileSync(resolve(__dirname, '../src/utils', file)).toString('base64')}`);

function video(id, badge = '', extra = {}) {
  return { id_str: id, type: 'DYNAMIC_TYPE_AV', modules: {
    module_author: { name: 'UP', jump_url: '//space.bilibili.com/1', face: 'face', pub_time: '刚刚' },
    module_dynamic: { major: { archive: { aid: id, title: '视频', cover: 'cover', jump_url: '//bilibili.com/video/BV1',
      badge: { text: badge }, duration_text: '1:02:03', stat: { play: '1.2万', danmaku: 0 }, ...extra } } },
  } };
}

test('all-filtered pages preserve the server cursor and continue to later ordinary videos', async () => {
  const { createFeedState, appendDynamicPage, visibleCards } = await load('feed.js');
  const state = createFeedState();
  appendDynamicPage(state, { has_more: true, offset: 'server-cursor-1', items: [video('1', '充电专属')] });
  assert.equal(visibleCards(state.cards, true).length, 0);
  assert.equal(state.offset, 'server-cursor-1');
  assert.equal(state.noMore, false);
  appendDynamicPage(state, { has_more: false, offset: 'server-cursor-2', items: [video('2')] });
  assert.deepEqual(visibleCards(state.cards, true).map(card => card.aid), ['2']);
  assert.equal(visibleCards(state.cards, false).length, 2);
  assert.equal(state.noMore, true);
});

test('does not truncate pages or stop at an unsupported item, deduplicates repeated pages', async () => {
  const { createFeedState, appendDynamicPage } = await load('feed.js');
  const state = createFeedState();
  const items = [{ id_str: 'unknown', type: 'DYNAMIC_TYPE_WORD' }, ...Array.from({ length: 12 }, (_, i) => video(String(i)))];
  const page = { has_more: true, offset: 'opaque-cursor', items };
  appendDynamicPage(state, page);
  assert.equal(state.cards.length, 12);
  assert.equal(state.noMore, false);
  appendDynamicPage(state, page);
  assert.equal(state.cards.length, 12);
  assert.equal(state.noMore, true, 'a non-advancing cursor stops automatic requests');
});

test('uses the charge badge, preserves API statistics and watch-later state', async () => {
  const { createFeedState, appendDynamicPage } = await load('feed.js');
  const state = createFeedState();
  appendDynamicPage(state, { items: [video('1', '', { title: '关于充电专属的视频讨论' }), video('2', '充电专属')] }, [1]);
  assert.equal(state.cards[0].isChargeOnly, false);
  assert.equal(state.cards[1].isChargeOnly, true);
  assert.equal(state.cards[0].play, '1.2万');
  assert.equal(state.cards[0].danmaku, '0');
  assert.equal(state.cards[0].media_duration, '1:02:03');
  assert.equal(state.cards[0].toWatch, true);
});

test('folded collaboration posts retain the authors across pages', async () => {
  const { createFeedState, appendDynamicPage } = await load('feed.js');
  const state = createFeedState();
  const origin = video('1');
  origin.modules.module_fold = { ids: ['2'] };
  const collaborator = video('2');
  collaborator.modules.module_author.jump_url = '//space.bilibili.com/2';
  appendDynamicPage(state, { has_more: true, offset: '1', items: [origin] });
  appendDynamicPage(state, { has_more: false, offset: '2', items: [collaborator] });
  assert.equal(state.cards.length, 1);
  assert.equal(state.extraAuthors['1'][0].up_link, '//space.bilibili.com/2');
});

test('PGC and missing statistics do not fabricate zero values or duration', async () => {
  const { createFeedState, appendDynamicPage, formatCount } = await load('feed.js');
  const state = createFeedState();
  const item = video('1');
  item.type = 'DYNAMIC_TYPE_PGC_UNION';
  item.modules.module_dynamic.major = { pgc: { epid: 5, title: '番剧', stat: { play: 12000 } } };
  appendDynamicPage(state, { items: [item] });
  assert.equal(state.cards[0].type_, 'pgc');
  assert.equal(state.cards[0].play, '1.2万');
  assert.equal(state.cards[0].danmaku, '');
  assert.equal(state.cards[0].media_duration, '');
  assert.equal(formatCount(undefined), '');
  assert.equal(formatCount(0), '0');
  assert.equal(formatCount(100000000), '1亿');
});

test('live page keys remain unique across pages', async () => {
  const { createFeedState, appendLivePage } = await load('feed.js');
  const state = createFeedState();
  appendLivePage(state, { list: Array.from({ length: 10 }, (_, uid) => ({ uid })) });
  appendLivePage(state, { list: [{ uid: 9 }, { uid: 10 }] });
  assert.equal(state.cards.length, 11);
  assert.equal(state.page, 3);
  assert.equal(state.noMore, true);
});

test('settings migrate missing fields, clamp popup dimensions and ignore corrupt values', async () => {
  const { DEFAULT_SETTINGS, normalizeSettings, visibleTabs } = await load('settings.js');
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  const settings = normalizeSettings({ showBangumi: false, showLive: false, showHistory: false, showPopular: false, popupWidth: 900, popupHeight: 10, hideChargeOnly: 'true' });
  assert.deepEqual(visibleTabs(settings), ['1']);
  assert.equal(settings.popupWidth, 800);
  assert.equal('popupHeight' in settings, false);
  assert.equal(settings.hideChargeOnly, false);
  assert.equal(normalizeSettings({ popupWidth: NaN }).popupWidth, 560);
  assert.equal('popupHeight' in normalizeSettings({ popupHeight: 400 }), false);
});

test('badge preferences migrate enabled and remain independent of tabs and each other', async () => {
  const { normalizeSettings, visibleTabs } = await load('settings.js');
  const defaults = normalizeSettings({ showLive: false });
  assert.equal(defaults.showVideoBadge, true);
  assert.equal(defaults.showLiveBadge, true);
  assert.equal(defaults.showPopular, true);
  for (const showVideoBadge of [false, true]) {
    for (const showLiveBadge of [false, true]) {
      const settings = normalizeSettings({ showVideoBadge, showLiveBadge });
      assert.equal(settings.showVideoBadge, showVideoBadge);
      assert.equal(settings.showLiveBadge, showLiveBadge);
      assert.deepEqual(visibleTabs(settings), ['1', '2', '3', '4', '5']);
    }
  }
  assert.equal(normalizeSettings({ showVideoBadge: 'false', showLiveBadge: null }).showVideoBadge, true);
});

test('columns default to automatic, support manual 1–4 and reject invalid saved values', async () => {
  const { normalizeSettings, columnCount } = await load('settings.js');
  for (const [width, count] of [[380, 2], [560, 2], [579, 2], [580, 3], [759, 3], [760, 4], [800, 4]]) {
    assert.equal(columnCount(normalizeSettings({ popupWidth: width })), count);
  }
  for (const count of [1, 2, 3, 4]) {
    assert.equal(columnCount(normalizeSettings({ columns: count })), count);
  }
  assert.equal(normalizeSettings({ columns: 0 }).columns, 'auto');
  assert.equal(normalizeSettings({ columns: 5 }).columns, 'auto');
  assert.equal(normalizeSettings({}).hideScrollbar, false);
  assert.equal(normalizeSettings({ hideScrollbar: true }).hideScrollbar, true);
});

test('history progress covers completed, partial, zero and missing values', async () => {
  const { watchProgress, formatDuration } = await load('history.js');
  assert.deepEqual(watchProgress(90, 360), { percent: 25, text: '已看 01:30', label: '已看 01:30 / 06:00' });
  assert.equal(watchProgress(-1, 360).percent, 100);
  assert.equal(watchProgress(500, 360).text, '已看完');
  assert.equal(watchProgress(0, 360).percent, 0);
  assert.equal(watchProgress(30, 0).percent, null);
  assert.equal(watchProgress(undefined, 360).percent, null);
  assert.equal(formatDuration(3723), '1:02:03');
});

test('history cards retain recorded parts and PGC destinations without inventing progress', async () => {
  const { historyCard } = await load('history.js');
  const item = { kid: 1, uri: '', title: '历史', history: { bvid: 'BV1', page: 3, business: 'archive' },
    duration: 360, progress: 90, author_mid: 2, author_face: 'face', view_at: 100 };
  const card = historyCard(item, '刚刚');
  assert.equal(card.media_link, 'https://www.bilibili.com/video/BV1/?p=3');
  assert.equal(card.watch_progress.percent, 25);
  assert.equal(card.up_cover, 'face');
  assert.equal(card.viewed_at, '刚刚');
  const pgc = historyCard({ ...item, uri: '//www.bilibili.com/bangumi/play/ep1', history: { business: 'pgc' } }, '刚刚');
  assert.equal(pgc.media_link, 'https://www.bilibili.com/bangumi/play/ep1');
  assert.equal(pgc.watch_progress, null);
  assert.equal(historyCard({ history: {} }, ''), null);
});
