const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const source = file => readFileSync(resolve(__dirname, '../src/utils', file), 'utf8');
const moduleURL = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const load = () => import(moduleURL(source('popular.js')
  .replace('./feed.js', moduleURL(source('feed.js')))
  .replace('./history.js', moduleURL(source('history.js')))));
const state = () => ({ cards: [], page: 1, noMore: false });
const video = aid => ({ aid, bvid: `BV${aid}`, title: '热门视频', pic: 'http://i0.hdslb.com/cover.jpg',
  duration: 3723, stat: { view: 12345, danmaku: 0 }, owner: { mid: 7, name: 'UP', face: 'http://i0.hdslb.com/face.jpg' },
  rcmd_reason: { content: '热门推荐' } });

test('popular cards preserve video, author, statistics and watch-later data', async () => {
  const { appendPopularPage } = await load();
  const feed = state();
  appendPopularPage(feed, { list: [video(1)], no_more: false }, [1]);
  const card = feed.cards[0];
  assert.equal(card.media_link, 'https://www.bilibili.com/video/BV1/');
  assert.equal(card.media_cover, 'https://i0.hdslb.com/cover.jpg');
  assert.equal(card.up_link, 'https://space.bilibili.com/7/');
  assert.equal(card.up_cover, 'https://i0.hdslb.com/face.jpg');
  assert.equal(card.play, '1.2万');
  assert.equal(card.danmaku, '0');
  assert.equal(card.media_duration, '1:02:03');
  assert.equal(card.toWatch, true);
  assert.equal(card.type_, 'video');
  assert.equal(feed.page, 2);
  assert.equal(feed.noMore, false, 'short pages continue when the API has more');
});

test('popular pagination deduplicates overlapping pages and honors no_more', async () => {
  const { appendPopularPage } = await load();
  const feed = state();
  appendPopularPage(feed, { list: [video(1), video(1), video(2)], no_more: false });
  appendPopularPage(feed, { list: [video(2), video(3)], no_more: true });
  assert.deepEqual(feed.cards.map(card => card.aid), [1, 2, 3]);
  assert.equal(feed.noMore, true);
  assert.equal(feed.page, 3);
});

test('empty and repeated popular pages stop; malformed responses stay retryable', async () => {
  const { appendPopularPage } = await load();
  for (const list of [[], [video(1)]]) {
    const feed = state();
    appendPopularPage(feed, { list: [video(1)], no_more: false });
    appendPopularPage(feed, { list, no_more: false });
    assert.equal(feed.noMore, true);
  }
  const feed = state();
  assert.throws(() => appendPopularPage(feed, {}));
  assert.equal(feed.page, 1);
  assert.equal(feed.noMore, false);
  appendPopularPage(feed, { list: [null, {}, { aid: 2 }], no_more: true });
  assert.equal(feed.cards.length, 1);
  assert.equal(feed.cards[0].media_link, 'https://www.bilibili.com/video/av2/');
  assert.equal(feed.cards[0].play, '');
  assert.equal(feed.cards[0].media_duration, '');
});
