// Optional browser check: PLAYWRIGHT_MODULE may point to an existing Playwright installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');
async function baseText(locator) {
  return locator.evaluate(element => {
    const copy = element.cloneNode(true);
    copy.querySelectorAll('rt').forEach(rt => rt.remove());
    return copy.textContent;
  });
}
async function checkReadings(page) {
  const missing = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const missing = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement.closest('ruby, script, style, textarea, select, noscript') && /[一-龯々]/.test(node.textContent)) missing.push(node.textContent);
    }
    return missing;
  });
  assert.deepEqual(missing, [], `game text without readings: ${JSON.stringify(missing)}`);
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.locator('.suspect').last().waitFor();
  await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.id = 'readings-probe';
    for (const role of DetectiveEngine.roles) {
      for (const value of role.type === 'count' ? [0, 1, 2, 3] : [false, true]) {
        const line = document.createElement('p');
        line.textContent = DetectiveEngine.statementText({ type: role.type, targets: [0, 1, 2], value }, DetectiveEngine.roles);
        probe.append(line);
      }
    }
    document.body.append(probe);
    addReadings(probe);
  });
  await checkReadings(page);
  await page.locator('#readings-probe').evaluate(element => element.remove());
  assert.ok(await page.locator('ruby rt').count() > 0);
  assert.equal(await page.locator('.suspect').count(), 5);
  await page.locator('#animals-button').click();
  assert.equal(await page.locator('.animal-entry').count(), 8);
  await page.locator('[data-close="animals-dialog"]').click();
  await page.screenshot({ path: '/tmp/beast-detective-desktop.png', fullPage: true });
  assert.equal(await page.locator('.statement').count(), 0);
  await page.locator('[data-reveal="0"]').click();
  assert.equal(await page.locator('.statement').count(), 1);
  await page.reload();
  assert.equal(await page.locator('.statement').count(), 1);
  await page.locator('#memo-0').fill('<script>alert("memo")</script> メモ保存テスト');
  await page.locator('#person-0 [data-marker-value="1"]').click();
  await page.reload();
  assert.equal(await page.locator('#memo-0').inputValue(), '<script>alert("memo")</script> メモ保存テスト');
  assert.equal(await page.locator('#person-0').getAttribute('data-marker'), '1');
  await page.locator('#help-button').click();
  assert.ok(await page.locator('#help-dialog').isVisible());
  await page.keyboard.press('Escape');
  await page.locator('#new-case').click();
  await page.locator('[data-close="new-dialog"]').click();
  assert.ok((await page.locator('#memo-0').inputValue()).includes('メモ保存テスト'));
  const solution = await page.evaluate(() => JSON.parse(localStorage.getItem('beast-detective-v1')).puzzle.answer);
  for (let i = 0; i < solution.length; i++) await page.locator(`#person-${i} [data-judge="${solution[i] ? 'liar' : 'good'}"]`).click();
  assert.ok((await baseText(page.locator('#result'))).includes('事件解決'));
  assert.equal(await page.locator('.truth-detail').count(), 5);
  await checkReadings(page);
  await page.reload();
  assert.ok(await page.locator('#result').isVisible());
  await page.locator('#difficulty').selectOption('hard');
  await page.locator('#next-case').click();
  assert.equal(await page.locator('.suspect').count(), 7);
  assert.equal(await page.locator('.statement').count(), 0);
  const hard = await page.evaluate(() => JSON.parse(localStorage.getItem('beast-detective-v1')).puzzle.answer);
  for (let i = 0; i < 3; i++) await page.locator(`#person-${i} [data-judge="${hard[i] ? 'good' : 'liar'}"]`).click();
  assert.ok((await baseText(page.locator('#result'))).includes('ライフがなくなりました'));
  assert.equal(await page.locator('[data-judge]').count(), 0);
  await page.locator('#difficulty').selectOption('easy');
  await page.locator('#next-case').click();
  assert.equal(await page.locator('.suspect').count(), 4);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `overflow at ${width}`);
    await page.locator('#help-button').click();
    assert.ok(await page.locator('#help-dialog').isVisible());
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/beast-detective-mobile.png', fullPage: true });
  await page.evaluate(() => localStorage.setItem('beast-detective-v1', '{bad json'));
  await page.reload();
  assert.equal(await page.locator('.suspect').count(), 5);
  const blocked = await browser.newPage();
  await blocked.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } }); });
  await blocked.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  assert.equal(await blocked.locator('.suspect').count(), 5);
  assert.ok((await baseText(blocked.locator('#save-status'))).includes('保存できません'));
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS: file:// launch, desktop/mobile widths, notes/markers, restore, dialogs, wins/losses, all levels, corrupt/blocked storage.');
})().catch(e => { console.error(e); process.exit(1); });
