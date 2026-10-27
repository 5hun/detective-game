import type { Browser, Page } from 'playwright';
import assert = require('node:assert/strict');
import { pathToFileURL } from 'node:url';
import path = require('node:path');

const url = pathToFileURL(path.resolve(__dirname, '../../index.html')).href;
async function switchLanguage(page: Page, language: 'ja' | 'en') {
  if (await page.locator('#game-menu').isHidden()) await page.locator('#menu-toggle').click();
  await page.locator('#language-select').selectOption(language);
}
async function checkEnglishText(page: Page) {
  const untranslated = await page.evaluate(() => {
    const found: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement?.closest('svg, script, style, textarea, #language-select, .language-label, #ruby-toggle, noscript')) continue;
      if (/[\u3040-\u9fff]/u.test(node.textContent || '')) found.push(node.textContent || '');
    }
    for (const element of document.querySelectorAll('[aria-label], [title], [placeholder]')) {
      if (element.closest('#ruby-toggle')) continue;
      for (const name of ['aria-label', 'title', 'placeholder']) {
        const value = element.getAttribute(name) || '';
        if (/[\u3040-\u9fff]/u.test(value)) found.push(value);
      }
    }
    return found;
  });
  assert.deepEqual(untranslated, [], 'English UI and accessibility text should be translated');
}
export async function checkEnglish(browser: Browser) {
  for (const [locale, expected] of [['en-US', 'en'], ['ja-JP', 'ja'], ['fr-FR', 'ja']] as const) {
    const initial = await browser.newPage({ locale, viewport: { width: 320, height: 844 } });
    await initial.goto(url);
    assert.equal(await initial.locator('html').getAttribute('lang'), expected, `initial language for ${locale}`);
    assert.ok(await initial.locator('#game-menu').isHidden());
    assert.ok(await initial.locator('#language-select').isVisible());
    await initial.locator('#language-select').selectOption(expected === 'en' ? 'ja' : 'en');
    await initial.reload();
    assert.equal(await initial.locator('html').getAttribute('lang'), expected === 'en' ? 'ja' : 'en', 'saved choice overrides browser language');
    assert.ok(await initial.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `initial header fits at 320px for ${locale}`);
    await initial.close();
  }
  const page = await browser.newPage({ locale: 'en-US', reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await switchLanguage(page, 'en');
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.title(), 'Animal Detective');
  assert.ok(await page.locator('#ruby-toggle').isHidden());
  await checkEnglishText(page);
  await page.locator('#start-game').click();
  await page.locator('#confirm-new').click();
  await page.locator('#memo-0').fill('日本語 notes <b>literal</b> {0}');
  await page.locator('[data-reveal="0"]').click();
  await page.locator('#person-0 [data-marker-value="4"]').click();
  const saved = await page.evaluate(() => localStorage.getItem('beast-detective-v1'));
  await switchLanguage(page, 'ja');
  assert.ok(await page.locator('#ruby-toggle').isVisible());
  assert.equal(await page.locator('html').getAttribute('lang'), 'ja');
  assert.ok(await page.locator('.statement ruby').count() > 0);
  await switchLanguage(page, 'en');
  assert.equal(await page.locator('.statement ruby').count(), 0);
  assert.equal(await page.locator('#memo-0').inputValue(), '日本語 notes <b>literal</b> {0}');
  assert.equal(await page.evaluate(() => localStorage.getItem('beast-detective-v1')), saved);
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('#memo-0').inputValue(), '日本語 notes <b>literal</b> {0}');
  await checkEnglishText(page);

  // Verify the asymmetric Pig statement keeps each role attached when sorting targets.
  const statements = await page.evaluate(() => {
    const E = window.DetectiveEngine;
    return [true, false].map(value => E.statementText({ type: 'ordered', targets: [1, 0], value }, E.roles));
  });
  assert.deepEqual(statements, [
    'Elephant is innocent, and Rabbit is a culprit.',
    'At least one of these statements is true: “Elephant is a culprit” or “Rabbit is innocent”.'
  ]);
  const stories = await page.evaluate(() => window.DetectiveEngine.caseStories);
  assert.equal(stories.length, 12);
  assert.ok(stories.every(story => !/[\u3040-\u9fff]/u.test(story.title + story.description + story.ending)));

  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `English layout overflows at ${width}px`);
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({ path: '/tmp/detective-english-mobile.png', fullPage: true });
  const innocents = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState;
    return saved.puzzle.answer.flatMap((culprit, i) => culprit ? [] : [i]);
  });
  for (const i of innocents) await page.locator(`#person-${i} [data-judge]`).click();
  assert.equal(await page.locator('#result h2').textContent(), 'Investigation ended');
  await page.locator('#result-dialog').waitFor({ state: 'visible' });
  await checkEnglishText(page);
  await page.locator('[data-close="result-dialog"]').first().click();
  // Complete a campaign in English, including mistaken innocents and paid testimony.
  if (await page.locator('#game-menu').isHidden()) await page.locator('#menu-toggle').click();
  await page.locator('#new-case').click();
  await page.locator('#difficulty').selectOption('hard');
  await page.locator('#confirm-new').click();
  for (let round = 1; round <= 7; round++) {
    await checkEnglishText(page);
    if (round >= 5) {
      const paid = await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState;
        return saved.puzzle.testimonyCosts.findIndex(cost => cost > 0);
      });
      await page.locator(`[data-reveal="${paid}"]`).click();
      assert.match(await page.locator('#feedback').textContent() || '', /Testimony heard. Funds/);
      await checkEnglishText(page);
    }
    const answers = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState;
      return saved.puzzle.answer;
    });
    for (let i = 0; i < answers.length; i++) if (answers[i]) await page.locator(`#person-${i} [data-judge]`).click();
    await checkEnglishText(page);
    if (round < 7) {
      await page.locator('#result-dialog').waitFor({ state: 'visible' });
      await page.locator('#dialog-next-case').click();
    }
  }
  assert.equal(await page.locator('#result h2').textContent(), 'All cases solved!');
  await page.locator('#result-dialog').waitFor({ state: 'visible' });
  await checkEnglishText(page);
  await page.locator('[data-close="result-dialog"]').first().click();
  await switchLanguage(page, 'ja');
  await switchLanguage(page, 'en');
  await checkEnglishText(page);
  assert.equal(await page.locator('#result h2').textContent(), 'All cases solved!');
  assert.deepEqual(errors, []);
  await page.close();

  const blocked = await browser.newPage({ reducedMotion: 'reduce' });
  await blocked.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } }); });
  await blocked.goto(url);
  await blocked.locator('#start-game').click();
  await blocked.locator('#confirm-new').click();
  await blocked.locator('#memo-0').fill('Keep this note');
  await switchLanguage(blocked, 'en');
  assert.equal(await blocked.locator('#memo-0').inputValue(), 'Keep this note');
  assert.match(await blocked.locator('#save-status').textContent() || '', /Saving is unavailable/);
  await blocked.close();
}
