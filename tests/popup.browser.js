/* eslint-env browser */
/* Browser smoke tests use synthetic API data and never access a Bilibili account.
 * Run after npm run build. Requires playwright (or PLAYWRIGHT_MODULE).
 */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const artwork = label => 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#19354d"/><circle cx="490" cy="100" r="150" fill="#28617a"/><text x="40" y="205" font-family="sans-serif" font-size="42" fill="white">${label}</text></svg>`).toString('base64');
function video(id, charge = false) {
  return { id_str: String(id), type: 'DYNAMIC_TYPE_AV', modules: {
    module_author: { name: '示例 UP 主', face: artwork('UP'), jump_url: '//space.bilibili.com/1', pub_time: '1 小时前' },
    module_dynamic: { major: { archive: { aid: String(id), title: charge ? '充电专属示例视频' : `探索科学与生活：第 ${id} 期视频更新`,
      jump_url: '//www.bilibili.com/video/BV1', cover: artwork(charge ? '专属视频' : `VIDEO ${id}`), badge: { text: charge ? '充电专属' : '' },
      stat: { play: '12.3万', danmaku: '4567' }, duration_text: '1:02:03' } } },
  } };
}
const server = http.createServer((req, res) => {
  const name = path.basename(new URL(req.url, 'http://localhost').pathname);
  const file = path.join(__dirname, '../dist', name || 'popup.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : 'text/html');
  fs.createReadStream(file).pipe(res);
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run(browserName, baseURL) {
  const launch = { headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] };
  if (browserName === 'edge') launch.channel = 'msedge';
  else if (process.env.CHROMIUM_EXECUTABLE) launch.executablePath = process.env.CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(launch);
  try {
    const context = await browser.newContext({ viewport: { width: 560, height: 600 }, colorScheme: 'dark' });
    await context.addInitScript(() => {
      window.testState = { writes: [], links: [], failSave: false, hasCookie: true };
      window.chrome = {
        storage: { local: {
          get: async key => ({ [key]: JSON.parse(localStorage.getItem(key) || 'null') }),
          set: async value => {
            if (window.testState.failSave) throw new Error('test save failure');
            for (const [key, settings] of Object.entries(value)) localStorage.setItem(key, JSON.stringify(settings));
            window.testState.writes.push(value);
          },
        } },
        permissions: { contains: async () => true },
        runtime: { sendMessage: async message => message.getNums ? { video: 1, bangumi: 1 } : message.getLoginStatus ? 0 : { status: 'received' } },
        tabs: { create: async options => window.testState.links.push(options.url) },
        cookies: { get: async () => window.testState.hasCookie ? { value: 'synthetic-test-token' } : null },
      };
    });
    const requests = [];
    let failWatch = false;
    let failFeed = false;
    let allCharge = false;
    let delayVideo = false;
    let failHistory = false;
    let failPopular = false;
    let delayPopular = false;
    let emptyPopular = false;
    const popularRequests = [];
    const popularItem = aid => ({ aid, bvid: `BVpopular${aid}`, title: `热门视频示例 ${aid}`,
      pic: artwork(`POPULAR ${aid}`), owner: { mid: 1, name: '热门 UP 主', face: artwork('UP') },
      stat: { view: 12345, danmaku: 456 }, duration: 3723 });
    const historyRequests = [];
    const historyTime = Math.floor(Date.now() / 1000);
    const historyItem = (index, progress) => ({ kid: index + 1, cover: artwork('历史'), uri: '',
      history: { bvid: `BV${index + 1}`, business: 'archive', page: index === 0 ? 2 : 1, dt: [2, 3, 6, 33, 99][index] },
      progress, duration: 360, title: `历史记录示例 ${index + 1}`, author_mid: 1,
      author_face: artwork('UP'), author_name: '示例 UP 主', view_at: historyTime - index });
    await context.route('https://**.bilibili.com/**', async route => {
      const url = new URL(route.request().url());
      requests.push(url.href);
      let data;
      if (url.pathname.endsWith('/feed/all')) {
        if (delayVideo && url.searchParams.get('type') === 'video') await delay(180);
        if (failFeed) { await route.fulfill({ json: { code: -500, data: null } }); return; }
        if (url.searchParams.get('type') === 'pgc') {
          const pgc = video('pgc');
          pgc.type = 'DYNAMIC_TYPE_PGC_UNION';
          pgc.modules.module_dynamic.major = { pgc: { epid: 1, title: '番剧示例', jump_url: '//bilibili.com/bangumi/play/ep1', cover: artwork('番剧'), stat: { play: '2万', danmaku: '32' } } };
          data = { has_more: false, items: [pgc] };
        } else if (!url.searchParams.get('offset')) {
          data = { has_more: true, offset: 'opaque-next', items: Array.from({ length: 6 }, (_, i) => video(i + 1, allCharge || i === 0)) };
        } else {
          data = { has_more: false, offset: 'opaque-end', items: [video(7)] };
        }
      } else if (url.pathname.endsWith('/popular')) {
        popularRequests.push(url.searchParams.get('pn'));
        if (delayPopular) await delay(180);
        if (failPopular) { await route.fulfill({ json: { code: -500, data: null } }); return; }
        data = emptyPopular ? { list: [], no_more: true } : url.searchParams.get('pn') === '1'
          ? { list: Array.from({ length: 6 }, (_, i) => popularItem(i + 1)), no_more: false }
          : { list: [popularItem(6), popularItem(7)], no_more: true };
      } else if (url.pathname.endsWith('/feed_list')) {
        data = { list: [{ roomid: 1, uid: 1, title: '直播示例', link: 'https://live.bilibili.com/1', uname: '主播', pic: artwork('直播'), face: artwork('UP'), watched_show: { text_large: '200 人看过' } }] };
      } else if (url.pathname.endsWith('/history/cursor')) {
        historyRequests.push(Object.fromEntries(url.searchParams));
        await delay(120);
        if (failHistory) { await route.fulfill({ json: { code: -500, data: null } }); return; }
        const max = url.searchParams.get('max');
        data = !max || max === '0'
          ? { cursor: { max: 4, view_at: historyTime - 3, business: 'archive' }, list: [90, -1, 0, undefined].map((progress, index) => historyItem(index, progress)) }
          : max === '4'
            ? { cursor: { max: 5, view_at: historyTime - 4, business: 'archive' }, list: [historyItem(3), historyItem(4, 120)] }
            : { cursor: { max: 0, view_at: 0, business: '' }, list: [] };
      } else if (url.pathname.endsWith('/toview')) {
        data = { list: [{ aid: 2 }] };
      } else if (url.pathname.endsWith('/add') || url.pathname.endsWith('/del')) {
        await route.fulfill({ json: { code: failWatch ? -101 : 0 } }); return;
      } else throw new Error(`Unexpected API request: ${url.pathname}`);
      await route.fulfill({ json: { code: 0, data } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL + '/popup.html');
    await page.locator('.card').nth(5).waitFor();
    assert.equal(await page.locator('.stat').first().innerText(), '12.3万');
    assert.equal(await page.locator('.duration').first().innerText(), '1:02:03');
    assert.equal(await page.locator('.watch-later').nth(1).getAttribute('aria-pressed'), 'true');
    await page.locator('.card').first().hover();
    await page.getByRole('button', { name: '添加稍后再看', exact: true }).first().click();
    await page.waitForFunction(() => document.querySelector('.watch-later').getAttribute('aria-pressed') === 'true');
    failWatch = true;
    await page.locator('.watch-later').first().click();
    await page.getByText('操作失败，请重试').waitFor();
    assert.equal(await page.locator('.watch-later').first().getAttribute('aria-pressed'), 'true');
    failWatch = false;
    await page.locator('.watch-later').first().click();
    await page.waitForFunction(() => document.querySelector('.watch-later').getAttribute('aria-pressed') === 'false');

    const gear = page.getByRole('button', { name: '设置', exact: true });
    const videoBadge = page.getByRole('tab', { name: /投稿/ }).locator('.label-badge');
    const liveBadge = page.getByRole('tab', { name: /直播/ }).locator('.label-badge');
    await liveBadge.waitFor({ state: 'visible' });
    await gear.click();
    await page.getByRole('switch', { name: '投稿页红点提示', exact: true }).uncheck();
    assert.equal(await videoBadge.isVisible(), false);
    assert.equal(await liveBadge.isVisible(), true);
    await page.getByRole('switch', { name: '直播页红点提示', exact: true }).uncheck();
    assert.equal(await liveBadge.isVisible(), false);
    await page.getByRole('switch', { name: '投稿页红点提示', exact: true }).check();
    assert.equal(await videoBadge.isVisible(), true);
    assert.equal(await liveBadge.isVisible(), false);
    await page.getByRole('switch', { name: '投稿页红点提示', exact: true }).uncheck();
    const liveBadgeRequests = () => requests.filter(url => new URL(url).searchParams.get('pagesize') === '11').length;
    const beforeDisabledReload = liveBadgeRequests();
    await page.reload();
    await page.locator('.card').nth(5).waitFor();
    await delay(1300);
    assert.equal(await videoBadge.isVisible(), false);
    assert.equal(await liveBadge.isVisible(), false);
    assert.equal(liveBadgeRequests(), beforeDisabledReload, 'disabled live badges do not fetch a badge count');
    await gear.click();
    assert.equal(await page.getByRole('switch', { name: '投稿页红点提示', exact: true }).isChecked(), false);
    assert.equal(await page.getByRole('switch', { name: '直播页红点提示', exact: true }).isChecked(), false);
    await page.getByRole('button', { name: '恢复默认' }).click();
    await liveBadge.waitFor({ state: 'visible' });
    assert.equal(await videoBadge.isVisible(), true);
    await gear.click();
    assert.equal(await gear.getAttribute('title'), null);
    const scrollLayout = await page.evaluate(() => {
      const scroller = document.querySelector('#popup-content') || document.body;
      return { top: scroller.getBoundingClientRect().top, headerBottom: document.querySelector('.toolbar').getBoundingClientRect().bottom };
    });
    assert.ok(scrollLayout.top >= scrollLayout.headerBottom, 'scrollbar starts below the toolbar');
    const toolbarX = (await gear.boundingBox()).x;
    const contentWidth = await page.locator('#popup-content').evaluate(el => el.clientWidth);
    await gear.click();
    assert.equal((await gear.boundingBox()).x, toolbarX, 'settings toggle does not shift the gear');
    assert.equal(await page.locator('#popup-content').evaluate(el => el.clientWidth), contentWidth);
    await page.getByRole('switch', { name: /隐藏充电专属视频/ }).check();
    await page.getByRole('switch', { name: '显示稍后再看按钮' }).uncheck();
    await gear.click();
    assert.equal(await page.locator('.card').count(), 5);
    assert.equal(await page.locator('.watch-later').count(), 0);
    await page.reload();
    await page.locator('.card').nth(4).waitFor();
    assert.equal(await page.locator('.watch-later').count(), 0);
    assert.equal(await page.getByText('充电专属示例视频', { exact: true }).count(), 0);
    await page.evaluate(() => document.getElementById('popup-content').scrollTo(0, document.getElementById('popup-content').scrollHeight));
    await page.getByText('探索科学与生活：第 7 期视频更新', { exact: true }).waitFor();
    assert.equal(await page.locator('.card').count(), 6, 'scrolling the content area loads the next page');

    await page.getByRole('tab', { name: /直播/ }).click();
    await page.getByText('直播示例', { exact: true }).waitFor();
    await gear.click();
    for (const label of ['番剧', '直播', '历史', '热门']) await page.getByRole('switch', { name: label, exact: true }).uncheck();
    assert.equal(await page.getByRole('tab').count(), 1);
    await gear.click();
    assert.equal(await page.getByRole('tab', { name: /投稿/ }).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('3');
    await page.keyboard.press('5');
    assert.equal(await page.getByRole('tab', { name: /投稿/ }).getAttribute('aria-selected'), 'true');
    await gear.click();
    await page.evaluate(() => { window.testState.failSave = true; });
    await page.getByRole('switch', { name: '历史', exact: true }).check();
    await page.getByText('保存失败，请重新调整设置后重试').waitFor();
    await page.evaluate(() => { window.testState.failSave = false; });
    await page.getByRole('button', { name: '恢复默认' }).click();
    await page.waitForFunction(() => !document.querySelector('.save-error'));
    assert.equal(await page.locator('#popup-height').count(), 0);
    assert.equal(await page.getByText('更改自动保存').count(), 0);
    await page.getByRole('spinbutton', { name: '宽度', exact: true }).fill('623');
    await page.getByRole('spinbutton', { name: '宽度', exact: true }).press('Enter');
    await page.waitForFunction(() => document.documentElement.getBoundingClientRect().width === 623);
    assert.equal(await page.locator('#popup-width').inputValue(), '623');
    await page.locator('#popup-width-value').fill('');
    await page.locator('#popup-width-value').press('Enter');
    assert.equal(await page.locator('#popup-width-value').inputValue(), '623');
    await page.locator('#popup-width-value').fill('900');
    await page.locator('#popup-width-value').press('Enter');
    await page.waitForFunction(() => document.documentElement.getBoundingClientRect().width === 800);

    for (const width of [380, 560, 580, 760, 800]) {
      await page.locator('#popup-width').fill(String(width));
      await page.locator('#popup-width').dispatchEvent('input');
      await page.setViewportSize({ width, height: 600 });
      await page.waitForFunction(w => document.documentElement.getBoundingClientRect().width === w, width);
      await gear.click();
      await page.locator('.card').first().waitFor();
      const count = await page.locator('.main .card-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      assert.equal(count, { 380: 2, 560: 2, 580: 3, 760: 4, 800: 4 }[width]);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'no horizontal overflow');
      const overlap = await page.locator('.video-stats').first().evaluate(el => el.querySelector('.counts').getBoundingClientRect().right > el.querySelector('.duration').getBoundingClientRect().left);
      assert.equal(overlap, false, `statistics fit at ${width}px`);
      await gear.click();
    }
    for (const width of [380, 560, 800]) {
      await page.locator('#popup-width').fill(String(width));
      await page.locator('#popup-width').dispatchEvent('input');
      await page.setViewportSize({ width, height: 600 });
      for (const count of ['1', '2', '3', '4']) {
        await page.getByLabel('列数', { exact: true }).selectOption(count);
        await gear.click();
        assert.equal(await page.locator('.main .card-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), Number(count));
        assert.ok(await page.locator('.main .card').first().evaluate(el => el.scrollWidth <= el.clientWidth), `card fits ${width}px / ${count} columns`);
        if (width === 800 && count === '4' && process.env.SCREENSHOT_DIR && browserName === 'edge') {
          fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
          await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'videos-4-columns.png') });
        }
        await gear.click();
      }
    }
    await page.reload();
    await gear.click();
    assert.equal(await page.locator('#popup-width').inputValue(), '800');
    assert.equal(await page.getByLabel('列数', { exact: true }).inputValue(), '4');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).height), '600px');
    await page.getByRole('button', { name: '恢复默认' }).click();
    await page.setViewportSize({ width: 560, height: 600 });
    if (process.env.SCREENSHOT_DIR && browserName === 'edge') {
      fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
      await page.evaluate(() => document.getElementById('popup-content').scrollTo(0, 0));
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'settings-dark.png'), fullPage: true });
      await gear.click();
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'videos-dark.png') });
      await page.emulateMedia({ colorScheme: 'light' });
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'videos-light.png') });
      await gear.click();
      await page.evaluate(() => document.getElementById('popup-content').scrollTo(0, 0));
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'settings-light.png'), fullPage: true });
    }
    if (await gear.getAttribute('aria-expanded') === 'true') await gear.click();
    await page.getByRole('tab', { name: '历史', exact: true }).click();
    await page.getByText('历史记录示例 1', { exact: true }).waitFor();
    const history = page.locator('.history-list');
    assert.equal(await history.locator('.card').count(), 4);
    assert.equal(await history.getByRole('progressbar').nth(0).getAttribute('aria-valuenow'), '25');
    assert.equal(await history.getByRole('progressbar').nth(1).getAttribute('aria-valuenow'), '100');
    assert.equal(await history.getByRole('progressbar').nth(2).getAttribute('aria-valuenow'), '0');
    assert.equal(await history.getByRole('progressbar').count(), 3);
    await history.getByText('已看 01:30').waitFor();
    await history.getByText('已看完').waitFor();
    await history.locator('.title-link').first().click();
    assert.equal(await page.evaluate(() => window.testState.links.at(-1)), 'https://www.bilibili.com/video/BV1/?p=2');
    // Scrolling appends history with the complete server cursor; failures keep
    // the first page and retry the same cursor without parallel requests.
    failHistory = true;
    await page.locator('#popup-content').evaluate(el => {
      el.scrollTop = el.scrollHeight;
      for (let i = 0; i < 5; i++) el.dispatchEvent(new Event('scroll'));
    });
    await history.getByText('加载失败，请重试').waitFor({ timeout: 3000 });
    assert.equal(await history.locator('.card').count(), 4);
    assert.equal(historyRequests.filter(params => params.max === '4').length, 1);
    assert.deepEqual(historyRequests.at(-1), { type: 'archive', ps: '20', max: '4', view_at: String(historyTime - 3), business: 'archive' });
    failHistory = false;
    await history.getByRole('button', { name: '重试', exact: true }).click();
    await history.getByText('历史记录示例 5', { exact: true }).waitFor();
    assert.equal(await history.locator('.card').count(), 5, 'overlapping history pages are deduplicated');
    assert.deepEqual(historyRequests.at(-1), historyRequests.at(-2), 'retry preserves the cursor');
    const beforeSettingsScroll = historyRequests.length;
    await gear.click();
    await page.locator('#popup-content').evaluate(el => el.scrollTo(0, el.scrollHeight));
    await delay(180);
    assert.equal(historyRequests.length, beforeSettingsScroll, 'settings scrolling does not load hidden history');
    await gear.click();
    await page.locator('#popup-content').evaluate(el => el.scrollTo(0, el.scrollHeight));
    await history.getByText('没有更多了', { exact: true }).waitFor();
    const completedRequests = historyRequests.length;
    await page.locator('#popup-content').dispatchEvent('scroll');
    await delay(180);
    assert.equal(historyRequests.length, completedRequests, 'empty page stops pagination');
    assert.deepEqual(await history.locator('.watch-device').evaluateAll(els => els.map(el => el.getAttribute('title'))),
      ['电脑端观看', '手机端观看', '平板端观看', '电视端观看', '未知观看平台']);
    const deviceLayout = await history.locator('.viewed-at').first().evaluate(el => {
      const text = el.querySelector('.viewed-time').getBoundingClientRect();
      const icon = el.querySelector('.watch-device').getBoundingClientRect();
      return { fits: text.right <= icon.left, aligned: Math.abs((text.top + text.bottom) / 2 - (icon.top + icon.bottom) / 2) < 1,
        right: Math.abs(icon.right - el.getBoundingClientRect().right) < 1 };
    });
    assert.deepEqual(deviceLayout, { fits: true, aligned: true, right: true });
    await page.locator('#popup-content').evaluate(el => el.scrollTo(0, 0));
    if (process.env.SCREENSHOT_DIR && browserName === 'edge') {
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'history-light.png') });
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'history-dark.png') });
    }
    await gear.click();
    await page.getByLabel('列数', { exact: true }).selectOption('4');
    await gear.click();
    assert.equal(await history.locator('.card-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 4);
    await gear.click();
    await page.getByRole('button', { name: '恢复默认' }).click();
    await gear.click();

    // Long and short tabs share one scroll container below a stationary header.
    for (const width of [380, 800]) {
      await gear.click();
      await page.locator('#popup-width').fill(String(width));
      await page.locator('#popup-width').dispatchEvent('input');
      await page.setViewportSize({ width, height: 600 });
      for (const hidden of [false, true]) {
        await page.getByRole('switch', { name: '隐藏滚动条', exact: true }).setChecked(hidden);
        const position = (await gear.boundingBox()).x;
        const topPosition = (await gear.boundingBox()).y;
        const scroller = page.locator('#popup-content');
        const stableWidth = await scroller.evaluate(el => el.clientWidth);
        if (hidden) {
          assert.equal(await scroller.evaluate(el => getComputedStyle(el).scrollbarWidth), 'none');
          assert.equal(await scroller.evaluate(el => el.offsetWidth - el.clientWidth), 0);
        } else {
          assert.equal(await scroller.evaluate(el => getComputedStyle(el, '::-webkit-scrollbar').width), '4px');
        }
        for (const label of ['投稿', '直播', '历史', '热门']) {
          await page.getByRole('tab', { name: new RegExp(label) }).click();
          assert.equal((await gear.boundingBox()).x, position);
          assert.equal(await scroller.evaluate(el => el.clientWidth), stableWidth);
          assert.equal(await page.evaluate(() => document.body.scrollTop), 0);
        }
        await page.getByRole('tab', { name: /投稿/ }).click();
        await scroller.evaluate(el => el.scrollTo(0, el.scrollHeight));
        if (width === 380) assert.ok(await scroller.evaluate(el => el.scrollTop > 0), 'hidden scrollbars preserve scrolling');
        assert.equal((await gear.boundingBox()).y, topPosition, 'header stays fixed while content scrolls');
        await gear.click();
        assert.equal((await gear.boundingBox()).x, position);
        assert.equal(await scroller.evaluate(el => el.clientWidth), stableWidth);
      }
      await gear.click();
    }
    await page.reload();
    await gear.click();
    assert.equal(await page.getByRole('switch', { name: '隐藏滚动条', exact: true }).isChecked(), true);
    await page.getByRole('button', { name: '恢复默认' }).click();
    await gear.click();
    await page.setViewportSize({ width: 560, height: 600 });

    // A delayed video response must not overwrite the selected PGC tab.
    delayVideo = true;
    await page.evaluate(() => localStorage.setItem('activeTab', '1'));
    await page.reload();
    await page.getByRole('tab', { name: /番剧/ }).click();
    await page.getByText('番剧示例', { exact: true }).waitFor();
    await delay(250);
    assert.equal(await page.locator('.card').count(), 1);
    await page.getByRole('tab', { name: /投稿/ }).click();
    await page.locator('.card').nth(5).waitFor();
    delayVideo = false;
    // Filtered first pages must still request the opaque server cursor.
    allCharge = true;
    await gear.click();
    await page.getByRole('switch', { name: /隐藏充电专属视频/ }).check();
    await page.reload();
    await page.getByText('探索科学与生活：第 7 期视频更新', { exact: true }).waitFor();
    assert.ok(requests.some(url => new URL(url).searchParams.get('offset') === 'opaque-next'));
    assert.equal(await page.locator('.card').count(), 1);
    // Empty and failed requests stay actionable.
    failFeed = true;
    await page.reload();
    await page.getByText('加载失败，请重试').waitFor();
    failFeed = false;
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await page.getByText('探索科学与生活：第 7 期视频更新', { exact: true }).waitFor();

    // At four columns the short first page cannot fill the viewport. History
    // must request subsequent pages without waiting for a scroll event.
    await gear.click();
    await page.locator('#popup-width').fill('800');
    await page.locator('#popup-width').dispatchEvent('input');
    await page.getByLabel('列数', { exact: true }).selectOption('4');
    await page.setViewportSize({ width: 800, height: 600 });
    const beforeAutoFill = historyRequests.length;
    await page.getByRole('tab', { name: '历史', exact: true }).click();
    await history.getByText('没有更多了', { exact: true }).waitFor();
    assert.equal(await history.locator('.card').count(), 5);
    assert.deepEqual(historyRequests.slice(beforeAutoFill).map(params => params.max), ['0', '4', '5']);
    failHistory = true;
    await page.reload();
    await history.getByText('加载失败，请重试').waitFor();
    assert.equal(await history.locator('.card').count(), 0);
    failHistory = false;
    await history.getByRole('button', { name: '重试', exact: true }).click();
    await history.getByText('没有更多了', { exact: true }).waitFor();
    assert.equal(await history.locator('.card').count(), 5, 'initial history failure can be retried');

    // Popular uses the same grid, preserves its page on failure, and never
    // mixes a delayed response into another selected feed.
    await gear.click();
    await page.getByRole('button', { name: '恢复默认' }).click();
    await page.setViewportSize({ width: 560, height: 600 });
    await gear.click();
    await page.keyboard.press('5');
    assert.equal(await page.getByRole('tab', { name: '热门', exact: true }).getAttribute('aria-selected'), 'true');
    await page.reload();
    await page.getByText('热门视频示例 6', { exact: true }).waitFor();
    assert.equal(await page.locator('.stat').first().innerText(), '1.2万');
    assert.equal(await page.locator('.duration').first().innerText(), '1:02:03');
    assert.equal(await page.locator('.watch-later').nth(1).getAttribute('aria-pressed'), 'true');
    await page.locator('.card').first().hover();
    await page.locator('.watch-later').first().click();
    await page.waitForFunction(() => document.querySelector('.watch-later').getAttribute('aria-pressed') === 'true');
    await page.locator('.title-link').first().click();
    assert.equal(await page.evaluate(() => window.testState.links.at(-1)), 'https://www.bilibili.com/video/BVpopular1/');
    await delay(350); // Let Element UI's tab underline reach the selected tab.
    if (process.env.SCREENSHOT_DIR && browserName === 'edge') {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'popular-light.png') });
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'popular-dark.png') });
    }
    await gear.click();
    await page.locator('#popup-width').fill('380');
    await page.locator('#popup-width').dispatchEvent('input');
    await page.setViewportSize({ width: 380, height: 600 });
    await page.locator('#popup-content').evaluate(el => el.scrollTo(0, 0));
    if (process.env.SCREENSHOT_DIR && browserName === 'edge') {
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'settings-badges-380.png') });
    }
    await gear.click();
    await delay(350);
    const headerFits = await page.locator('.toolbar').evaluate(el => {
      const tabs = [...el.querySelectorAll('[role=tab]')].map(tab => tab.getBoundingClientRect());
      const gear = el.querySelector('.settings-button').getBoundingClientRect();
      return tabs.every((tab, i) => tab.left >= 0 && tab.right <= gear.left && (!i || tab.left >= tabs[i - 1].right));
    });
    assert.equal(headerFits, true, 'all five tabs fit beside settings at 380px');
    if (process.env.SCREENSHOT_DIR && browserName === 'edge') {
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'popular-380.png') });
    }
    await gear.click();
    await page.locator('#popup-width').fill('560');
    await page.locator('#popup-width').dispatchEvent('input');
    await page.setViewportSize({ width: 560, height: 600 });
    await gear.click();
    failPopular = true;
    await page.locator('#popup-content').evaluate(el => el.scrollTo(0, el.scrollHeight));
    await page.getByText('加载失败，请重试').waitFor();
    assert.equal(await page.locator('.card').count(), 6);
    failPopular = false;
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await page.getByText('热门视频示例 7', { exact: true }).waitFor();
    assert.equal(await page.locator('.card').count(), 7);
    assert.deepEqual(popularRequests.slice(-3), ['1', '2', '2']);
    await page.getByRole('button', { name: '更多热门视频', exact: true }).click();
    assert.equal(await page.evaluate(() => window.testState.links.at(-1)), 'https://www.bilibili.com/v/popular/all');
    delayPopular = true;
    await page.reload();
    await page.getByRole('tab', { name: /番剧/ }).click();
    await page.getByText('番剧示例', { exact: true }).waitFor();
    await delay(250);
    assert.equal(await page.locator('.card').count(), 1);
    await page.keyboard.press('5');
    await page.getByText('热门视频示例 6', { exact: true }).waitFor();
    delayPopular = false;
    emptyPopular = true;
    await page.reload();
    await page.getByText('暂无热门视频', { exact: true }).waitFor();
    assert.equal(await page.locator('.card').count(), 0);
    emptyPopular = false;
    failPopular = true;
    await page.reload();
    await page.getByText('加载失败，请重试').waitFor();
    failPopular = false;
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await page.getByText('热门视频示例 6', { exact: true }).waitFor();
    // Hiding the selected popular tab falls back to 投稿 and survives reopening.
    await gear.click();
    await page.getByRole('switch', { name: '热门', exact: true }).uncheck();
    await page.reload();
    assert.equal(await page.getByRole('tab', { name: '热门', exact: true }).count(), 0);
    assert.equal(await page.getByRole('tab', { name: /投稿/ }).getAttribute('aria-selected'), 'true');
    assert.deepEqual(errors, []);
    console.log(`${browserName}: settings, independent badges, persistence, tab shortcuts, watch-later, responsive layout, themes, pagination, history, popular retry/empty/race and links passed`);
    await context.close();
  } finally { await browser.close(); }
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    for (const name of (process.env.TEST_BROWSERS || 'chromium,edge').split(',')) await run(name, url);
  } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
