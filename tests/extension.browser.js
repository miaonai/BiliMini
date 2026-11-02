/* eslint-env browser */
/* global globalThis */
// Real MV3 action popup and storage in a disposable Chromium profile.
// The headless screen can constrain popup dimensions below the requested size.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
 const context = await chromium.launchPersistentContext('', { channel: 'chromium', executablePath: process.env.CHROMIUM_EXECUTABLE, headless: true, viewport: { width: 1280, height: 900 }, args: ['--window-size=1280,900', `--disable-extensions-except=${path.resolve('dist')}`, `--load-extension=${path.resolve('dist')}`] });
 try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = worker.url().split('/')[2];
  await worker.evaluate(() => { globalThis.fetch = async () => ({ json: async () => ({ code: -101 }) }); });
  await worker.evaluate(() => chrome.storage.local.set({ popupSettings: { popupWidth: 560, popupHeight: 400 } }));
  await context.route('https://**.bilibili.com/**', route => route.fulfill({ json: { code: 0, data: { items: [], list: [], has_more: false } } }));
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.getByRole('button', { name: '设置', exact: true }).waitFor();
  await worker.evaluate(() => chrome.action.openPopup());
  await page.waitForFunction(() => chrome.extension.getViews({ type: 'popup' })[0]?.document.querySelector('.settings-button'));
  const dimensions = () => page.evaluate(() => { const popup = chrome.extension.getViews({ type: 'popup' })[0]; return { width: popup.innerWidth, height: popup.innerHeight }; });
  await new Promise(resolve => setTimeout(resolve, 800));
  const initial = await dimensions();
  console.log('Actual default popup:', initial);
  assert.ok(initial.width >= 560 && initial.width <= 800);
  assert.ok(initial.height > 0 && initial.height <= 600);
  const initialLayout = await page.evaluate(() => {
   const popup = chrome.extension.getViews({ type: 'popup' })[0];
   return { gearX: popup.document.querySelector('.settings-button').getBoundingClientRect().x,
    contentWidth: popup.document.getElementById('popup-content').clientWidth };
  });
  assert.equal(await page.evaluate(() => {
   const popup = chrome.extension.getViews({ type: 'popup' })[0];
   return popup.getComputedStyle(popup.document.documentElement).height;
  }), '600px');
  await page.evaluate(() => {
   const popup = chrome.extension.getViews({ type: 'popup' })[0];
   popup.document.querySelector('.settings-button').click();
  });
  await page.waitForFunction(() => chrome.extension.getViews({ type: 'popup' })[0]?.document.querySelector('#popup-width'));
  assert.deepEqual(await page.evaluate(() => {
   const popup = chrome.extension.getViews({ type: 'popup' })[0];
   return { gearX: popup.document.querySelector('.settings-button').getBoundingClientRect().x,
    contentWidth: popup.document.getElementById('popup-content').clientWidth };
  }), initialLayout, 'real popup settings do not shift the header or content');
  await page.evaluate(() => {
   const popup = chrome.extension.getViews({ type: 'popup' })[0];
   const input = popup.document.getElementById('popup-width'); input.value = '800';
   input.dispatchEvent(new popup.Event('input', { bubbles: true }));
  });
  await page.waitForFunction(async () => (await chrome.storage.local.get('popupSettings')).popupSettings?.popupWidth === 800);
  await new Promise(resolve => setTimeout(resolve, 400));
  const resized = await dimensions();
  console.log('Actual resized popup:', resized);
  const settings = await worker.evaluate(async () => (await chrome.storage.local.get('popupSettings')).popupSettings);
  assert.equal(settings.popupWidth, 800);
  assert.equal('popupHeight' in settings, false);
  assert.equal(resized.width, 800);
  assert.equal(resized.height, initial.height);
  const scrolled = await page.evaluate(() => {
   const popup = chrome.extension.getViews({ type: 'popup' })[0];
   popup.document.getElementById('popup-content').scrollTop = popup.document.getElementById('popup-content').scrollHeight;
   return { scroll: popup.document.getElementById('popup-content').scrollTop, bottom: popup.document.querySelector('.text-button').getBoundingClientRect().bottom, height: popup.innerHeight };
  });
  assert.ok(scrolled.scroll > 0);
  assert.ok(scrolled.bottom <= scrolled.height);
  console.log('Real MV3 popup and chrome.storage.local checks passed');
 } finally { await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
