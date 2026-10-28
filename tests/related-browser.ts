import type { Browser, Locator, Page } from 'playwright';
import assert = require('node:assert/strict');
import { pathToFileURL } from 'node:url';
import path = require('node:path');

async function baseText(locator: Locator) {
  return locator.evaluate((element) => {
    const copy = element.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('rt').forEach((rt) => rt.remove());
    return copy.textContent?.trim() ?? '';
  });
}

export async function checkRelatedTestimony(browser: Browser) {
  const page = await browser.newPage({
    locale: 'ja-JP',
    reducedMotion: 'reduce',
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(
    pathToFileURL(path.resolve(__dirname, '../../index.html')).href,
  );
  await page.locator('#start-game').click();
  await page.locator('#confirm-new').click();
  const fixture = await page.evaluate(() => {
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
      notes: puzzle.people.map((_, i) =>
        i === 0 ? '' : `Note ${i} <b> & detail\nSecond line`,
      ),
      markers: puzzle.people.map((_, i) => i % 5),
    });
    localStorage.setItem('beast-detective-v1', JSON.stringify(saved));
    return {
      puzzle,
      texts: puzzle.statements.map((s) =>
        window.DetectiveEngine.statementText(s, puzzle.people),
      ),
    };
  });
  await page.reload();
  assert.ok(
    await page.locator('#home-page').isVisible(),
    'reload opens the home page',
  );
  assert.ok(await page.locator('#game-page').isHidden());
  if (await page.locator('#continue-game').isVisible())
    await page.locator('#continue-game').click();
  await checkActionLayout(page);
  const dialog = page.locator('#related-dialog');
  for (let selected = 0; selected < fixture.puzzle.people.length; selected++) {
    const expected = [
      selected,
      ...fixture.puzzle.statements.flatMap((s, i) =>
        i !== selected && s.targets.includes(selected) ? [i] : [],
      ),
    ];
    const opener = page.locator(`[data-related="${selected}"]`);
    assert.equal(await baseText(opener), '🔎 関連する証言');
    await opener.click();
    assert.deepEqual(
      await page
        .locator('[data-related-person]')
        .evaluateAll((buttons) =>
          buttons.map((b) => Number((b as HTMLElement).dataset.relatedPerson)),
        ),
      expected,
    );
    assert.equal(
      await dialog.locator('.statement').count(),
      expected.length,
      'all related testimony is immediately visible even with zero funds',
    );
    assert.equal(
      await dialog.locator('.unheard-label, .witness-marker').count(),
      0,
    );
    await checkRelatedIcons(page);
    for (const i of expected) {
      const note = dialog.locator(`[data-related-note="${i}"]`);
      if (i === 0)
        assert.equal(await note.count(), 0, 'empty notes stay hidden');
      else {
        assert.equal(
          await baseText(note),
          `Note ${i} <b> & detail\nSecond line`,
        );
        assert.equal(
          await note.locator('b').count(),
          0,
          'notes render as plain text',
        );
        assert.equal(
          await note.evaluate(
            (element) => getComputedStyle(element).whiteSpace,
          ),
          'pre-wrap',
        );
      }
    }
    await page.keyboard.press('Escape');
    await opener.waitFor({ state: 'visible' });
    assert.equal(
      await opener.evaluate((button) => button === document.activeElement),
      true,
    );
  }
  const speaker = 0;
  await page.locator(`[data-related="${speaker}"]`).click();
  assert.equal(await dialog.locator('#related-funds').count(), 0);
  assert.equal(await dialog.locator('[data-related-reveal]').count(), 0);
  assert.equal(
    await baseText(page.locator(`#related-statement-${speaker} .statement`)),
    fixture.texts[speaker],
  );
  await page.locator(`[data-related-person="${speaker}"]`).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(
    await page
      .locator(`#person-${speaker}`)
      .evaluate((element) => element === document.activeElement),
    true,
  );
  // Highlight the selected animal in another animal's testimony.
  const selected = fixture.puzzle.statements[speaker].targets.find(
    (i) => i !== speaker,
  )!;
  await page.locator(`[data-related="${selected}"]`).click();
  assert.equal(
    await baseText(page.locator(`#related-statement-${speaker} .statement`)),
    fixture.texts[speaker],
  );
  assert.ok(
    (await page
      .locator(`#related-statement-${speaker} .selected-animal`)
      .count()) > 0,
  );
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const box = await dialog.boundingBox();
    assert.ok(
      box &&
        box.x >= 0 &&
        box.x + box.width <= width &&
        box.y >= 0 &&
        box.y + box.height <= 844,
    );
    assert.ok(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
      'dialog has no horizontal overflow',
    );
    const close = dialog.locator('.close-button');
    const beforeScroll = await close.boundingBox();
    const titleBeforeScroll = await dialog.locator('h2').boundingBox();
    assert.ok(
      beforeScroll &&
        titleBeforeScroll &&
        Math.abs(beforeScroll.y - titleBeforeScroll.y) < 1,
      'title and close button share the top row',
    );
    assert.equal(
      await dialog.locator('.eyebrow').count(),
      0,
      'dialog starts with its title',
    );
    const scrolled = await dialog
      .locator('.related-dialog-body')
      .evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        return element.scrollTop;
      });
    if (width === 320)
      assert.ok(scrolled > 0, 'mobile testimony content scrolls');
    assert.deepEqual(
      await close.boundingBox(),
      beforeScroll,
      'close button stays in place when testimony scrolls',
    );
    assert.deepEqual(
      await dialog.locator('h2').boundingBox(),
      titleBeforeScroll,
      'title stays in place when testimony scrolls',
    );
    await dialog.locator('.related-dialog-body').evaluate((element) => {
      element.scrollTop = 0;
    });
    if (width === 390)
      await page.screenshot({ path: '/tmp/detective-related-mobile.png' });
  }
  const missingReadings = await dialog.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const missing: string[] = [];
    while (walker.nextNode()) {
      if (
        !walker.currentNode.parentElement?.closest('ruby, svg') &&
        /[一-龯々]/.test(walker.currentNode.textContent || '')
      )
        missing.push(walker.currentNode.textContent || '');
    }
    return missing;
  });
  assert.deepEqual(missingReadings, []);
  await page.keyboard.press('Escape');
  await page.locator('#menu-toggle').click();
  await page.locator('#language-select').selectOption('en');
  await checkActionLayout(page);
  await page.locator(`[data-related="${selected}"]`).click();
  assert.ok(
    (await dialog.locator('h2').textContent())?.startsWith(
      'Testimony related to ',
    ),
  );
  assert.equal(
    await baseText(page.locator('#own-testimony-heading')),
    'Own testimony',
  );
  assert.equal(await dialog.locator('ruby').count(), 0);
  assert.equal(
    /[\u3040-\u9fff]/u.test((await dialog.textContent()) || ''),
    false,
  );
  await page.keyboard.press('Escape');
  // Finished cases continue to show every related statement.
  for (const [i, culprit] of fixture.puzzle.answer.entries()) {
    if (culprit) await page.locator(`#person-${i} [data-judge]`).click();
  }
  await page.locator('#result-dialog').waitFor({ state: 'visible' });
  await page.locator('[data-close="result-dialog"]').first().click();
  await page.locator(`[data-related="${selected}"]`).click();
  assert.equal(await dialog.locator('.unheard-label').count(), 0);
  assert.equal(await dialog.locator('[data-related-reveal]').count(), 0);
  assert.equal(
    await dialog.locator('.statement').count(),
    await dialog.locator('.related-entry').count(),
  );
  await checkRelatedIcons(page);
  assert.deepEqual(errors, []);
  await page.close();
}

