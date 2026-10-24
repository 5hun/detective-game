// Optional browser check: PLAYWRIGHT_MODULE may point to an existing Playwright installation.
import type { Locator, Page } from 'playwright';
const { chromium }: typeof import('playwright') = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { pathToFileURL } from 'node:url';
import path = require('node:path');
import assert = require('node:assert/strict');
async function openMenu(page: Page) {
  if (await page.locator('#game-menu').isHidden()) await page.locator('#menu-toggle').click();
}
async function startGame(page: Page) {
  await page.locator('#start-game').click();
  await page.locator('#confirm-new').click();
}
async function setToggle(locator: Locator, enabled: boolean) {
  const page = locator.page();
  if (await page.locator('#game-menu').isHidden()) await page.locator('#menu-toggle').click();
  if ((await locator.getAttribute('aria-pressed')) !== String(enabled)) await locator.click();
}
async function baseText(locator: Locator) {
  return locator.evaluate(element => {
    const copy = element.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('rt').forEach(rt => rt.remove());
    return copy.textContent?.trim() ?? '';
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
    window.playedRecordings = [];
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.playedRecordings.push(this.getAttribute('src') || '');
      return nativePlay.call(this);
    };
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
  assert.ok(await page.locator('#home-page').isVisible());
  assert.ok(await page.locator('#game-page').isHidden());
  assert.ok(await page.locator('#continue-game').isHidden());
  assert.equal(await page.evaluate(() => localStorage.getItem('beast-detective-v1')), null);
  await page.locator('#start-game').click();
  await page.locator('[data-close="new-dialog"]').click();
  assert.equal(await page.evaluate(() => localStorage.getItem('beast-detective-v1')), null);
  await page.reload();
  assert.ok(await page.locator('#home-page').isVisible());
  await startGame(page);
  await page.locator('.suspect').last().waitFor();
  await page.locator('#memo-0').fill('初期ページから再開');
  const saveBeforeHome = await page.evaluate(() => localStorage.getItem('beast-detective-v1'));
  await page.locator('.brand').click();
  assert.ok(await page.locator('#home-page').isVisible());
  assert.ok(await page.locator('#game-page').isHidden());
  assert.ok(await page.locator('#continue-game').isVisible());
  assert.equal(await page.locator('#home-status').count(), 0);
  await page.locator('#start-game').click();
  assert.ok(await page.locator('#replace-case-note').isVisible());
  await page.locator('[data-close="new-dialog"]').click();
  assert.equal(await page.evaluate(() => localStorage.getItem('beast-detective-v1')), saveBeforeHome);
  await page.locator('#continue-game').click();
  assert.ok(await page.locator('#game-page').isVisible());
  assert.equal(await page.locator('#memo-0').inputValue(), '初期ページから再開');
  assert.equal(await page.evaluate(() => localStorage.getItem('beast-detective-v1')), saveBeforeHome);
  await page.reload();
  await page.locator('.brand').click();
  assert.ok(await page.locator('#continue-game').isVisible());
  await page.locator('#start-game').click();
  await page.locator('#confirm-new').click();
  assert.equal(await page.locator('#memo-0').inputValue(), '');

  const durations = await page.evaluate(() => Promise.all(
    ['assets/sounds/correct2.mp3', 'assets/sounds/incorrect2.mp3'].map(src => new Promise<number>((resolve, reject) => {
      const audio = new Audio(src);
      audio.onloadedmetadata = () => resolve(audio.duration);
      audio.onerror = () => reject(new Error(`Cannot load ${src}`));
    }))
  ));
  assert.ok(durations.every(duration => Number.isFinite(duration) && duration > 0), 'bundled recordings are playable audio');
  assert.ok(await page.locator('#game-menu').isHidden(), 'menu starts collapsed');
  await page.locator('#menu-toggle').click();
  assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#game-menu').isHidden(), 'Escape closes menu');
  assert.ok(await page.locator('#menu-toggle').evaluate(button => button === document.activeElement));
  await page.locator('#menu-toggle').click();
  assert.deepEqual(await page.locator('.header-right > button').evaluateAll(buttons => buttons.map(button => button.id)),
    ['animals-button', 'sound-toggle', 'ruby-toggle', 'delete-save']);
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
      const statements: Statement[] = type === 'balance'
        ? [-1, 0, 1].map(value => ({ type, targets: [0, 1, 2], value }))
        : type === 'count'
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
  await page.locator('#readings-probe').evaluate(element => element.remove());
  const gameText = await baseText(page.locator('body'));
  assert.ok(!/(?:[0-9]人|人数|PERSONS|CASE FILE)/.test(gameText), 'animal counts use 匹 and case number is removed');
  const segments = await page.evaluate(() => {
    const sample = document.createElement('p');
    sample.textContent = '消えた 3匹 持ち去られ 見抜きました 1匹 2匹 増減 使用';
    addReadings(sample);
    const once = sample.innerHTML;
    addReadings(sample);
    if (sample.innerHTML !== once) throw new Error('Ruby is not idempotent');
    return [...sample.childNodes].map(node => node.nodeType === Node.TEXT_NODE ? node.textContent :
      [node.firstChild!.textContent, (node as Element).querySelector('rt')!.textContent]).filter(value => value !== '');
  });
  assert.deepEqual(segments, [
    ['消', 'き'], 'えた', ' ', '3', ['匹', 'びき'], ' ', ['持', 'も'], 'ち', ['去', 'さ'], 'られ', ' ',
    ['見抜', 'みぬ'], 'き', 'ました ', '1', ['匹', 'ぴき'], ' ', '2', ['匹', 'ひき'], ' ',
    ['増減', 'ぞうげん'], ' ', ['使用', 'しよう']
  ]);
  assert.ok(await page.locator('ruby rt').count() > 0);
  await setToggle(page.locator('#ruby-toggle'), false);
  assert.equal(await page.locator('ruby rt').first().isVisible(), false);
  await page.reload();
  await page.locator('#menu-toggle').click();
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
  await openMenu(page);
  await page.locator('#animals-button').click();
  assert.equal(await page.locator('.animal-entry').count(), await page.evaluate(() => window.DetectiveEngine.roles.length));
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
  await page.locator('#menu-toggle').click();
  assert.equal(await page.locator('.statement').count(), 2);
  await page.locator('#memo-0').fill('<script>alert("memo")</script> メモ保存テスト');
  for (const [value, color] of ['rgb(212, 215, 202)', 'rgb(185, 109, 88)', 'rgb(116, 148, 118)', 'rgb(196, 163, 89)', 'rgb(212, 215, 202)', 'rgb(185, 109, 88)'].entries()) {
    await page.locator(`#person-0 [data-marker-value="${value % 4}"]`).click();
    assert.equal(await page.locator('#testimony-nav [data-person="0"]').evaluate(el => getComputedStyle(el).borderTopColor), color);
  }
  await page.reload();
  await page.locator('#menu-toggle').click();
  assert.equal(await page.locator('#memo-0').inputValue(), '<script>alert("memo")</script> メモ保存テスト');
  assert.equal(await page.locator('#person-0').getAttribute('data-marker'), '1');
  assert.equal(await page.locator('#testimony-nav [data-person="0"]').evaluate(el => getComputedStyle(el).borderTopColor), 'rgb(185, 109, 88)');
  await openMenu(page);
  await page.locator('#help-button').click();
  assert.ok(await page.locator('#help-dialog').isVisible());
  await page.keyboard.press('Escape');
  await openMenu(page);
  await page.locator('#new-case').click();
  assert.ok(await page.locator('#new-dialog').isVisible());
  assert.equal(await page.locator('#difficulty').inputValue(), 'normal');
  await page.locator('#difficulty').selectOption('hard');
  await page.locator('[data-close="new-dialog"]').click();
  await openMenu(page);
  await page.locator('#new-case').click();
  assert.equal(await page.locator('#difficulty').inputValue(), 'normal');
  await page.keyboard.press('Escape');
  assert.ok((await page.locator('#memo-0').inputValue()).includes('メモ保存テスト'));
  assert.equal(await page.locator('#trust').getAttribute('aria-label'), '残り捜査資金 5');
  assert.equal(await page.locator('#trust-value').evaluate(element => element.firstChild!.textContent), '5');
  assert.equal(await page.locator('.trust-icon').textContent(), '🪙');
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
  await page.locator('#menu-toggle').click();
  assert.equal((await page.locator('#sound-toggle').getAttribute('aria-pressed')) === 'true', false);
  assert.equal(await baseText(page.locator('#case-title')), storyTitle);
  assert.equal(await baseText(page.locator('#case-description')), storyDescription);
  const neutralPortrait = await page.locator('#person-0 .portrait').innerHTML();
  const criminals = solution.flatMap((liar, i) => liar ? [i] : []);
  for (const [step, i] of criminals.entries()) {
    await page.locator(`#person-${i} [data-judge="liar"]`).click();
    assert.equal(await page.locator(`#person-${i} .portrait`).getAttribute('data-portrait-state'), solution[i] ? 'liar' : 'good');
    assert.equal(await page.locator('#trust-value').evaluate(element => element.firstChild!.textContent), String(5 + criminals.slice(0, step + 1).reduce((sum, index) => sum + (index < 2 ? 0 : 1), 0) + (step === criminals.length - 1 ? 1 : 0)));
    if (step < criminals.length - 1) {
      const feedback = await page.locator('#feedback').boundingBox();
      assert.ok(feedback);
      assert.ok(feedback.y >= 0 && feedback.y + feedback.height <= 1100, 'judgment message stays in viewport');
      assert.ok((await baseText(page.locator('#feedback'))).includes(`正解です。${i < 2 ? '捜査資金の増減はありません。' : '捜査資金 ＋1。'}`));
      await checkReadings(page);
    }
    if (step === 0) {
      assert.deepEqual(await page.evaluate(() => window.playedTones), []);
      assert.deepEqual(await page.evaluate(() => window.playedRecordings), []);
      await setToggle(page.locator('#sound-toggle'), true);
    } else {
      assert.deepEqual(await page.evaluate(() => window.playedRecordings.splice(0)), ['assets/sounds/correct2.mp3']);
    }
  }
  assert.equal(await page.locator('#suspects [data-portrait-state="liar"] .jail-bar').count(), solution.filter(Boolean).length * 4);
  for (const [i, liar] of solution.entries()) {
    assert.equal(await page.locator(`#testimony-nav [data-person="${i}"] .portrait`).getAttribute('data-portrait-state'), liar ? 'liar' : 'good');
    assert.equal(await page.locator(`#testimony-nav [data-person="${i}"]`).evaluate(el => getComputedStyle(el).backgroundColor),
      await page.locator(`#person-${i} .portrait-box`).evaluate(el => getComputedStyle(el).backgroundColor));
  }
  assert.ok(await page.locator('#result-dialog').isVisible());
  assert.ok((await baseText(page.locator('#result-dialog-content'))).includes('事件解決'));
  await page.waitForFunction(() => window.playedRecordings.includes('assets/sounds/stamp.wav'));
  assert.deepEqual(await page.evaluate(() => window.playedRecordings.splice(0)), ['assets/sounds/stamp.wav']);
  await page.screenshot({ path: '/tmp/detective-result-dialog-desktop.png' });
  await page.locator('#result-dialog .close-button').click();
  assert.equal(await page.locator('#result-dialog').isVisible(), false);
  assert.ok(await page.locator('#next-case').isVisible());
  assert.notEqual(await page.locator('#person-0 .portrait').innerHTML(), neutralPortrait);
  assert.ok((await baseText(page.locator('#result'))).includes('事件解決'));
  assert.equal(await page.locator('.truth-detail').count(), 5);
  await checkReadings(page);
  await page.reload();
  await page.locator('#menu-toggle').click();
  assert.ok(await page.locator('#result').isVisible());
  assert.equal(await page.locator('#trust-value').evaluate(element => element.firstChild!.textContent), String(5 + criminals.reduce((sum, index) => sum + (index < 2 ? 0 : 1), 0) + 1));
  assert.deepEqual(await page.evaluate(() => window.playedTones), [], 'reload is silent');
  assert.deepEqual(await page.evaluate(() => window.playedRecordings), [], 'restoring a solved case does not play the stamp');
  assert.equal((await page.locator('#sound-toggle').getAttribute('aria-pressed')) === 'true', true);
  assert.equal(await page.locator('#person-0 .portrait').getAttribute('data-portrait-state'), solution[0] ? 'liar' : 'good');
  await openMenu(page);
  await page.locator('#new-case').click();
  await page.locator('#difficulty').selectOption('hard');
  await page.locator('#confirm-new').click();
  assert.equal(await page.locator('.suspect').count(), 7);
  assert.equal(await page.locator('.statement').count(), 0);
  const hard = await page.evaluate(() => (JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState).puzzle.answer);
  assert.equal(await page.locator('#suspects [data-portrait-state="neutral"], #animals-list [data-portrait-state="neutral"]').count(), 7 + await page.evaluate(() => window.DetectiveEngine.roles.length));
  const innocents = hard.flatMap((liar, i) => liar ? [] : [i]);
  for (let step = 0; step < 3; step++) {
    const i = innocents[step];
    await page.locator(`#person-${i} [data-judge="liar"]`).click();
    assert.equal(await page.locator(`#person-${i} .portrait`).getAttribute('data-portrait-state'), 'sad');
    assert.equal(await page.locator(`#testimony-nav [data-person="${i}"] .portrait`).getAttribute('data-portrait-state'), 'sad');
    assert.equal(await page.locator(`#testimony-nav [data-person="${i}"]`).evaluate(el => getComputedStyle(el).backgroundColor),
      await page.locator(`#person-${i} .portrait-box`).evaluate(el => getComputedStyle(el).backgroundColor));
    assert.equal(await page.locator(`#person-${i} .jail-bar`).count(), 0);
    assert.equal(await page.locator('#trust-value').evaluate(element => element.firstChild!.textContent), String(Math.max(0, 3 - 2 * step)));
    assert.equal(await page.locator('#trust').getAttribute('aria-label'), `残り捜査資金 ${Math.max(0, 3 - 2 * step)}`);
    assert.deepEqual(await page.evaluate(() => window.playedRecordings.splice(0)), ['assets/sounds/incorrect2.mp3']);
  }
  assert.ok(await page.locator('#result-dialog').isVisible());
  assert.ok((await baseText(page.locator('#result-dialog-content'))).includes('捜査資金がなくなりました'));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#result-dialog').isVisible(), false);
  assert.ok((await baseText(page.locator('#result'))).includes('捜査資金がなくなりました'));
  assert.equal(await page.locator('[data-judge]').count(), 0);
  await page.reload();
  await page.locator('#menu-toggle').click();
  assert.equal(await page.locator('#trust-value').evaluate(element => element.firstChild!.textContent), '0');
  assert.ok(await page.locator('#result').isVisible());
  await page.locator('#next-case').click();
  await page.locator('#difficulty').selectOption('easy');
  await page.locator('#confirm-new').click();
  assert.equal(await page.locator('.suspect').count(), 4);
  for (const width of [1440, 390, 320]) {
    // Two columns shorten the desktop page; use a shorter viewport to exercise sticky scrolling.
    await page.setViewportSize({ width, height: width === 1440 ? 440 : 844 });
    const cards = await page.locator('.suspect').evaluateAll(elements => elements.slice(0, 2).map(element => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, left: rect.left };
    }));
    assert.equal(cards[0].top === cards[1].top, width === 1440, `testimony columns at ${width}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `overflow at ${width}`);
    await openMenu(page);
    const menu = await page.locator('.header-right').boundingBox();
      assert.ok(menu);
    const brand = await page.locator('.brand').boundingBox();
      assert.ok(brand);
    assert.ok(menu.y >= brand.y + brand.height, 'expanded menu appears below brand');
    const menuButtons = await page.locator('.header-right > button').evaluateAll(buttons => buttons.map(button => { const box = button.getBoundingClientRect(); return { top: box.top, bottom: box.bottom, left: box.left, width: box.width }; }));
    assert.ok(menuButtons.every((box, i) => i === 0 || box.top >= menuButtons[i - 1].bottom), 'each menu button occupies its own row');
    assert.ok(menuButtons.every(box => Math.abs(box.left - menuButtons[0].left) < 1 && Math.abs(box.width - menuButtons[0].width) < 1), 'menu buttons share column width');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const expandedHeader = await page.locator('.masthead').boundingBox();
    const expandedContent = await page.locator('.title-row').boundingBox();
    await page.locator('#menu-toggle').click();
    const collapsedHeader = await page.locator('.masthead').boundingBox();
    const collapsedContent = await page.locator('.title-row').boundingBox();
    assert.equal(expandedHeader?.height, collapsedHeader?.height, 'overlay does not expand header');
    assert.equal(expandedContent?.y, collapsedContent?.y, 'overlay does not push page content down');
    await page.locator('#menu-toggle').click();
    const headerButtons = await page.locator('.header-actions > button').evaluateAll(buttons => buttons.map(button => {
      const box = button.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, height: box.height };
    }));
    assert.equal(headerButtons.length, 3);
    assert.ok(headerButtons.every((box, i) => box.height >= 44 && (i === 0 || box.left >= headerButtons[i - 1].right)), 'header actions appear in order');
    assert.ok(headerButtons.every(box => box.top === headerButtons[0].top), 'header actions share a row');
    assert.equal(await page.locator('#game-menu #new-case, #game-menu #help-button').count(), 0);
    assert.equal(await baseText(page.locator('#help-button')), '📖遊び方');
    assert.deepEqual(await page.locator('.header-actions > button').evaluateAll(buttons => buttons.map(button => button.id)), ['new-case', 'help-button', 'menu-toggle']);
    assert.equal(await baseText(page.locator('#delete-save .menu-label')), 'データの消去');
    assert.equal(await page.locator('#delete-save svg').count(), 1);
    assert.equal(await baseText(page.locator('#new-case')), '最初から');
    const newCaseLayout = await page.locator('#new-case').evaluate(button => {
      const icon = button.querySelector('svg')!.getBoundingClientRect();
      const box = button.getBoundingClientRect();
      const textRange = document.createRange();
      textRange.setStartAfter(button.querySelector('svg')!);
      textRange.setEndAfter(button.lastChild!);
      const text = textRange.getBoundingClientRect();
      return { horizontal: getComputedStyle(button).flexDirection === 'row' && text.left >= icon.right,
        fits: text.top >= box.top && text.bottom <= box.bottom && button.scrollWidth <= button.clientWidth };
    });
    assert.ok(newCaseLayout.horizontal && newCaseLayout.fits, `new case icon and text fit horizontally at ${width}`);

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
    await openMenu(page);
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
  for (let round = 2; round <= 5; round++) {
    const previous = await page.evaluate(() => JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState);
    await page.locator('#dialog-next-case').click();
    assert.equal(await page.locator('#new-dialog').isVisible(), false);
    assert.equal(await page.locator('#trust-value').evaluate(element => element.firstChild!.textContent), String(previous.trust));
    assert.equal(await page.locator('#result').isVisible(), false);
    await page.reload();
    const current = await page.evaluate(() => JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState);
    assert.equal(current.puzzle.round, round);
    assert.equal(current.trust, previous.trust);
    assert.ok(current.puzzle.people.length >= previous.puzzle.people.length);
    assert.ok(current.puzzle.k >= previous.puzzle.k);
    assert.ok(current.resolved.every(r => r === null));
    assert.ok(current.revealed.every(r => !r));
    for (let i = 0; i < current.puzzle.answer.length; i++) {
      if (current.puzzle.answer[i]) await page.locator(`#person-${i} [data-judge="liar"]`).click();
    }
    const result = await baseText(page.locator('#result-dialog-content'));
    assert.equal(result!.includes('ゲームクリア'), round === 5);
    await checkReadings(page);
  }
  await page.locator('#dialog-next-case').click();
  assert.ok(await page.locator('#new-dialog').isVisible());
  await page.locator('#confirm-new').click();
  assert.equal(await page.locator('#trust-value').evaluate(element => element.firstChild!.textContent), '5');
  assert.equal(await page.evaluate(() => (JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState).puzzle.round), 1);
  await page.evaluate(() => localStorage.setItem('beast-detective-v1', '{bad json'));
  await page.reload();
  assert.ok(await page.locator('#home-page').isVisible());
  await startGame(page);
  const invalidSave = await browser.newPage();
  await invalidSave.goto(pathToFileURL(path.resolve(__dirname, '../../index.html')).href);
  await startGame(invalidSave);
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
    assert.ok(await invalidSave.locator('#home-page').isVisible(), problem);
    await startGame(invalidSave);
    assert.equal(await invalidSave.locator('#trust-value').evaluate(element => element.firstChild!.textContent), '5');
    assert.equal(await invalidSave.locator('#memo-0').inputValue(), '', problem);
    assert.equal(await invalidSave.locator('.resolved-tag').count(), 0);
  }
  await page.locator('#memo-0').fill('消去の確認用メモ');
  const saveBeforeDelete = await page.evaluate(() => localStorage.getItem('beast-detective-v1'));
  const preferencesBeforeDelete = await page.evaluate(() => localStorage.getItem('animal-detective-preferences-v1'));
  await openMenu(page);
  await page.locator('#delete-save').click();
  assert.ok(await page.locator('#delete-save-dialog').isVisible());
  await page.locator('[data-close="delete-save-dialog"]').click();
  assert.equal(await page.evaluate(() => localStorage.getItem('beast-detective-v1')), saveBeforeDelete);
  await openMenu(page);
  await page.locator('#delete-save').click();
  await page.locator('#confirm-delete-save').click();
  assert.equal(await page.evaluate(() => localStorage.getItem('beast-detective-v1')), null);
  assert.ok(await page.locator('#home-page').isVisible());
  assert.ok(await page.locator('#game-page').isHidden());
  assert.equal(await page.locator('.suspect').count(), 0);
  assert.ok(await page.locator('#continue-game').isHidden());
  assert.equal(await page.evaluate(() => localStorage.getItem('animal-detective-preferences-v1')), preferencesBeforeDelete);
  await page.reload();
  assert.ok(await page.locator('#home-page').isVisible());
  assert.equal(await page.evaluate(() => localStorage.getItem('beast-detective-v1')), null);
  await startGame(page);
  assert.equal(await page.locator('#memo-0').inputValue(), '');
  // A paid reveal survives reload, preserves trust 1, and leaves free testimony available.
  const paidIndices = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState;
    let seed = 0;
    let puzzle = window.DetectiveEngine.generate(seed, 'hard', 2);
    while (puzzle.testimonyCosts.filter(Boolean).length < 2 || !puzzle.testimonyCosts.includes(0)) {
      puzzle = window.DetectiveEngine.generate(++seed, 'hard', 2);
    }
    Object.assign(saved, { puzzle, startingTrust: 2, trust: 2, status: 'playing',
      revealed: puzzle.people.map(() => false), resolved: puzzle.people.map(() => null),
      notes: puzzle.people.map(() => ''), markers: puzzle.people.map(() => 0) });
    localStorage.setItem('beast-detective-v1', JSON.stringify(saved));
    return puzzle.testimonyCosts.flatMap((cost, i) => cost ? [i] : []);
  });
  await page.reload();
  assert.equal(await page.locator('.testimony-targets').count(), 8);
  await checkReadings(page);
  await page.locator(`[data-reveal="${paidIndices[0]}"]`).click();
  assert.equal(await page.locator('#trust').getAttribute('aria-label'), '残り捜査資金 1');
  assert.ok(await page.locator(`[data-reveal="${paidIndices[1]}"]`).isDisabled());
  await page.reload();
  assert.ok(await page.locator(`#statement-${paidIndices[0]} .statement`).isVisible());
  assert.equal(await page.locator('#trust').getAttribute('aria-label'), '残り捜査資金 1');
  assert.ok(await page.locator(`[data-reveal="${paidIndices[1]}"]`).isDisabled());
  const freeIndex = await page.evaluate(() => (JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState).puzzle.testimonyCosts.indexOf(0));
  await page.locator(`[data-reveal="${freeIndex}"]`).click();
  assert.equal(await page.locator('#trust').getAttribute('aria-label'), '残り捜査資金 1');
  const blocked = await browser.newPage();
  await blocked.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } }); });
  await blocked.goto(pathToFileURL(path.resolve(__dirname, '../../index.html')).href);
  assert.ok(await blocked.locator('#home-page').isVisible());
  await startGame(blocked);
  assert.equal(await blocked.locator('.suspect').count(), 5);
  await setToggle(blocked.locator('#ruby-toggle'), false);
  assert.equal(await blocked.locator('ruby rt').first().isVisible(), false);
  assert.ok((await baseText(blocked.locator('#save-status'))).includes('保存できません'));
  await setToggle(blocked.locator('#sound-toggle'), false);
  assert.equal((await blocked.locator('#sound-toggle').getAttribute('aria-pressed')) === 'true', false);
  const silent = await browser.newPage();
  silent.on('pageerror', e => errors.push(e.message));
  await silent.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new Error('audio unavailable'));
    Object.defineProperty(window, 'AudioContext', { value: class { constructor() { throw new Error('audio unavailable'); } } });
  });
  await silent.goto(pathToFileURL(path.resolve(__dirname, '../../index.html')).href);
  await startGame(silent);
  await silent.locator('#person-0 [data-judge="liar"]').click();
  assert.equal(await silent.locator('#person-0 .resolved-tag').count(), 1);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS: file:// launch, desktop/mobile widths, notes/markers, restore, dialogs, wins/losses, all levels, corrupt/blocked storage.');
})().catch(e => { console.error(e); process.exit(1); });
