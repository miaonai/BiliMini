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
      } else if (url.pathname.endsWith('/feed_list')) {
        data = { list: [{ roomid: 1, uid: 1, title: '直播示例', link: 'https://live.bilibili.com/1', uname: '主播', pic: artwork('直播'), face: artwork('UP'), watched_show: { text_large: '200 人看过' } }] };
      } else if (url.pathname.endsWith('/history/cursor')) {
        data = { list: [90, -1, 0, undefined].map((progress, index) => ({ kid: index + 1, cover: artwork('历史'), uri: '',
          history: { bvid: `BV${index + 1}`, business: 'archive', page: index === 0 ? 2 : 1 }, progress, duration: 360,
          title: `历史记录示例 ${index + 1}`, author_mid: 1, author_face: artwork('UP'), author_name: '示例 UP 主', view_at: Math.floor(Date.now() / 1000) })) };
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
    for (const label of ['番剧', '直播', '历史']) await page.getByRole('switch', { name: label, exact: true }).uncheck();
    assert.equal(await page.getByRole('tab').count(), 1);
    await gear.click();
    assert.equal(await page.getByRole('tab', { name: /投稿/ }).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('3');
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
        for (const label of ['投稿', '直播', '历史']) {
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
    assert.deepEqual(errors, []);
    console.log(`${browserName}: settings, persistence, tab shortcuts, watch-later success/failure, responsive layout, themes, pagination, request race and retry passed`);
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
