import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const output = path.resolve(process.env.PHASE1_QA_OUTPUT || path.join(root, 'reports/qa/phase1'));
const base = process.env.AUDIT_URL || 'http://127.0.0.1:4173';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Use a local test server only');
const key = 'flowers-speak:cloud-candidate:collection:v2';
const legacyKey = 'flowers-speak:cloud-candidate:collection:v1';
const backupKey = `${key}:recovery`;
const legacy = { version: 1, entries: [
  { key: 'lotus', recognizedAt: '2026-10-14T10:00:00.000Z', method: 'image-target', targetIndex: 3 },
  { key: 'peony', recognizedAt: '2026-10-14T11:00:00.000Z', method: 'image-target', targetIndex: 1 }
] };
const empty = { version: 2, catalogueVersion: 'five-flowers-20260913', collections: [], encounters: [], recentViews: [] };
const report = { date: new Date().toISOString(), scope: 'Isolated local Chrome contexts; synthetic data only; no camera or production requests.', checks: [], errors: [], screenshots: [] };
function check(name, pass, detail) {
  report.checks.push({ name, pass: Boolean(pass), ...(detail === undefined ? {} : { detail }) });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
}
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.AUDIT_CHROMIUM || process.platform === 'darwin' ? {
  executablePath: process.env.AUDIT_CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
} : {}) });
report.browser = browser.version();
async function setup(viewport, fault) {
  const context = await browser.newContext({ viewport, timezoneId: 'Asia/Shanghai' });
  await context.addInitScript(({ key, legacyKey, empty, legacy, fault }) => {
    if (!['http:', 'https:'].includes(location.protocol)) return;
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { throw new Error('Camera excluded from phase 1'); };
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    if (fault && !get.call(localStorage, 'phase1-fixture')) {
      set.call(localStorage, 'phase1-fixture', 'yes');
      set.call(localStorage, fault === 'migration-quota' ? legacyKey : key, JSON.stringify(fault === 'migration-quota' ? legacy : empty));
    }
    if (fault === 'denied') Storage.prototype.getItem = function(k) { if ([key, legacyKey].includes(k)) throw new DOMException('Denied', 'SecurityError'); return get.call(this, k); };
    if (['silent', 'quota', 'migration-quota'].includes(fault)) Storage.prototype.setItem = function(k, v) {
      if (k === key) { if (fault === 'silent') return; throw new DOMException('Quota', 'QuotaExceededError'); }
      return set.call(this, k, v);
    };
  }, { key, legacyKey, empty, legacy, fault });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', e => report.errors.push({ viewport, fault, message: e.message }));
  page.on('response', response => { if (response.status() >= 400) report.errors.push({ url: response.url(), status: response.status() }); });
  return { context, page };
}
async function shot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  // Full-page capture must request offscreen lazy images before waiting for them.
  await page.locator('img[loading=lazy]').evaluateAll(images => images.forEach(image => { image.loading = 'eager'; }));
  await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
  await page.evaluate(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); });
  await page.waitForFunction(() => scrollY === 0 && scrollX === 0);
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: !name.endsWith('-home'), timeout: 10000 });
  report.screenshots.push(`${name}.png`);
  check(`${name}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
}
async function dialogClick(page, locator, accept = true) {
  const wait = page.waitForEvent('dialog');
  const click = locator.click();
  const dialog = await wait;
  const message = dialog.message();
  if (accept) await dialog.accept(); else await dialog.dismiss();
  await click;
  return message;
}
async function read(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), key); }
async function seed(page, v2, v1 = null) {
  await page.evaluate(({ key, legacyKey, backupKey, v2, v1 }) => {
    for (const [k, v] of [[key, v2], [legacyKey, v1], [backupKey, null]]) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
  }, { key, legacyKey, backupKey, v2, v1 });
}
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const { context, page } = await setup(viewport); const prefix = String(viewport.width);
    await page.goto(`${base}/`);
    await page.locator('.home-featured img').waitFor();
    check(`${prefix}: homepage artwork and scan navigation`, await page.locator('.home-featured img').count() === 1 && await page.getByRole('link', { name: '扫描花卡', exact: true }).count() === 1);
    await shot(page, `${prefix}-home`);
    await page.getByRole('link', { name: '浏览图录', exact: true }).click();
    await page.locator('.flower-card h2').nth(4).waitFor();
    check(`${prefix}: five card titles`, JSON.stringify(await page.locator('.flower-card h2').allTextContents()) === JSON.stringify(['花开有声', '牡丹承瑞', '菊影流金', '清荷入梦', '花叶生辉']));
    for (const flower of ['flowers', 'peony', 'chrysanthemum', 'lotus', 'leaves']) {
      const button = page.locator(`.collect-btn[data-key="${flower}"]`);
      await button.click();
      check(`${prefix}: ${flower} collect without navigation`, (await button.textContent()).trim() === '已收藏' && page.url().endsWith('/catalogue.html'));
      await button.click();
      check(`${prefix}: ${flower} uncollect without navigation`, (await button.textContent()).trim() === '收藏' && page.url().endsWith('/catalogue.html'));
    }
    await shot(page, `${prefix}-catalogue`);
    await page.locator('.flower-card[data-key=lotus] img').click();
    check(`${prefix}: card body enters lotus detail`, page.url().endsWith('/flower-detail.html?key=lotus'));
    check(`${prefix}: detail title, English and full story`, await page.locator('h1').textContent() === '清荷入梦' && await page.locator('.flower-english').textContent() === 'LOTUS IN REVERIE' && await page.locator('h3').filter({ hasText: '花的故事' }).locator('..').locator('p').textContent().then(t => t.length === 104));
    check(`${prefix}: narration available and honestly labelled`, await page.locator('#audio-btn').count() === 1 && (await page.locator('#audio-btn').textContent()) === '听设计解说' && await page.getByText('暂无配音', { exact: true }).count() === 0);
    await page.locator('#collect-btn').click(); await page.reload();
    check(`${prefix}: collection persists after reload`, await page.locator('#collect-btn').textContent() === '已收藏');
    await shot(page, `${prefix}-detail`);
    check(`${prefix}: detail layout and labels remain readable`, await page.evaluate(() => {
      const art = document.querySelector('.flower-exhibit').getBoundingClientRect();
      const info = document.querySelector('.flower-intro').getBoundingClientRect();
      const button = document.querySelector('#collect-btn').getBoundingClientRect();
      return (innerWidth > 700 || info.bottom <= art.top) && button.height >= 44 && button.height <= 60 && button.width >= 44 && button.right <= innerWidth;
    }));
    await page.locator('#collect-btn').click();
    check(`${prefix}: detail uncollect`, await page.locator('#collect-btn').textContent() === '收藏这朵花');
    await seed(page, null);await page.goto(`${base}/collection.html`);
    check(`${prefix}: genuine empty state`, await page.getByText('花册还是空的', { exact: true }).count() === 1);
    await shot(page, `${prefix}-empty`);
    await page.getByRole('link', { name: '看第一朵 · 清荷入梦', exact: true }).click();
    check(`${prefix}: empty state guides to the first flower`, page.url().includes('flower-detail.html?key=lotus'));
    await page.locator('#collect-btn').click();
    await page.getByRole('link', { name: '五花图录', exact: true }).click();
    for (const flower of ['peony', 'chrysanthemum']) await page.locator(`.collect-btn[data-key="${flower}"]`).click();
    await page.getByRole('link', { name: '我的花册', exact: true }).click();
    await page.locator('.collection-card').nth(2).waitFor();
    check(`${prefix}: three manual collections with date`, await page.locator('.collection-card').count() === 3 && (await page.locator('.collection-card').allTextContents()).every(t => /主动收藏 · \d{4}年\d{1,2}月\d{1,2}日/.test(t)));
    await shot(page, `${prefix}-collections`);
    for (const title of ['牡丹承瑞', '菊影流金']) await dialogClick(page, page.locator('.collection-card').filter({ hasText: title }).getByRole('button', { name: '取消收藏' }));
    await page.goto(`${base}/flower-detail.html?key=lotus`);await page.goto(`${base}/flower-detail.html?key=peony`);await page.goto(`${base}/collection.html`);
    const before = await read(page);
    await dialogClick(page, page.locator('.collection-card button'));
    const after = await read(page);
    check(`${prefix}: removal retains recent views`, before.collections[0].key === 'lotus' && after.collections.length === 0 && JSON.stringify(before.recentViews) === JSON.stringify(after.recentViews) && after.recentViews.length === 2);
    check(`${prefix}: view labels`, (await page.locator('.view-card').allTextContents()).every(t => t.includes('详情查看 ·')));
    await seed(page, null, legacy);await page.reload();
    const migration = await read(page);await page.reload();
    check(`${prefix}: migration exact values and idempotence`, migration.version === 2 && migration.collections.length === 2 && migration.collections.every(c => c.source === 'legacy') && migration.encounters.length === 2 && migration.encounters.every(c => c.source === 'camera') && migration.recentViews.length === 0 && JSON.stringify(migration) === JSON.stringify(await read(page)));
    check(`${prefix}: migration source labels`, (await page.locator('.collection-card').allTextContents()).every(t => t.includes('历史收藏 · 2026年10月14日')) && (await page.locator('.encounter-card').allTextContents()).every(t => t.includes('扫描识别 ·')));
    await page.goto(`${base}/flower-detail.html?key=lotus`);await page.goto(`${base}/collection.html`);
    await dialogClick(page, page.locator('.collection-card').filter({ hasText: '清荷入梦' }).getByRole('button', { name: '取消收藏' }));
    const three = await read(page);
    check(`${prefix}: all three categories independent`, three.collections.length === 1 && three.collections[0].key === 'peony' && three.encounters.length === 2 && three.recentViews[0].key === 'lotus');
    await shot(page, `${prefix}-three-categories`);
    await seed(page, '{broken', legacy);await page.reload();
    check(`${prefix}: corrupt v2 readable legacy preview with edits disabled`, await page.getByText('当前仅显示旧版历史', { exact: true }).count() === 1 && await page.locator('.collection-card button').first().isDisabled());
    await shot(page, `${prefix}-legacy-preview`);
    await dialogClick(page, page.getByRole('button', { name: '恢复旧版历史', exact: true }), false);
    check(`${prefix}: cancel recovery preserves source`, await page.evaluate(key => localStorage.getItem(key), key) === '{broken');
    await dialogClick(page, page.getByRole('button', { name: '恢复旧版历史', exact: true }));
    await page.waitForFunction(() => document.querySelector('#collection-notice')?.hidden === true);
    check(`${prefix}: confirmed recovery preserves original copy and v1`, await page.evaluate(({ key, legacyKey, backupKey, legacy }) => localStorage.getItem(backupKey) === '{broken' && localStorage.getItem(legacyKey) === JSON.stringify(legacy) && JSON.parse(localStorage.getItem(key)).collections.length === 2, { key, legacyKey, backupKey, legacy }));
    check(`${prefix}: recovery re-enables editing`, await page.locator('.collection-card button').first().isEnabled());
    await seed(page, '{broken');await page.reload();
    check(`${prefix}: no legacy gives error instead of blank or false empty`, await page.getByText('暂时无法读取花册', { exact: true }).count() === 1 && await page.getByText('花册还是空的', { exact: true }).count() === 0);
    await shot(page, `${prefix}-unreadable`);
    await seed(page, { ...empty, version: 99 }, legacy);await page.reload();
    check(`${prefix}: future version preserved without downgrade`, await page.getByRole('button', { name: '恢复旧版历史' }).count() === 0 && (await read(page)).version === 99);
    await seed(page, empty);await page.goto(`${base}/catalogue.html`);
    const other = await context.newPage();await other.goto(`${base}/collection.html`);
    await other.evaluate(key => localStorage.setItem(key, '{broken'), key);
    await page.waitForFunction(() => document.querySelector('.collect-btn')?.disabled === true);
    check(`${prefix}: cross-tab corruption refreshes failure UI`, await page.getByText('暂时无法读取花册', { exact: true }).count() === 1);
    await context.close();
  }
  for (const fault of ['denied', 'silent', 'quota', 'migration-quota']) {
    const { context, page } = await setup({ width: 390, height: 844 }, fault);
    if (fault === 'denied') {
      for (const target of ['collection.html', 'catalogue.html', 'flower-detail.html?key=lotus']) {
        await page.goto(`${base}/${target}`);
        check(`denied: ${target} remains readable`, await page.getByText('暂时无法读取花册', { exact: true }).count() === 1 && await page.locator('h1').count() === 1);
      }
    } else if (fault === 'migration-quota') {
      await page.goto(`${base}/collection.html`);
      check('migration quota: historical data is still visible', await page.locator('.collection-card').count() === 2 && await page.getByText('当前仅显示旧版历史', { exact: true }).count() === 1);
      await dialogClick(page, page.getByRole('button', { name: '恢复旧版历史', exact: true }));
      check('migration quota: recovery failure is visible', (await page.locator('#collection-notice').textContent()).includes('未能保存'));
    } else {
      await page.goto(`${base}/catalogue.html`);
      const message = await dialogClick(page, page.locator('.collect-btn[data-key=lotus]'));
      check(`${fault}: no false save success`, message.includes('未能保存') && (await read(page)).collections.length === 0 && (await page.locator('.collect-btn[data-key=lotus]').textContent()).trim() === '收藏');
    }
    await context.close();
  }
  check('No uncaught errors or HTTP failures', report.errors.length === 0, report.errors);
} catch (error) {
  check('Browser workflow completed', false, { message: error.message, stack: error.stack });
} finally {
  await browser.close();
  report.summary = { total: report.checks.length, passed: report.checks.filter(c => c.pass).length, failed: report.checks.filter(c => !c.pass).length };
  await writeFile(path.join(output, 'phase1-browser.json'), JSON.stringify(report, null, 2));
  console.log('SUMMARY', JSON.stringify(report.summary));
}
process.exitCode = report.summary.failed ? 1 : 0;
