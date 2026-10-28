// Optional browser check: PLAYWRIGHT_MODULE may point to an existing Playwright installation.
import type { Locator, Page } from 'playwright';
import { checkEnglish } from './i18n-browser';
import { checkRelatedTestimony } from './related-browser';
// The optional installation path requires loading Playwright dynamically.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium }: typeof import('playwright') = require(
  process.env.PLAYWRIGHT_MODULE || 'playwright',
) as typeof import('playwright');
import { pathToFileURL } from 'node:url';
import path = require('node:path');
import assert = require('node:assert/strict');
async function openMenu(page: Page) {
  if (await page.locator('#game-menu').isHidden())
    await page.locator('#menu-toggle').click();
}
async function startGame(page: Page) {
  await page.locator('#start-game').click();
  await page.locator('#confirm-new').click();
}
async function setToggle(locator: Locator, enabled: boolean) {
  const page = locator.page();
  if (await page.locator('#game-menu').isHidden())
    await page.locator('#menu-toggle').click();
  if ((await locator.getAttribute('aria-pressed')) !== String(enabled))
    await locator.click();
}
async function baseText(locator: Locator) {
  return locator.evaluate((element) => {
    const copy = element.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('rt').forEach((rt) => rt.remove());
    return copy.textContent?.trim() ?? '';
  });
}
async function checkReadings(page: Page) {
  const missing = await page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const missing: string[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (
        !node.parentElement?.closest(
          'ruby, svg, script, style, textarea, select, .language-label, noscript',
        ) &&
        /[一-龯々]/.test(node.textContent || '')
      )
        missing.push(node.textContent || '');
    }
    return missing;
  });
  const invalidBases = await page.locator('ruby').evaluateAll((elements) =>
    elements
      .map((element) => {
        const copy = element.cloneNode(true) as HTMLElement;
        copy.querySelectorAll('rt').forEach((rt) => rt.remove());
        return copy.textContent;
      })
      .filter((text) => !/^[一-龯々]+$/.test(text || '')),
  );
  assert.deepEqual(invalidBases, [], 'ruby must cover kanji only');
  assert.deepEqual(
    missing,
    [],
    `game text without readings: ${JSON.stringify(missing)}`,
  );
}
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  await checkRelatedTestimony(browser);
  const page = await browser.newPage({
    locale: 'ja-JP',
    viewport: { width: 1440, height: 1100 },
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.playedRecordings = [];
    window.finishedRecordings = [];
    // Record actual opening time, even when later assertions take time to run.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const nativeShowModal = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function () {
      this.dataset.openedAt = String(Date.now());
      this.dataset.scrollBeforeOpen = String(window.scrollY);
      nativeShowModal.call(this);
      this.dataset.scrollAfterOpen = String(window.scrollY);
    };
    // Preserve the native method and invoke it with the media element as this.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.playedRecordings.push(this.getAttribute('src') || '');
      this.addEventListener(
        'ended',
        () => window.finishedRecordings.push(this.getAttribute('src') || ''),
        { once: true },
      );
      return nativePlay.call(this);
    };
  });
  await page.goto(
    pathToFileURL(path.resolve(__dirname, '../../index.html')).href,
  );
  assert.ok(await page.locator('#home-page').isVisible());
  assert.ok(await page.locator('#game-page').isHidden());
  assert.ok(await page.locator('#continue-game').isHidden());
  assert.equal(
    await page.evaluate(() => localStorage.getItem('beast-detective-v1')),
    null,
  );
  await page.locator('#start-game').click();
  await page.locator('[data-close="new-dialog"]').click();
  assert.equal(
    await page.evaluate(() => localStorage.getItem('beast-detective-v1')),
    null,
  );
  await page.reload();
  assert.ok(
    await page.locator('#home-page').isVisible(),
    'reload opens the home page',
  );
  assert.ok(await page.locator('#game-page').isHidden());
  if (await page.locator('#continue-game').isVisible())
    await page.locator('#continue-game').click();
  assert.ok(await page.locator('#home-page').isVisible());
  await startGame(page);
  assert.ok(await page.locator('#case-intro').isVisible());
  assert.deepEqual(
    await page.evaluate(() => window.playedRecordings.splice(0)),
    [],
    'case title intro is silent',
  );
  assert.equal(await baseText(page.locator('#case-intro-number')), '事件 1');
  assert.equal(
    await baseText(page.locator('#case-intro-title')),
    await baseText(page.locator('#case-title')),
  );
  await page.locator('#case-intro-title').click();
  assert.ok(await page.locator('#case-intro').isHidden());
  await page.waitForTimeout(1500);
  assert.ok(
    await page.locator('#case-intro').isHidden(),
    'skipped intro must stay closed',
  );
  await page.locator('.suspect').last().waitFor();
  await page.locator('#memo-0').fill('初期ページから再開');
  const saveBeforeHome = await page.evaluate(() =>
    localStorage.getItem('beast-detective-v1'),
  );
  await page.locator('.brand').click();
  assert.ok(await page.locator('#home-page').isVisible());
  assert.ok(await page.locator('#game-page').isHidden());
  assert.ok(await page.locator('#continue-game').isVisible());
  assert.equal(await page.locator('#home-status').count(), 0);
  await page.locator('#start-game').click();
  assert.ok(await page.locator('#replace-case-note').isVisible());
  await page.locator('[data-close="new-dialog"]').click();
  assert.equal(
    await page.evaluate(() => localStorage.getItem('beast-detective-v1')),
    saveBeforeHome,
  );
  await page.locator('#continue-game').click();
  assert.ok(
    await page.locator('#case-intro').isHidden(),
    'resuming must not replay the intro',
  );
  assert.ok(await page.locator('#game-page').isVisible());
  assert.equal(
    await page.locator('#memo-0').inputValue(),
    '初期ページから再開',
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem('beast-detective-v1')),
    saveBeforeHome,
  );
  await page.reload();
  assert.ok(
    await page.locator('#home-page').isVisible(),
    'reload opens the home page',
  );
  assert.ok(await page.locator('#game-page').isHidden());
  if (await page.locator('#continue-game').isVisible())
    await page.locator('#continue-game').click();
  await page.locator('.brand').click();
  assert.ok(await page.locator('#continue-game').isVisible());
  await page.locator('#start-game').click();
  await page.locator('#confirm-new').click();
  assert.equal(await page.locator('#memo-0').inputValue(), '');

  const durations = await page.evaluate(() =>
    Promise.all(
      [
        'assets/sounds/correct2.mp3',
        'assets/sounds/incorrect2.mp3',
        'assets/sounds/cage-close.wav',
      ].map(
        (src) =>
          new Promise<number>((resolve, reject) => {
            const audio = new Audio(src);
            audio.onloadedmetadata = () => resolve(audio.duration);
            audio.onerror = () => reject(new Error(`Cannot load ${src}`));
          }),
      ),
    ),
  );
  assert.ok(
    durations.every((duration) => Number.isFinite(duration) && duration > 0),
    'bundled recordings are playable audio',
  );
  assert.ok(
    durations[0] > 2.7 && durations[0] < 2.9,
    'original correct chime is preserved; its full duration does not delay the cage',
  );
  assert.equal(durations[2], 1.2, 'the cage sound retains the approved timing');
  assert.ok(
    await page.locator('#game-menu').isHidden(),
    'menu starts collapsed',
  );
  await page.locator('#menu-toggle').click();
  assert.equal(
    await page.locator('#menu-toggle').getAttribute('aria-expanded'),
    'true',
  );
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#game-menu').isHidden(), 'Escape closes menu');
  assert.ok(
    await page
      .locator('#menu-toggle')
      .evaluate((button) => button === document.activeElement),
  );
  await page.locator('#menu-toggle').click();
  assert.deepEqual(
    await page
      .locator('.header-right > button')
      .evaluateAll((buttons) => buttons.map((button) => button.id)),
    [
      'animals-button',
      'new-case',
      'sound-toggle',
      'ruby-toggle',
      'delete-save',
    ],
  );
  assert.equal(
    await page.locator('.offline, .case-stamp, .preferences').count(),
    0,
  );
  await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.id = 'readings-probe';
    for (const story of DetectiveEngine.caseStories) {
      const line = document.createElement('p');
      line.textContent = story.title + story.description + story.ending;
      probe.append(line);
    }
    for (const role of DetectiveEngine.roles) {
      const type = role.type;
      const statements: Statement[] =
        type === 'balance'
          ? [-1, 0, 1].map((value) => ({ type, targets: [0, 1, 2], value }))
          : type === 'count'
            ? [0, 1, 2, 3].map((value) => ({ type, targets: [0, 1, 2], value }))
            : [false, true].map((value) => ({
                type,
                targets: [0, 1, 2],
                value,
              }));
      for (const statement of statements) {
        const line = document.createElement('p');
        line.textContent = DetectiveEngine.statementText(
          statement,
          DetectiveEngine.roles,
        );
        probe.append(line);
      }
    }
    document.body.append(probe);
    addReadings(probe);
  });
  await checkReadings(page);
  await page.locator('#readings-probe').evaluate((element) => element.remove());
  const gameText = await baseText(page.locator('body'));
  assert.ok(
    !/(?:[0-9]人|人数|PERSONS|CASE FILE)/.test(gameText),
    'animal counts use 匹 and case number is removed',
  );
  const segments = await page.evaluate(() => {
    const sample = document.createElement('p');
    sample.textContent = '消えた 3匹 持ち去られ 見抜きました 1匹 2匹 増減 常に';
    addReadings(sample);
    const once = sample.innerHTML;
    addReadings(sample);
    if (sample.innerHTML !== once) throw new Error('Ruby is not idempotent');
    return [...sample.childNodes]
      .map((node) =>
        node.nodeType === Node.TEXT_NODE
          ? node.textContent
          : [
              node.firstChild!.textContent,
              (node as Element).querySelector('rt')!.textContent,
            ],
      )
      .filter((value) => value !== '');
  });
  assert.deepEqual(segments, [
    ['消', 'き'],
    'えた',
    ' ',
    '3',
    ['匹', 'びき'],
    ' ',
    ['持', 'も'],
    'ち',
    ['去', 'さ'],
    'られ',
    ' ',
    ['見抜', 'みぬ'],
    'き',
    'ました ',
    '1',
    ['匹', 'ぴき'],
    ' ',
    '2',
    ['匹', 'ひき'],
    ' ',
    ['増減', 'ぞうげん'],
    ' ',
    ['常', 'つね'],
    'に',
  ]);
  assert.ok((await page.locator('ruby rt').count()) > 0);
  await setToggle(page.locator('#ruby-toggle'), false);
  assert.equal(await page.locator('ruby rt').first().isVisible(), false);
  await page.reload();
  assert.ok(
    await page.locator('#home-page').isVisible(),
    'reload opens the home page',
  );
  assert.ok(await page.locator('#game-page').isHidden());
  if (await page.locator('#continue-game').isVisible())
    await page.locator('#continue-game').click();
  await page.locator('#menu-toggle').click();
  assert.equal(
    (await page.locator('#ruby-toggle').getAttribute('aria-pressed')) ===
      'true',
    false,
  );
  assert.equal(await page.locator('ruby rt').first().isVisible(), false);
  await setToggle(page.locator('#ruby-toggle'), true);
  assert.ok(await page.locator('ruby rt').first().isVisible());
  assert.equal(await page.locator('#testimony-nav button').count(), 5);
  await page.locator('#testimony-nav [data-person="4"]').click();
  await page.waitForFunction(() => {
    const card = document.getElementById('person-4')!.getBoundingClientRect();
    const nav = document
      .getElementById('testimony-nav')!
      .getBoundingClientRect();
    return card.top >= nav.bottom && card.top < window.innerHeight;
  });
  assert.equal(
    await page
      .locator('#person-4')
      .evaluate((card) => card === document.activeElement),
    true,
  );
  assert.equal(await page.locator('.suspect').count(), 5);
  assert.deepEqual(
    await page.locator('#person-0 .judge-icon').allTextContents(),
    ['😈'],
  );
  assert.equal(
    await page
      .locator('.detective-scene, .detective-name, .mobile-detective')
      .count(),
    0,
  );
  await openMenu(page);
  await page.locator('#animals-button').click();
  assert.equal(
    await page.locator('.animal-entry').count(),
    await page.evaluate(() => window.DetectiveEngine.roles.length),
  );
  assert.ok(
    await page
      .locator('.portrait')
      .evaluateAll((portraits) =>
        portraits.every(
          (svg) =>
            svg.getAttribute('viewBox') === '0 0 16 12' &&
            [...svg.querySelectorAll('rect')].every(
              (rect) => Number(rect.getAttribute('y')) < 12,
            ),
        ),
      ),
  );
  await page.locator('[data-close="animals-dialog"]').click();
  await page.screenshot({
    path: '/tmp/beast-detective-desktop.png',
    fullPage: true,
  });
  assert.equal(await page.locator('.statement').count(), 5);
  assert.equal(
    await page.locator('.testimony-targets, [data-reveal]').count(),
    0,
  );
  await page.reload();
  assert.ok(
    await page.locator('#home-page').isVisible(),
    'reload opens the home page',
  );
  assert.ok(await page.locator('#game-page').isHidden());
  if (await page.locator('#continue-game').isVisible())
    await page.locator('#continue-game').click();
  await page.locator('#menu-toggle').click();
  assert.equal(await page.locator('.statement').count(), 5);
  await page
    .locator('#memo-0')
    .fill('<script>alert("memo")</script> メモ保存テスト');
  for (const [value, color] of [
    'rgb(212, 215, 202)',
    'rgb(185, 109, 88)',
    'rgb(116, 148, 118)',
    'rgb(196, 163, 89)',
    'rgb(212, 215, 202)',
    'rgb(185, 109, 88)',
  ].entries()) {
    await page.locator(`#person-0 [data-marker-value="${value % 4}"]`).click();
    assert.equal(
      await page
        .locator('#testimony-nav [data-person="0"]')
        .evaluate((el) => getComputedStyle(el).borderTopColor),
      color,
    );
  }
  await page.reload();
  assert.ok(
    await page.locator('#home-page').isVisible(),
    'reload opens the home page',
  );
  assert.ok(await page.locator('#game-page').isHidden());
  if (await page.locator('#continue-game').isVisible())
    await page.locator('#continue-game').click();
  await page.locator('#menu-toggle').click();
  assert.equal(
    await page.locator('#memo-0').inputValue(),
    '<script>alert("memo")</script> メモ保存テスト',
  );
  assert.equal(
    await page.locator('#person-0').getAttribute('data-marker'),
    '1',
  );
  assert.equal(
    await page
      .locator('#testimony-nav [data-person="0"]')
      .evaluate((el) => getComputedStyle(el).borderTopColor),
    'rgb(185, 109, 88)',
  );
  await openMenu(page);
  await page.locator('#help-button').click();
  assert.ok(await page.locator('#help-dialog').isVisible());
  await page.keyboard.press('Escape');
  await openMenu(page);
  await openMenu(page);
  await page.locator('#new-case').click();
  assert.ok(await page.locator('#new-dialog').isVisible());
  assert.equal(await page.locator('#difficulty').inputValue(), 'normal');
  await page.locator('#difficulty').selectOption('hard');
  await page.locator('[data-close="new-dialog"]').click();
  await openMenu(page);
  await openMenu(page);
  await page.locator('#new-case').click();
  assert.equal(await page.locator('#difficulty').inputValue(), 'normal');
  await page.keyboard.press('Escape');
  assert.ok(
    (await page.locator('#memo-0').inputValue()).includes('メモ保存テスト'),
  );
  assert.equal(
    await page.locator('#trust').getAttribute('aria-label'),
    '残り捜査資金 3',
  );
  assert.equal(
    await page
      .locator('#trust-value')
      .evaluate((element) => element.firstChild!.textContent),
    '3',
  );
  assert.equal(await page.locator('.trust-icon').textContent(), '🪙');
  const storyTitle = await baseText(page.locator('#case-title'));
  const storyDescription = await baseText(page.locator('#case-description'));
  const expectedStory = await page.evaluate(() => {
    const saved = JSON.parse(
      localStorage.getItem('beast-detective-v1')!,
    ) as GameState;
    return DetectiveEngine.caseStories[
      saved.storyHistory[saved.storyHistory.length - 1]
    ];
  });
  assert.equal(storyTitle, expectedStory.title);
  assert.equal(storyDescription, expectedStory.description);
  assert.equal(
    await page.locator('.case-ending').count(),
    0,
    'ending stays hidden during the investigation',
  );
  const solution = await page.evaluate(
    () =>
      (JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState)
        .puzzle.answer,
  );
  await setToggle(page.locator('#sound-toggle'), false);
  await page.reload();
  assert.ok(
    await page.locator('#home-page').isVisible(),
    'reload opens the home page',
  );
  assert.ok(await page.locator('#game-page').isHidden());
  if (await page.locator('#continue-game').isVisible())
    await page.locator('#continue-game').click();
  await page.locator('#menu-toggle').click();
  assert.equal(
    (await page.locator('#sound-toggle').getAttribute('aria-pressed')) ===
      'true',
    false,
  );
  assert.equal(await baseText(page.locator('#case-title')), storyTitle);
  assert.equal(
    await baseText(page.locator('#case-description')),
    storyDescription,
  );
  const neutralPortrait = await page
    .locator('#person-0 .portrait-box .portrait')
    .innerHTML();
  const criminals = solution.flatMap((liar, i) => (liar ? [i] : []));
  let finalJudgmentStarted = 0;
  for (const [step, i] of criminals.entries()) {
    await page.evaluate(() => window.finishedRecordings.splice(0));
    const judgmentStarted = Date.now();
    const solvesCase = step === criminals.length - 1;
    if (solvesCase) finalJudgmentStarted = judgmentStarted;
    await page.locator(`#person-${i} [data-judge="liar"]`).click();
    if (step > 0) {
      assert.equal(
        await page.locator(`#person-${i} .jail-gate-waiting`).count(),
        1,
        'gate waits for the correct chime',
      );
      assert.deepEqual(await page.evaluate(() => window.playedRecordings), [
        'assets/sounds/correct2.mp3',
      ]);
      await page
        .locator(`#person-${i} .jail-gate-closing`)
        .waitFor({ state: 'attached' });
      const cageDelay = Date.now() - judgmentStarted;
      assert.ok(
        cageDelay >= 550 && cageDelay < 950,
        `cage starts about 0.6 seconds after the chime (${cageDelay} ms)`,
      );
      assert.equal(
        await page.evaluate(() =>
          window.playedRecordings.includes('assets/sounds/cage-close.wav'),
        ),
        !solvesCase,
        'solving the case skips the cage sound',
      );
      assert.equal(
        await page.evaluate(() =>
          window.finishedRecordings.includes('assets/sounds/correct2.mp3'),
        ),
        false,
        'cage starts during the chime tail',
      );
      assert.equal(
        await page.locator(`#person-${i} .jail-gate-waiting`).count(),
        0,
      );
      assert.equal(
        await page.locator(`#person-${i} .jail-gate-closing`).count(),
        1,
        'gate animation starts after the delay',
      );
    } else {
      assert.equal(
        await page.locator(`#person-${i} .jail-gate-closing`).count(),
        1,
        'muted gate animates immediately',
      );
    }
    assert.equal(
      await page
        .locator(`#person-${i} .portrait-box .portrait`)
        .getAttribute('data-portrait-state'),
      solution[i] ? 'liar' : 'good',
    );
    assert.equal(
      await page
        .locator('#trust-value')
        .evaluate((element) => element.firstChild!.textContent),
      String(3 + (step === criminals.length - 1 ? 1 : 0)),
    );
    if (step < criminals.length - 1) {
      const feedback = await page.locator('#feedback').boundingBox();
      assert.ok(feedback);
      assert.ok(
        feedback.y >= 0 && feedback.y + feedback.height <= 1100,
        'judgment message stays in viewport',
      );
      assert.ok(
        (await baseText(page.locator('#feedback'))).includes(
          '正解です。捜査資金の増減はありません。',
        ),
      );
      await checkReadings(page);
    }
    if (step === 0) {
      assert.deepEqual(await page.evaluate(() => window.playedRecordings), []);
      await setToggle(page.locator('#sound-toggle'), true);
    } else {
      assert.deepEqual(
        await page.evaluate(() => window.playedRecordings.splice(0)),
        solvesCase
          ? ['assets/sounds/correct2.mp3']
          : ['assets/sounds/correct2.mp3', 'assets/sounds/cage-close.wav'],
      );
    }
  }
  assert.equal(
    await page
      .locator('#suspects [data-portrait-state="liar"] .jail-bar')
      .count(),
    solution.filter(Boolean).length * 4,
  );
  for (const [i, liar] of solution.entries()) {
    assert.equal(
      await page
        .locator(`#testimony-nav [data-person="${i}"] .portrait`)
        .getAttribute('data-portrait-state'),
      liar ? 'liar' : 'good',
    );
    assert.equal(
      await page
        .locator(`#testimony-nav [data-person="${i}"]`)
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      await page
        .locator(`#person-${i} .portrait-box`)
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    );
  }
  assert.equal(
    await page.locator('#result-dialog').isVisible(),
    false,
    'judgment feedback appears before the result dialog',
  );
  assert.equal(
    await page.locator('#result').isVisible(),
    false,
    'page result stays hidden while waiting for the dialog',
  );
  await page.locator('#result-dialog').waitFor({ state: 'visible' });
  assert.equal(
    await page.locator('#result').isVisible(),
    false,
    'page result stays hidden until the dialog closes',
  );
  const resultDelay =
    Number(
      await page.locator('#result-dialog').getAttribute('data-opened-at'),
    ) - finalJudgmentStarted;
  assert.ok(
    resultDelay >= 1200 && resultDelay < 1650,
    `result dialog opens about 1.25 seconds after judgment (${resultDelay} ms)`,
  );
  assert.ok(
    (await baseText(page.locator('#result-dialog-content'))).includes(
      '事件解決',
    ),
  );
  assert.equal(
    await baseText(page.locator('#result .case-ending')),
    `事件のその後${expectedStory.ending}`,
  );
  assert.equal(
    await baseText(page.locator('#result-dialog .case-ending')),
    `事件のその後${expectedStory.ending}`,
  );
  await page.waitForFunction(() =>
    window.playedRecordings.includes('assets/sounds/stamp.wav'),
  );
  assert.deepEqual(
    await page.evaluate(() => window.playedRecordings.splice(0)),
    ['assets/sounds/stamp.wav'],
  );
  await page.screenshot({ path: '/tmp/detective-result-dialog-desktop.png' });
  await page.locator('#result-dialog .close-button').click();
  assert.equal(await page.locator('#result-dialog').isVisible(), false);
  await page.locator('#next-case').waitFor({ state: 'visible' });
  assert.notEqual(
    await page.locator('#person-0 .portrait-box .portrait').innerHTML(),
    neutralPortrait,
  );
  assert.ok((await baseText(page.locator('#result'))).includes('事件解決'));
  assert.equal(await page.locator('.truth-detail').count(), 5);
  await checkReadings(page);
  await page.reload();
  assert.ok(
    await page.locator('#home-page').isVisible(),
    'reload opens the home page',
  );
  assert.ok(await page.locator('#game-page').isHidden());
  if (await page.locator('#continue-game').isVisible())
    await page.locator('#continue-game').click();
  await page.locator('#menu-toggle').click();
  assert.ok(await page.locator('#result').isVisible());
  assert.equal(
    await baseText(page.locator('#result .case-ending')),
    `事件のその後${expectedStory.ending}`,
    'ending survives reload',
  );
  assert.equal(
    await page
      .locator('#trust-value')
      .evaluate((element) => element.firstChild!.textContent),
    String(4),
  );
  assert.deepEqual(
    await page.evaluate(() => window.playedRecordings),
    [],
    'restoring a solved case does not play the stamp',
  );
  assert.equal(
    (await page.locator('#sound-toggle').getAttribute('aria-pressed')) ===
      'true',
    true,
  );
  assert.equal(
    await page
      .locator('#person-0 .portrait-box .portrait')
      .getAttribute('data-portrait-state'),
    solution[0] ? 'liar' : 'good',
  );
  await openMenu(page);
  await openMenu(page);
  await page.locator('#new-case').click();
  await page.locator('#difficulty').selectOption('hard');
  await page.locator('#confirm-new').click();
  assert.equal(await page.locator('.suspect').count(), 7);
  assert.equal(await page.locator('.statement').count(), 7);
  const hard = await page.evaluate(
    () =>
      (JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState)
        .puzzle.answer,
  );
  assert.equal(
    await page
      .locator(
        '#suspects .portrait-box [data-portrait-state="neutral"], #animals-list [data-portrait-state="neutral"]',
      )
      .count(),
    7 + (await page.evaluate(() => window.DetectiveEngine.roles.length)),
  );
  const innocents = hard.flatMap((liar, i) => (liar ? [] : [i]));
  for (let step = 0; step < 4; step++) {
    const i = innocents[step];
    await page.locator(`#person-${i} [data-judge="liar"]`).click();
    assert.equal(
      await page
        .locator(`#person-${i} .portrait-box .portrait`)
        .getAttribute('data-portrait-state'),
      'sad',
    );
    assert.equal(
      await page
        .locator(`#testimony-nav [data-person="${i}"] .portrait`)
        .getAttribute('data-portrait-state'),
      'sad',
    );
    assert.equal(
      await page
        .locator(`#testimony-nav [data-person="${i}"]`)
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      await page
        .locator(`#person-${i} .portrait-box`)
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    );
    assert.equal(await page.locator(`#person-${i} .jail-bar`).count(), 0);
    assert.equal(
      await page
        .locator('#trust-value')
        .evaluate((element) => element.firstChild!.textContent),
      String(2 - step),
    );
    assert.equal(
      await page.locator('#trust').getAttribute('aria-label'),
      `残り捜査資金 ${2 - step}`,
    );
    assert.deepEqual(
      await page.evaluate(() => window.playedRecordings.splice(0)),
      ['assets/sounds/incorrect2.mp3'],
    );
  }
  assert.equal(
    await page.locator('#result-dialog').isVisible(),
    false,
    'judgment feedback appears before the result dialog',
  );
  await page.locator('#result-dialog').waitFor({ state: 'visible' });
  assert.equal(
    await page.locator('#result').isVisible(),
    false,
    'failed case result stays hidden until the dialog closes',
  );
  assert.ok(
    (await baseText(page.locator('#result-dialog-content'))).includes(
      '捜査資金がマイナスになりました',
    ),
  );
  assert.equal(
    await page.locator('.case-ending').count(),
    0,
    'unsolved cases have no ending',
  );
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#result-dialog').isVisible(), false);
  await page.locator('#result').waitFor({ state: 'visible' });
  assert.ok(
    (await baseText(page.locator('#result'))).includes(
      '捜査資金がマイナスになりました',
    ),
  );
  assert.equal(await page.locator('[data-judge]').count(), 0);
  await page.reload();
  assert.ok(
    await page.locator('#home-page').isVisible(),
    'reload opens the home page',
  );
  assert.ok(await page.locator('#game-page').isHidden());
  if (await page.locator('#continue-game').isVisible())
    await page.locator('#continue-game').click();
  await page.locator('#menu-toggle').click();
  assert.equal(
    await page
      .locator('#trust-value')
      .evaluate((element) => element.firstChild!.textContent),
    '-1',
  );
  assert.ok(await page.locator('#result').isVisible());
  await page.locator('#next-case').click();
  await page.locator('#difficulty').selectOption('easy');
  await page.locator('#confirm-new').click();
  assert.equal(await page.locator('.suspect').count(), 4);
  for (const width of [1440, 600, 414, 401, 390, 375, 360, 340, 320]) {
    // Two columns shorten the desktop page; use a shorter viewport to exercise sticky scrolling.
    await page.setViewportSize({ width, height: width === 1440 ? 440 : 844 });
    const cards = await page.locator('.suspect').evaluateAll((elements) =>
      elements.slice(0, 2).map((element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top, left: rect.left };
      }),
    );
    assert.equal(
      cards[0].top === cards[1].top,
      width === 1440,
      `testimony columns at ${width}`,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `overflow at ${width}`,
    );
    const titleLines = await page.locator('.brand-text').evaluate((element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const boxes: { top: number; bottom: number }[] = [];
      while (walker.nextNode()) {
        if (walker.currentNode.parentElement?.closest('rt')) continue;
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        boxes.push(
          ...Array.from(range.getClientRects(), (rect) => ({
            top: rect.top,
            bottom: rect.bottom,
          })),
        );
      }
      return boxes;
    });
    assert.ok(
      Math.max(...titleLines.map((box) => box.top)) <
        Math.min(...titleLines.map((box) => box.bottom)),
      `entire Japanese title stays on one line at ${width}`,
    );
    const titleBox = await page.locator('.brand').boundingBox();
    const actionsBox = await page.locator('.header-actions').boundingBox();
    assert.ok(
      titleBox && actionsBox && titleBox.x + titleBox.width <= actionsBox.x,
      `title and actions do not overlap at ${width}`,
    );
    await openMenu(page);
    const menu = await page.locator('.header-right').boundingBox();
    assert.ok(menu);
    const brand = await page.locator('.brand').boundingBox();
    assert.ok(brand);
    assert.ok(
      menu.y >= brand.y + brand.height,
      'expanded menu appears below brand',
    );
    const menuButtons = await page
      .locator('.header-right > button')
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const box = button.getBoundingClientRect();
          return {
            top: box.top,
            bottom: box.bottom,
            left: box.left,
            width: box.width,
          };
        }),
      );
    assert.ok(
      menuButtons.every(
        (box, i) => i === 0 || box.top >= menuButtons[i - 1].bottom,
      ),
      'each menu button occupies its own row',
    );
    assert.ok(
      menuButtons.every(
        (box) =>
          Math.abs(box.left - menuButtons[0].left) < 1 &&
          Math.abs(box.width - menuButtons[0].width) < 1,
      ),
      'menu buttons share column width',
    );
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const expandedHeader = await page.locator('.masthead').boundingBox();
    const expandedContent = await page.locator('.title-row').boundingBox();
    await page.locator('#menu-toggle').click();
    const collapsedHeader = await page.locator('.masthead').boundingBox();
    const collapsedContent = await page.locator('.title-row').boundingBox();
    assert.equal(
      expandedHeader?.height,
      collapsedHeader?.height,
      'overlay does not expand header',
    );
    assert.equal(
      expandedContent?.y,
      collapsedContent?.y,
      'overlay does not push page content down',
    );
    await page.locator('#menu-toggle').click();
    const headerButtons = await page
      .locator('.header-actions > button')
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const box = button.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            top: box.top,
            height: box.height,
          };
        }),
      );
    assert.equal(headerButtons.length, 2);
    assert.ok(
      headerButtons.every(
        (box, i) =>
          box.height >= 44 &&
          (i === 0 || box.left >= headerButtons[i - 1].right),
      ),
      'header actions appear in order',
    );
    assert.ok(
      headerButtons.every((box) => box.top === headerButtons[0].top),
      'header actions share a row',
    );
    assert.equal(
      await page
        .locator('#game-menu #help-button, #game-menu #language-select')
        .count(),
      0,
    );
    assert.equal(await baseText(page.locator('#help-button')), '📖遊び方');
    assert.deepEqual(
      await page
        .locator('.header-actions > button')
        .evaluateAll((buttons) => buttons.map((button) => button.id)),
      ['help-button', 'menu-toggle'],
    );
    assert.equal(
      await baseText(page.locator('#delete-save .menu-label')),
      'データの消去',
    );
    assert.equal(await page.locator('#delete-save svg').count(), 1);
    assert.equal(await baseText(page.locator('#new-case')), '最初から');
    const languageControl = await page
      .locator('.language-control')
      .boundingBox();
    assert.ok(
      languageControl &&
        languageControl.x >= headerButtons[0].right &&
        languageControl.x + languageControl.width <= headerButtons[1].left,
      'language selection is between help and menu',
    );
    await page.locator('#menu-toggle').click();
    assert.ok(
      await page.locator('#language-select').isVisible(),
      'language selection remains visible with menu closed',
    );

    for (const rubyEnabled of [true, false]) {
      await setToggle(page.locator('#ruby-toggle'), rubyEnabled);
      await page.evaluate(() =>
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'instant',
        }),
      );
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      const summary = await page.locator('.case-summary').boundingBox();
      assert.ok(summary);
      const masthead = await page.locator('.masthead').boundingBox();
      assert.ok(
        masthead && Math.abs(masthead.y) < 1,
        'menu remains visible while scrolling',
      );
      assert.ok(
        Math.abs(summary.y - masthead.height) < 2,
        `summary pinned below menu at ${width}, ruby=${rubyEnabled}`,
      );
      assert.ok(summary.y + summary.height < 844);
      const feedback = await page.locator('#feedback').boundingBox();
      assert.ok(feedback);
      assert.ok(
        feedback.y >= summary.y + summary.height &&
          feedback.y + feedback.height <= 844,
        'feedback remains visible while scrolling',
      );
      for (const id of [
        'liar-count',
        'good-count',
        'progress-count',
        'trust',
      ]) {
        const box = await page.locator('#' + id).boundingBox();
        assert.ok(box);
        assert.ok(
          box.y >= summary.y &&
            box.y + box.height <= summary.y + summary.height,
        );
        assert.ok(box.x >= 0 && box.x + box.width <= width);
      }
      await page
        .locator('#person-3 [data-judge="liar"]')
        .evaluate((button) =>
          button.scrollIntoView({ block: 'start', behavior: 'instant' }),
        );
      const button = await page
        .locator('#person-3 [data-judge="liar"]')
        .boundingBox();
      assert.ok(button);
      assert.ok(
        button.y >= summary.height,
        'pinned summary must not cover the scrolled-to button',
      );
      if (width === 390 && rubyEnabled)
        await page.screenshot({ path: '/tmp/detective-sticky-summary.png' });
    }
    await setToggle(page.locator('#ruby-toggle'), true);
    await openMenu(page);
    await page.locator('#help-button').click();
    assert.ok(await page.locator('#help-dialog').isVisible());
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '/tmp/beast-detective-mobile.png',
    fullPage: true,
  });
  const easyAnswer = await page.evaluate(
    () =>
      (JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState)
        .puzzle.answer,
  );
  for (let i = 0; i < easyAnswer.length; i++) {
    if (!easyAnswer[i]) continue;
    await page.locator(`#person-${i} [data-judge="liar"]`).click();
  }
  await page.locator('#result-dialog').waitFor({ state: 'visible' });
  const modal = await page.locator('#result-dialog').boundingBox();
  assert.ok(modal);
  assert.ok(
    modal.y >= 0 && modal.y + modal.height <= 844,
    'result dialog fits mobile viewport',
  );
  assert.ok(
    Math.abs(modal.y + modal.height / 2 - 422) < 2,
    'result dialog centered after scrolling',
  );
  await page.screenshot({ path: '/tmp/detective-result-dialog-mobile.png' });
  for (let round = 2; round <= 3; round++) {
    const previous = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState,
    );
    await page.locator('#dialog-next-case').click();
    assert.equal(await page.locator('#new-dialog').isVisible(), false);
    assert.equal(
      await page
        .locator('#trust-value')
        .evaluate((element) => element.firstChild!.textContent),
      String(previous.trust),
    );
    assert.equal(await page.locator('#result').isVisible(), false);
    await page.reload();
    assert.ok(
      await page.locator('#home-page').isVisible(),
      'reload opens the home page',
    );
    assert.ok(await page.locator('#game-page').isHidden());
    if (await page.locator('#continue-game').isVisible())
      await page.locator('#continue-game').click();
    const current = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState,
    );
    assert.equal(current.puzzle.round, round);
    assert.deepEqual(current.storyHistory.slice(0, -1), previous.storyHistory);
    assert.equal(new Set(current.storyHistory).size, round);
    assert.equal(current.trust, previous.trust);
    assert.equal(
      current.previousMistakes,
      previous.previousMistakes +
        previous.resolved.filter((r) => r && !r.correct).length,
    );
    assert.ok(current.puzzle.people.length >= previous.puzzle.people.length);
    assert.ok(current.puzzle.k >= previous.puzzle.k);
    assert.ok(current.resolved.every((r) => r === null));
    assert.equal(
      await page.locator('.statement').count(),
      current.puzzle.people.length,
    );
    await setToggle(page.locator('#sound-toggle'), true);
    await page.evaluate(() => window.playedRecordings.splice(0));
    for (let i = 0; i < current.puzzle.answer.length; i++) {
      if (current.puzzle.answer[i])
        await page.locator(`#person-${i} [data-judge="liar"]`).click();
    }
    await page.locator('#result-dialog').waitFor({ state: 'visible' });
    const result = await baseText(page.locator('#result-dialog-content'));
    assert.equal(result.includes('すべての事件を解決！'), round === 3);
    await page.waitForFunction(() =>
      window.playedRecordings.includes('assets/sounds/stamp.wav'),
    );
    if (round === 3) {
      assert.ok(result.includes('全事件で間違えて犯人と判定した回数0回'));
      assert.ok(
        result.includes('一度も間違えずに、すべての事件を解決しました！'),
      );
      assert.equal(
        await baseText(
          page.locator('#result-dialog-content > :last-child > summary'),
        ),
        '最後の事件のその後',
      );
      await page.setViewportSize({ width: 320, height: 844 });
      const table = await page
        .locator('#result-dialog .campaign-results')
        .boundingBox();
      assert.ok(
        table && table.x >= 0 && table.x + table.width <= 320,
        'campaign table fits narrow screens',
      );
      await page.screenshot({ path: '/tmp/detective-campaign-table.png' });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(
        () =>
          window.playedRecordings.includes(
            'assets/sounds/people-performance-cheer1.mp3',
          ),
        { timeout: 15000 },
      );
      const celebration = await page.evaluate(() =>
        window.playedRecordings.filter(
          (src) =>
            !src.endsWith('correct2.mp3') && !src.endsWith('cage-close.wav'),
        ),
      );
      assert.deepEqual(celebration, [
        'assets/sounds/stamp.wav',
        'assets/sounds/people-performance-cheer1.mp3',
      ]);
    } else {
      assert.equal(
        await page.evaluate(() =>
          window.playedRecordings.includes(
            'assets/sounds/people-performance-cheer1.mp3',
          ),
        ),
        false,
      );
    }
    await checkReadings(page);
  }
  await page.locator('#dialog-next-case').click();
  assert.ok(await page.locator('#new-dialog').isVisible());
  await page.locator('#confirm-new').click();
  assert.equal(
    await page
      .locator('#trust-value')
      .evaluate((element) => element.firstChild!.textContent),
    '3',
  );
  assert.equal(
    await page.evaluate(
      () =>
        (JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState)
          .puzzle.round,
    ),
    1,
  );
  await page.evaluate(() =>
    localStorage.setItem('beast-detective-v1', '{bad json'),
  );
  await page.reload();
  assert.ok(
    await page.locator('#home-page').isVisible(),
    'reload opens the home page',
  );
  assert.ok(await page.locator('#game-page').isHidden());
  if (await page.locator('#continue-game').isVisible())
    await page.locator('#continue-game').click();
  assert.ok(await page.locator('#home-page').isVisible());
  await startGame(page);
  const invalidSave = await browser.newPage({ locale: 'ja-JP' });
  await invalidSave.goto(
    pathToFileURL(path.resolve(__dirname, '../../index.html')).href,
  );
  await startGame(invalidSave);
  for (const problem of [
    'old-version',
    'previous-rules',
    'wrong-trust',
    'wrong-status',
  ]) {
    await invalidSave.evaluate((problem) => {
      const saved = JSON.parse(
        localStorage.getItem('beast-detective-v1')!,
      ) as GameState;
      saved.notes[0] = '引き継がないメモ';
      if (problem === 'old-version') saved.version = 1;
      if (problem === 'previous-rules') saved.version = 14;
      if (problem === 'wrong-trust') saved.trust = 999;
      if (problem === 'wrong-status') saved.status = 'won';
      localStorage.setItem('beast-detective-v1', JSON.stringify(saved));
    }, problem);
    await invalidSave.reload();
    assert.ok(await invalidSave.locator('#home-page').isVisible(), problem);
    await startGame(invalidSave);
    assert.equal(
      await invalidSave
        .locator('#trust-value')
        .evaluate((element) => element.firstChild!.textContent),
      '3',
    );
    assert.equal(
      await invalidSave.locator('#memo-0').inputValue(),
      '',
      problem,
    );
    assert.equal(await invalidSave.locator('.resolved-tag').count(), 0);
  }
  await page.locator('#memo-0').fill('消去の確認用メモ');
  const saveBeforeDelete = await page.evaluate(() =>
    localStorage.getItem('beast-detective-v1'),
  );
  const preferencesBeforeDelete = await page.evaluate(() =>
    localStorage.getItem('animal-detective-preferences-v1'),
  );
  await openMenu(page);
  await page.locator('#delete-save').click();
  assert.ok(await page.locator('#delete-save-dialog').isVisible());
  await page.locator('[data-close="delete-save-dialog"]').click();
  assert.equal(
    await page.evaluate(() => localStorage.getItem('beast-detective-v1')),
    saveBeforeDelete,
  );
  await openMenu(page);
  await page.locator('#delete-save').click();
  await page.locator('#confirm-delete-save').click();
  assert.equal(
    await page.evaluate(() => localStorage.getItem('beast-detective-v1')),
    null,
  );
  assert.ok(await page.locator('#home-page').isVisible());
  assert.ok(await page.locator('#game-page').isHidden());
  assert.equal(await page.locator('.suspect').count(), 0);
  assert.ok(await page.locator('#continue-game').isHidden());
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem('animal-detective-preferences-v1'),
    ),
    preferencesBeforeDelete,
  );
  await page.reload();
  assert.ok(
    await page.locator('#home-page').isVisible(),
    'reload opens the home page',
  );
  assert.ok(await page.locator('#game-page').isHidden());
  if (await page.locator('#continue-game').isVisible())
    await page.locator('#continue-game').click();
  assert.ok(await page.locator('#home-page').isVisible());
  assert.equal(
    await page.evaluate(() => localStorage.getItem('beast-detective-v1')),
    null,
  );
  await startGame(page);
  assert.equal(await page.locator('#memo-0').inputValue(), '');
  // All testimony remains available with zero funds, including after reload.
  await page.evaluate(() => {
    const saved = JSON.parse(
      localStorage.getItem('beast-detective-v1')!,
    ) as GameState;
    const puzzle = window.DetectiveEngine.generate(0, 'hard', 5);
    Object.assign(saved, {
      puzzle,
      startingTrust: 0,
      trust: 0,
      status: 'playing',
      resolved: puzzle.people.map(() => null),
      notes: puzzle.people.map(() => ''),
      markers: puzzle.people.map(() => 0),
    });
    localStorage.setItem('beast-detective-v1', JSON.stringify(saved));
  });
  for (let load = 0; load < 2; load++) {
    await page.reload();
    await page.locator('#continue-game').click();
    assert.equal(await page.locator('.statement').count(), 10);
    assert.equal(
      await page.locator('[data-reveal], .testimony-targets').count(),
      0,
    );
    assert.equal(
      await page.locator('#trust').getAttribute('aria-label'),
      '残り捜査資金 0',
    );
    await checkReadings(page);
  }
  const mistaken = await page.evaluate(() => {
    const saved = JSON.parse(
      localStorage.getItem('beast-detective-v1')!,
    ) as GameState;
    const puzzle = window.DetectiveEngine.generate(0, 'normal', 5);
    Object.assign(saved, {
      puzzle,
      startingTrust: 3,
      trust: 3,
      status: 'playing',
      resolved: puzzle.people.map(() => null),
      notes: puzzle.people.map(() => ''),
      markers: puzzle.people.map(() => 0),
    });
    localStorage.setItem('beast-detective-v1', JSON.stringify(saved));
    return puzzle.mistaken!;
  });
  await page.reload();
  assert.ok(
    await page.locator('#home-page').isVisible(),
    'reload opens the home page',
  );
  assert.ok(await page.locator('#game-page').isHidden());
  if (await page.locator('#continue-game').isVisible())
    await page.locator('#continue-game').click();
  assert.ok(
    (await baseText(page.locator('#mistaken-count'))).includes(
      'うち勘違いしている善人１匹',
    ),
  );
  assert.ok(await page.locator('#mistaken-rule').isVisible());
  await page.locator(`#person-${mistaken} [data-marker-value="4"]`).click();
  await page.reload();
  assert.ok(
    await page.locator('#home-page').isVisible(),
    'reload opens the home page',
  );
  assert.ok(await page.locator('#game-page').isHidden());
  if (await page.locator('#continue-game').isVisible())
    await page.locator('#continue-game').click();
  assert.equal(
    await page.locator(`#person-${mistaken}`).getAttribute('data-marker'),
    '4',
  );
  await page.locator(`#person-${mistaken} [data-judge]`).click();
  assert.ok(
    (
      await baseText(page.locator(`#person-${mistaken} .resolved-tag`))
    ).includes('勘違いしている善人'),
  );
  assert.equal(
    await page.locator('#trust').getAttribute('aria-label'),
    '残り捜査資金 2',
  );
  await page.reload();
  assert.ok(
    await page.locator('#home-page').isVisible(),
    'reload opens the home page',
  );
  assert.ok(await page.locator('#game-page').isHidden());
  if (await page.locator('#continue-game').isVisible())
    await page.locator('#continue-game').click();
  assert.ok(
    (
      await baseText(page.locator(`#person-${mistaken} .resolved-tag`))
    ).includes('勘違いしている善人'),
  );
  await checkReadings(page);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  const remainingCriminals = await page.evaluate(() =>
    (
      JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState
    ).puzzle.answer.flatMap((criminal, i) => (criminal ? [i] : [])),
  );
  for (const i of remainingCriminals)
    await page.locator(`#person-${i} [data-judge]`).click();
  assert.ok(
    (
      await baseText(page.locator(`#person-${mistaken} .truth-detail`))
    ).includes('勘違い（間違い）'),
  );
  assert.equal(
    await baseText(page.locator('#result h2')),
    'すべての事件を解決！',
  );
  await checkReadings(page);
  await page.locator('#result-dialog').waitFor({ state: 'visible' });
  const scrollBeforeResult = Number(
    await page
      .locator('#result-dialog')
      .getAttribute('data-scroll-before-open'),
  );
  const scrollAfterResult = Number(
    await page.locator('#result-dialog').getAttribute('data-scroll-after-open'),
  );
  assert.ok(scrollBeforeResult > 0, 'mobile case ends while scrolled down');
  assert.equal(
    scrollAfterResult,
    scrollBeforeResult,
    'opening the result dialog preserves mobile page scroll',
  );
  assert.equal(
    await page.evaluate(() => window.scrollY),
    scrollBeforeResult,
    'scroll remains stable after the result dialog opens',
  );
  // Count mistakes across cases and reloads, including a mistake in the final case.
  const campaign = await browser.newPage({
    locale: 'ja-JP',
    reducedMotion: 'reduce',
  });
  await campaign.goto(
    pathToFileURL(path.resolve(__dirname, '../../index.html')).href,
  );
  await campaign.evaluate(() => localStorage.removeItem('beast-detective-v1'));
  await campaign.reload();
  assert.ok(
    await campaign.locator('#home-page').isVisible(),
    'reload opens the home page',
  );
  assert.ok(await campaign.locator('#game-page').isHidden());
  if (await campaign.locator('#continue-game').isVisible())
    await campaign.locator('#continue-game').click();
  await campaign.locator('#start-game').click();
  await campaign.locator('#difficulty').selectOption('easy');
  await campaign.locator('#confirm-new').click();
  for (let round = 1; round <= 3; round++) {
    const answer = await campaign.evaluate(
      () =>
        (JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState)
          .puzzle.answer,
    );
    if (round !== 2)
      await campaign
        .locator(`#person-${answer.indexOf(false)} [data-judge="liar"]`)
        .click();
    await campaign.reload();
    assert.ok(
      await campaign.locator('#home-page').isVisible(),
      'reload opens the home page',
    );
    assert.ok(await campaign.locator('#game-page').isHidden());
    if (await campaign.locator('#continue-game').isVisible())
      await campaign.locator('#continue-game').click();
    for (let i = 0; i < answer.length; i++) {
      if (answer[i])
        await campaign.locator(`#person-${i} [data-judge="liar"]`).click();
    }
    await campaign.locator('#result-dialog').waitFor({ state: 'visible' });
    if (round < 3) await campaign.locator('#dialog-next-case').click();
  }
  const completedText = await baseText(
    campaign.locator('#result-dialog-content'),
  );
  assert.ok(completedText.includes('全事件で間違えて犯人と判定した回数2回'));
  assert.ok(!completedText.includes('一度も間違えずに'));
  assert.equal(
    await baseText(
      campaign.locator('#result-dialog-content > :last-child > summary'),
    ),
    '最後の事件のその後',
  );
  assert.equal(
    await baseText(campaign.locator('#result-dialog .quiet-button')),
    '結果を確認',
  );
  await checkReadings(campaign);
  await campaign.reload();
  assert.ok(
    await campaign.locator('#home-page').isVisible(),
    'reload opens the home page',
  );
  assert.ok(await campaign.locator('#game-page').isHidden());
  if (await campaign.locator('#continue-game').isVisible())
    await campaign.locator('#continue-game').click();
  assert.ok(
    (await baseText(campaign.locator('#result'))).includes(
      '全事件で間違えて犯人と判定した回数2回',
    ),
  );
  await campaign.locator('#next-case').click();
  await campaign.locator('#confirm-new').click();
  assert.equal(
    await campaign.evaluate(
      () =>
        (JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState)
          .previousMistakes,
    ),
    0,
  );
  await campaign.close();
  // URL funds apply once per load, survive normal saves, and preserve the puzzle.
  const debug = await browser.newPage({
    locale: 'ja-JP',
    reducedMotion: 'reduce',
  });
  debug.on('pageerror', (e) => errors.push(e.message));
  const gameUrl = pathToFileURL(
    path.resolve(__dirname, '../../index.html'),
  ).href;
  const debugState = () =>
    debug.evaluate(
      () =>
        JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState,
    );
  await debug.goto(`${gameUrl}?debugMoney=100`);
  if (await debug.locator('#continue-game').isVisible())
    await debug.locator('#continue-game').click();
  await startGame(debug);
  assert.equal((await debugState()).trust, 100);
  const debugPuzzle = (await debugState()).puzzle;
  await debug
    .locator(`#person-${debugPuzzle.answer.indexOf(false)} [data-judge="liar"]`)
    .click();
  const afterSpending = 99;
  assert.equal(
    (await debugState()).trust,
    afterSpending,
    'rerender must not reset funds',
  );
  await debug.goto(gameUrl);
  if (await debug.locator('#continue-game').isVisible())
    await debug.locator('#continue-game').click();
  assert.equal((await debugState()).trust, afterSpending);
  assert.equal(
    await debug.locator('#trust-value').textContent(),
    String(afterSpending),
  );
  assert.deepEqual((await debugState()).puzzle, debugPuzzle);
  assert.equal(
    await debug.locator('.statement').count(),
    debugPuzzle.people.length,
  );
  for (const invalid of [
    '',
    'abc',
    '1.5',
    '1e3',
    'Infinity',
    '1000000001',
    '-1000000001',
  ]) {
    await debug.goto(`${gameUrl}?debugMoney=${invalid}`);
    if (await debug.locator('#continue-game').isVisible())
      await debug.locator('#continue-game').click();
    assert.equal(
      await debug.locator('#trust-value').textContent(),
      String(afterSpending),
    );
  }
  await debug.goto(`${gameUrl}?debugMoney=0`);
  if (await debug.locator('#continue-game').isVisible())
    await debug.locator('#continue-game').click();
  assert.equal((await debugState()).trust, 0);
  assert.equal((await debugState()).status, 'playing');
  await debug.goto(`${gameUrl}?debugMoney=-1`);
  if (await debug.locator('#continue-game').isVisible())
    await debug.locator('#continue-game').click();
  assert.equal((await debugState()).status, 'lost');
  await debug.goto(gameUrl);
  if (await debug.locator('#continue-game').isVisible())
    await debug.locator('#continue-game').click();
  assert.equal(await debug.locator('#trust-value').textContent(), '-1');
  await debug.goto(`${gameUrl}?debugMoney=100`);
  if (await debug.locator('#continue-game').isVisible())
    await debug.locator('#continue-game').click();
  assert.equal((await debugState()).status, 'playing');
  for (const [i, criminal] of debugPuzzle.answer.entries()) {
    if (criminal)
      await debug.locator(`#person-${i} [data-judge="liar"]`).click();
  }
  assert.equal((await debugState()).status, 'won');
  for (const funds of [0, -1, 100]) {
    await debug.goto(`${gameUrl}?debugMoney=${funds}`);
    if (await debug.locator('#continue-game').isVisible())
      await debug.locator('#continue-game').click();
    await debug.goto(gameUrl);
    if (await debug.locator('#continue-game').isVisible())
      await debug.locator('#continue-game').click();
    assert.equal(
      await debug.locator('#trust-value').textContent(),
      String(funds),
    );
    assert.equal((await debugState()).status, funds < 0 ? 'lost' : 'won');
  }
  await debug.goto(`${gameUrl}?debugMoney=0`);
  if (await debug.locator('#continue-game').isVisible())
    await debug.locator('#continue-game').click();
  await debug.locator('#next-case').click();
  await debug.goto(gameUrl);
  if (await debug.locator('#continue-game').isVisible())
    await debug.locator('#continue-game').click();
  assert.equal((await debugState()).puzzle.round, 2);
  assert.equal(await debug.locator('#trust-value').textContent(), '0');
  await debug.close();
  const blocked = await browser.newPage({ locale: 'ja-JP' });
  await blocked.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('storage blocked');
      },
    });
  });
  await blocked.goto(
    pathToFileURL(path.resolve(__dirname, '../../index.html')).href,
  );
  assert.ok(await blocked.locator('#home-page').isVisible());
  await startGame(blocked);
  assert.equal(await blocked.locator('.suspect').count(), 5);
  await setToggle(blocked.locator('#ruby-toggle'), false);
  assert.equal(await blocked.locator('ruby rt').first().isVisible(), false);
  assert.ok(
    (await baseText(blocked.locator('#save-status'))).includes(
      '保存できません',
    ),
  );
  await setToggle(blocked.locator('#sound-toggle'), false);
  assert.equal(
    (await blocked.locator('#sound-toggle').getAttribute('aria-pressed')) ===
      'true',
    false,
  );
  const silent = await browser.newPage({ locale: 'ja-JP' });
  silent.on('pageerror', (e) => errors.push(e.message));
  await silent.addInitScript(() => {
    HTMLMediaElement.prototype.play = () =>
      Promise.reject(new Error('audio unavailable'));
  });
  await silent.goto(
    pathToFileURL(path.resolve(__dirname, '../../index.html')).href,
  );
  await startGame(silent);
  await silent.locator('#person-0 [data-judge="liar"]').click();
  assert.equal(await silent.locator('#person-0 .resolved-tag').count(), 1);
  assert.deepEqual(errors, []);
  await checkEnglish(browser);
  await browser.close();
  console.log(
    'PASS: file:// launch, desktop/mobile widths, notes/markers, restore, dialogs, wins/losses, all levels, corrupt/blocked storage.',
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
