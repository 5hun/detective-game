// Optional browser check: PLAYWRIGHT_MODULE may point to an existing Playwright installation.
import type { Locator, Page } from 'playwright';
const { chromium }: typeof import('playwright') = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { pathToFileURL } from 'node:url';
import path = require('node:path');
import assert = require('node:assert/strict');
async function setToggle(locator: Locator, enabled: boolean) {
  if ((await locator.getAttribute('aria-pressed')) !== String(enabled)) await locator.click();
}
async function baseText(locator: Locator) {
  return locator.evaluate(element => {
    const copy = element.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('rt').forEach(rt => rt.remove());
    return copy.textContent;
  });
}
async function checkReadings(page: Page) {
  const missing = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const missing: string[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement?.closest('ruby, svg, script, style, textarea, select, noscript') && /[一-龯々]/.test(node.textContent || '')) missing.push(node.textContent || '');
    }
    return missing;
  });
  const invalidBases = await page.locator('ruby').evaluateAll(elements => elements.map(element => {
    const copy = element.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('rt').forEach(rt => rt.remove());
    return copy.textContent;
  }).filter(text => !/^[一-龯々]+$/.test(text || '')));
  assert.deepEqual(invalidBases, [], 'ruby must cover kanji only');
  assert.deepEqual(missing, [], `game text without readings: ${JSON.stringify(missing)}`);
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.playedTones = [];
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      createOscillator() {
        const oscillator = super.createOscillator();
        const setFrequency = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
        oscillator.frequency.setValueAtTime = (value, time) => {
          window.playedTones.push(value);
          return setFrequency(value, time);
        };
        return oscillator;
      }
    };
  });
  await page.goto(pathToFileURL(path.resolve(__dirname, '../../index.html')).href);
  await page.locator('.suspect').last().waitFor();
  assert.deepEqual(await page.locator('.header-right > button').evaluateAll(buttons => buttons.map(button => button.id)),
    ['new-case', 'help-button', 'animals-button', 'sound-toggle', 'ruby-toggle']);
  assert.equal(await page.locator('.offline, .case-stamp, .preferences').count(), 0);
  await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.id = 'readings-probe';
    for (const story of DetectiveEngine.caseStories) {
      const line = document.createElement('p');
      line.textContent = story.title + story.description;
      probe.append(line);
    }
    for (const role of DetectiveEngine.roles) {
      const type = role.type;
      const statements: Statement[] = type === 'count'
        ? [0, 1, 2, 3].map(value => ({ type, targets: [0, 1, 2], value }))
        : [false, true].map(value => ({ type, targets: [0, 1, 2], value }));
      for (const statement of statements) {
        const line = document.createElement('p');
        line.textContent = DetectiveEngine.statementText(statement, DetectiveEngine.roles);
        probe.append(line);
      }
    }
    document.body.append(probe);
    addReadings(probe);
  });
  await checkReadings(page);
  const gameText = await baseText(page.locator('body'));
  assert.ok(!/(?:[0-9]人|人数|全員|PERSONS|CASE FILE)/.test(gameText), 'animal counts use 匹 and case number is removed');
  const segments = await page.evaluate(() => {
    const sample = document.createElement('p');
    sample.textContent = '消えた 3匹 持ち去られ 見抜きました 1匹 2匹';
    addReadings(sample);
    const once = sample.innerHTML;
    addReadings(sample);
    if (sample.innerHTML !== once) throw new Error('Ruby is not idempotent');
    return [...sample.childNodes].map(node => node.nodeType === Node.TEXT_NODE ? node.textContent :
      [node.firstChild!.textContent, (node as Element).querySelector('rt')!.textContent]).filter(value => value !== '');
  });
  assert.deepEqual(segments, [
    ['消', 'き'], 'えた', ' ', '3', ['匹', 'びき'], ' ', ['持', 'も'], 'ち', ['去', 'さ'], 'られ', ' ',
    ['見抜', 'みぬ'], 'き', 'ました ', '1', ['匹', 'ぴき'], ' ', '2', ['匹', 'ひき']
  ]);
  await page.locator('#readings-probe').evaluate(element => element.remove());
  assert.ok(await page.locator('ruby rt').count() > 0);
  await setToggle(page.locator('#ruby-toggle'), false);
  assert.equal(await page.locator('ruby rt').first().isVisible(), false);
  await page.reload();
  assert.equal((await page.locator('#ruby-toggle').getAttribute('aria-pressed')) === 'true', false);
  assert.equal(await page.locator('ruby rt').first().isVisible(), false);
  await setToggle(page.locator('#ruby-toggle'), true);
  assert.ok(await page.locator('ruby rt').first().isVisible());
  assert.equal(await page.locator('#testimony-nav button').count(), 5);
  await page.locator('#testimony-nav [data-person="4"]').click();
  await page.waitForFunction(() => {
    const card = document.getElementById('person-4')!.getBoundingClientRect();
    const nav = document.getElementById('testimony-nav')!.getBoundingClientRect();
    return card.top >= nav.bottom && card.top < window.innerHeight;
  });
  assert.equal(await page.locator('#person-4').evaluate(card => card === document.activeElement), true);
  assert.equal(await page.locator('.suspect').count(), 5);
  assert.deepEqual(await page.locator('#person-0 .judge-icon').allTextContents(), ['😈']);
  assert.equal(await page.locator('.detective-scene, .detective-name, .mobile-detective').count(), 0);
  await page.locator('#animals-button').click();
  assert.equal(await page.locator('.animal-entry').count(), 8);
  assert.ok(await page.locator('.portrait').evaluateAll(portraits =>
    portraits.every(svg => svg.getAttribute('viewBox') === '0 0 16 12' &&
      [...svg.querySelectorAll('rect')].every(rect => Number(rect.getAttribute('y')) < 12))));
  await page.locator('[data-close="animals-dialog"]').click();
  await page.screenshot({ path: '/tmp/beast-detective-desktop.png', fullPage: true });
  assert.equal(await page.locator('.statement').count(), 0);
  await page.locator('[data-reveal="0"]').click();
  assert.equal(await page.locator('.statement').count(), 1);
  await page.waitForFunction(() => window.playedTones.length > 0);
  assert.deepEqual(await page.evaluate(() => window.playedTones.splice(0)), [440, 554.37], 'revealing testimony plays its own tones');
  await setToggle(page.locator('#sound-toggle'), false);
  await page.locator('[data-reveal="1"]').click();
  assert.equal(await page.locator('.statement').count(), 2);
  assert.deepEqual(await page.evaluate(() => window.playedTones), [], 'muted testimony is silent');
  await setToggle(page.locator('#sound-toggle'), true);
  await page.reload();
  assert.equal(await page.locator('.statement').count(), 2);
  await page.locator('#memo-0').fill('<script>alert("memo")</script> メモ保存テスト');
  await page.locator('#person-0 [data-marker-value="1"]').click();
  await page.reload();
  assert.equal(await page.locator('#memo-0').inputValue(), '<script>alert("memo")</script> メモ保存テスト');
  assert.equal(await page.locator('#person-0').getAttribute('data-marker'), '1');
  await page.locator('#help-button').click();
  assert.ok(await page.locator('#help-dialog').isVisible());
  await page.keyboard.press('Escape');
  await page.locator('#new-case').click();
  assert.ok(await page.locator('#new-dialog').isVisible());
  assert.equal(await page.locator('#difficulty').inputValue(), 'normal');
  await page.locator('#difficulty').selectOption('hard');
  await page.locator('[data-close="new-dialog"]').click();
  await page.locator('#new-case').click();
  assert.equal(await page.locator('#difficulty').inputValue(), 'normal');
  await page.keyboard.press('Escape');
  assert.ok((await page.locator('#memo-0').inputValue()).includes('メモ保存テスト'));
  assert.equal(await page.locator('#trust').getAttribute('aria-label'), '残り信用 5');
  assert.equal(await page.locator('#trust-value').textContent(), '5');
  assert.equal(await page.locator('.trust-icon').textContent(), '☆');
  const storyTitle = await baseText(page.locator('#case-title'));
  const storyDescription = await baseText(page.locator('#case-description'));
  const expectedStory = await page.evaluate(() => {
    const seed = (JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState).puzzle.seed;
    return DetectiveEngine.caseStories[seed % DetectiveEngine.caseStories.length];
  });
  assert.equal(storyTitle, expectedStory.title);
  assert.equal(storyDescription, expectedStory.description);
  const solution = await page.evaluate(() => (JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState).puzzle.answer);
  assert.deepEqual(await page.evaluate(() => window.playedTones), []);
  await setToggle(page.locator('#sound-toggle'), false);
  await page.reload();
  assert.equal((await page.locator('#sound-toggle').getAttribute('aria-pressed')) === 'true', false);
  assert.equal(await baseText(page.locator('#case-title')), storyTitle);
  assert.equal(await baseText(page.locator('#case-description')), storyDescription);
  const neutralPortrait = await page.locator('#person-0 .portrait').innerHTML();
  const criminals = solution.flatMap((liar, i) => liar ? [i] : []);
  for (const [step, i] of criminals.entries()) {
    await page.locator(`#person-${i} [data-judge="liar"]`).click();
    assert.equal(await page.locator(`#person-${i} .portrait`).getAttribute('data-portrait-state'), solution[i] ? 'liar' : 'good');
    assert.equal(await page.locator('#trust-value').textContent(), String(6 + step));
    if (step < criminals.length - 1) {
      const feedback = await page.locator('#feedback').boundingBox();
      assert.ok(feedback);
      assert.ok(feedback.y >= 0 && feedback.y + feedback.height <= 1100, 'judgment message stays in viewport');
      assert.ok((await baseText(page.locator('#feedback'))).includes('正解です。信用 ＋1。'));
    }
    if (step === 0) {
      assert.deepEqual(await page.evaluate(() => window.playedTones), []);
      await setToggle(page.locator('#sound-toggle'), true);
    } else {
      await page.waitForFunction(() => window.playedTones.length > 0);
      const tones = await page.evaluate(() => window.playedTones.splice(0));
      assert.equal(tones.length, 3);
      assert.ok(tones[0] < tones[1] && tones[1] < tones[2], 'correct answer plays ascending tones');
    }
  }
  assert.equal(await page.locator('[data-portrait-state="liar"] .jail-bar').count(), solution.filter(Boolean).length * 4);
  assert.ok(await page.locator('#result-dialog').isVisible());
  assert.ok((await baseText(page.locator('#result-dialog-content'))).includes('事件解決'));
  await page.screenshot({ path: '/tmp/detective-result-dialog-desktop.png' });
  await page.locator('#result-dialog .close-button').click();
  assert.equal(await page.locator('#result-dialog').isVisible(), false);
  assert.ok(await page.locator('#next-case').isVisible());
  assert.notEqual(await page.locator('#person-0 .portrait').innerHTML(), neutralPortrait);
  assert.ok((await baseText(page.locator('#result'))).includes('事件解決'));
  assert.equal(await page.locator('.truth-detail').count(), 5);
  await checkReadings(page);
  await page.reload();
  assert.ok(await page.locator('#result').isVisible());
  assert.equal(await page.locator('#trust-value').textContent(), '7');
  assert.deepEqual(await page.evaluate(() => window.playedTones), [], 'reload is silent');
  assert.equal((await page.locator('#sound-toggle').getAttribute('aria-pressed')) === 'true', true);
  assert.equal(await page.locator('#person-0 .portrait').getAttribute('data-portrait-state'), solution[0] ? 'liar' : 'good');
  await page.locator('#new-case').click();
  await page.locator('#difficulty').selectOption('hard');
  await page.locator('#confirm-new').click();
  assert.equal(await page.locator('.suspect').count(), 7);
  assert.equal(await page.locator('.statement').count(), 0);
  const hard = await page.evaluate(() => (JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState).puzzle.answer);
  assert.equal(await page.locator('#suspects [data-portrait-state="neutral"], #animals-list [data-portrait-state="neutral"]').count(), 15);
  const innocents = hard.flatMap((liar, i) => liar ? [] : [i]);
  for (let step = 0; step < 3; step++) {
    const i = innocents[step];
    await page.locator(`#person-${i} [data-judge="liar"]`).click();
    assert.equal(await page.locator(`#person-${i} .portrait`).getAttribute('data-portrait-state'), 'sad');
    assert.equal(await page.locator(`#person-${i} .jail-bar`).count(), 0);
    await page.waitForFunction(() => window.playedTones.length > 0);
    assert.equal(await page.locator('#trust-value').textContent(), String(Math.max(0, 3 - 2 * step)));
    assert.equal(await page.locator('#trust').getAttribute('aria-label'), `残り信用 ${Math.max(0, 3 - 2 * step)}`);
    const tones = await page.evaluate(() => window.playedTones.splice(0));
    assert.equal(tones.length, 2);
    assert.ok(tones[0] > tones[1], 'incorrect answer plays descending tones');
  }
  assert.ok(await page.locator('#result-dialog').isVisible());
  assert.ok((await baseText(page.locator('#result-dialog-content'))).includes('信用がなくなりました'));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#result-dialog').isVisible(), false);
  assert.ok((await baseText(page.locator('#result'))).includes('信用がなくなりました'));
  assert.equal(await page.locator('[data-judge]').count(), 0);
  await page.reload();
  assert.equal(await page.locator('#trust-value').textContent(), '0');
  assert.ok(await page.locator('#result').isVisible());
  await page.locator('#next-case').click();
  await page.locator('#difficulty').selectOption('easy');
  await page.locator('#confirm-new').click();
  assert.equal(await page.locator('.suspect').count(), 4);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `overflow at ${width}`);
    const menu = await page.locator('.header-right').boundingBox();
      assert.ok(menu);
    const brand = await page.locator('.brand').boundingBox();
      assert.ok(brand);
    if (width > 760) assert.ok(menu.x > brand.x + brand.width, 'desktop menu shares brand row');
    else assert.ok(menu.y >= brand.y + brand.height, 'mobile menu wraps below brand');
    const menuButtons = await page.locator('.header-right > button').evaluateAll(buttons => buttons.map(button => { const box = button.getBoundingClientRect(); return box.top + box.height / 2; }));
    assert.ok(menuButtons.every(top => Math.abs(top - menuButtons[0]) < 1), 'all five menu controls share one center line');
    const textButton = await page.locator('#help-button').boundingBox();
      assert.ok(textButton);
    const iconButton = await page.locator('#sound-toggle').boundingBox();
      assert.ok(iconButton);
    assert.ok(Math.abs(textButton.height - iconButton.height) < 1, 'menu buttons share the same height');
    for (const id of ['help-button', 'animals-button']) {
      const icon = await page.locator('#' + id + ' svg').boundingBox();
      const label = await page.locator('#' + id + ' .menu-label').boundingBox();
      assert.ok(icon && label && label.y >= icon.y + icon.height, 'menu caption appears below icon');
    }
    for (const rubyEnabled of [true, false]) {
      await setToggle(page.locator('#ruby-toggle'), rubyEnabled);
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const summary = await page.locator('.case-summary').boundingBox();
      assert.ok(summary);
      const masthead = await page.locator('.masthead').boundingBox();
      assert.ok(masthead && Math.abs(masthead.y) < 1, 'menu remains visible while scrolling');
      assert.ok(Math.abs(summary.y - masthead.height) < 2, `summary pinned below menu at ${width}, ruby=${rubyEnabled}`);
      assert.ok(summary.y + summary.height < 844);
      const feedback = await page.locator('#feedback').boundingBox();
      assert.ok(feedback);
      assert.ok(feedback.y >= summary.y + summary.height && feedback.y + feedback.height <= 844, 'feedback remains visible while scrolling');
      for (const id of ['liar-count', 'good-count', 'progress-count', 'trust']) {
        const box = await page.locator('#' + id).boundingBox();
      assert.ok(box);
        assert.ok(box.y >= summary.y && box.y + box.height <= summary.y + summary.height);
        assert.ok(box.x >= 0 && box.x + box.width <= width);
      }
      await page.locator('#person-3 [data-judge="liar"]').evaluate(button => button.scrollIntoView({ block: 'start', behavior: 'instant' }));
      const button = await page.locator('#person-3 [data-judge="liar"]').boundingBox();
      assert.ok(button);
      assert.ok(button.y >= summary.height, 'pinned summary must not cover the scrolled-to button');
      if (width === 390 && rubyEnabled) await page.screenshot({ path: '/tmp/detective-sticky-summary.png' });
    }
    await setToggle(page.locator('#ruby-toggle'), true);
    await page.locator('#help-button').click();
    assert.ok(await page.locator('#help-dialog').isVisible());
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/beast-detective-mobile.png', fullPage: true });
  const easyAnswer = await page.evaluate(() => (JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState).puzzle.answer);
  for (let i = 0; i < easyAnswer.length; i++) {
    if (!easyAnswer[i]) continue;
    await page.locator(`#person-${i} [data-judge="liar"]`).click();
  }
  const modal = await page.locator('#result-dialog').boundingBox();
      assert.ok(modal);
  assert.ok(modal.y >= 0 && modal.y + modal.height <= 844, 'result dialog fits mobile viewport');
  assert.ok(Math.abs(modal.y + modal.height / 2 - 422) < 2, 'result dialog centered after scrolling');
  await page.screenshot({ path: '/tmp/detective-result-dialog-mobile.png' });
  await page.locator('#dialog-next-case').click();
  assert.equal(await page.locator('#result-dialog').isVisible(), false);
  assert.ok(await page.locator('#new-dialog').isVisible());
  assert.equal(await page.locator('#difficulty').inputValue(), 'easy');
  await page.locator('#confirm-new').click();
  assert.equal(await page.locator('#result').isVisible(), false);
  assert.equal(await page.locator('.suspect').count(), 4);
  await page.evaluate(() => localStorage.setItem('beast-detective-v1', '{bad json'));
  await page.reload();
  assert.equal(await page.locator('.suspect').count(), 5);
  const invalidSave = await browser.newPage();
  await invalidSave.goto(pathToFileURL(path.resolve(__dirname, '../../index.html')).href);
  for (const problem of ['old-version', 'previous-rules', 'missing-revealed', 'wrong-trust', 'wrong-status']) {
    await invalidSave.evaluate(problem => {
      const saved = (JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState);
      saved.notes[0] = '引き継がないメモ';
      if (problem === 'old-version') saved.version = 1;
      if (problem === 'previous-rules') saved.version = 3;
      if (problem === 'missing-revealed') Reflect.deleteProperty(saved, 'revealed');
      if (problem === 'wrong-trust') saved.trust = 999;
      if (problem === 'wrong-status') saved.status = 'won';
      localStorage.setItem('beast-detective-v1', JSON.stringify(saved));
    }, problem);
    await invalidSave.reload();
    assert.equal(await invalidSave.locator('#trust-value').textContent(), '5');
    assert.equal(await invalidSave.locator('#memo-0').inputValue(), '', problem);
    assert.equal(await invalidSave.locator('.resolved-tag').count(), 0);
  }
  const blocked = await browser.newPage();
  await blocked.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } }); });
  await blocked.goto(pathToFileURL(path.resolve(__dirname, '../../index.html')).href);
  assert.equal(await blocked.locator('.suspect').count(), 5);
  await setToggle(blocked.locator('#ruby-toggle'), false);
  assert.equal(await blocked.locator('ruby rt').first().isVisible(), false);
  assert.ok((await baseText(blocked.locator('#save-status'))).includes('保存できません'));
  await setToggle(blocked.locator('#sound-toggle'), false);
  assert.equal((await blocked.locator('#sound-toggle').getAttribute('aria-pressed')) === 'true', false);
  const silent = await browser.newPage();
  silent.on('pageerror', e => errors.push(e.message));
  await silent.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: class { constructor() { throw new Error('audio unavailable'); } } });
  });
  await silent.goto(pathToFileURL(path.resolve(__dirname, '../../index.html')).href);
  await silent.locator('#person-0 [data-judge="liar"]').click();
  assert.equal(await silent.locator('#person-0 .resolved-tag').count(), 1);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS: file:// launch, desktop/mobile widths, notes/markers, restore, dialogs, wins/losses, all levels, corrupt/blocked storage.');
})().catch(e => { console.error(e); process.exit(1); });