async function checkActionLayout(page: Page) {
  for (const width of [320, 390, 760, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const buttons = await page
      .locator('.suspect .actions')
      .evaluateAll((rows) =>
        rows.map((row) => {
          const judge = row.querySelector('.judge')!.getBoundingClientRect();
          const related = row
            .querySelector('.related-button')!
            .getBoundingClientRect();
          const content = row
            .closest('.person-content')!
            .getBoundingClientRect();
          return {
            judgeHeight: judge.height,
            relatedHeight: related.height,
            withinContent: [judge, related].every(
              (button) =>
                button.left >= content.left && button.right <= content.right,
            ),
            sameRow: Math.abs(judge.top - related.top) < 1,
          };
        }),
      );
    for (const pair of buttons) {
      assert.equal(pair.judgeHeight, 44);
      assert.equal(pair.relatedHeight, 44);
      assert.ok(
        pair.withinContent,
        `action buttons stay within the text column at ${width}px`,
      );
      if ((await page.locator('html').getAttribute('lang')) === 'ja')
        assert.ok(pair.sameRow, `action buttons share a row at ${width}px`);
    }
  }
}

async function checkRelatedIcons(page: Page) {
  const icons = await page
    .locator('.related-witness .animal-status-icon')
    .evaluateAll((elements) =>
      elements.map((icon) => {
        const entry = icon.closest('.related-entry')!;
        const i = (entry.querySelector('[data-related-person]') as HTMLElement)
          .dataset.relatedPerson;
        const nav = document.querySelector(`[data-person="${i}"]`)!;
        const appearance = (element: Element) => {
          const style = getComputedStyle(element);
          return {
            border: style.borderTopColor,
            background: style.backgroundColor,
            portrait: element
              .querySelector('svg')!
              .outerHTML.replace(/jail-bar-\d+/g, 'jail-bar'),
          };
        };
        return { actual: appearance(icon), expected: appearance(nav) };
      }),
    );
  for (const icon of icons)
    assert.deepEqual(
      icon.actual,
      icon.expected,
      'dialog icons match the navigation marker, background, and expression',
    );
}
