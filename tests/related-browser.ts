import type { Browser, Locator, Page } from 'playwright';
import assert = require('node:assert/strict');
import { pathToFileURL } from 'node:url';
import path = require('node:path');

async function baseText(locator: Locator) {
  return locator.evaluate(element => {
    const copy = element.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('rt').forEach(rt => rt.remove());
    return copy.textContent?.trim() ?? '';
  });
}

export async function checkRelatedTestimony(browser: Browser) {
  const page = await browser.newPage({ locale: 'ja-JP', reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '../../index.html')).href);
  await page.locator('#start-game').click();
  await page.locator('#confirm-new').click();
  const fixture = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('beast-detective-v1')!) as GameState;
    let seed = 0;
    let puzzle = window.DetectiveEngine.generate(seed, 'hard', 5);
    while (!puzzle.testimonyCosts.includes(1) || !puzzle.testimonyCosts.includes(2)) {
      puzzle = window.DetectiveEngine.generate(++seed, 'hard', 5);
    }
    Object.assign(saved, { puzzle, startingTrust: 1, trust: 1, status: 'playing',
      revealed: puzzle.people.map(() => false), resolved: puzzle.people.map(() => null),
      notes: puzzle.people.map(() => ''), markers: puzzle.people.map(() => 3) });
    localStorage.setItem('beast-detective-v1', JSON.stringify(saved));
    return { puzzle, texts: puzzle.statements.map(s => window.DetectiveEngine.statementText(s, puzzle.people)) };
  });
  await page.reload();
  await checkActionLayout(page);
  const dialog = page.locator('#related-dialog');
  for (let selected = 0; selected < fixture.puzzle.people.length; selected++) {
    const expected = [selected, ...fixture.puzzle.statements.flatMap((s, i) => i !== selected && s.targets.includes(selected) ? [i] : [])];
    const opener = page.locator(`[data-related="${selected}"]`);
    assert.equal(await baseText(opener), '関連する証言');
    await opener.click();
    assert.deepEqual(await page.locator('[data-related-person]').evaluateAll(buttons => buttons.map(b => Number((b as HTMLElement).dataset.relatedPerson))), expected);
    assert.equal(await dialog.locator('.statement').count(), 0, 'unheard testimony is hidden');
    assert.equal(await dialog.locator('.unheard-label').count(), expected.length);
    for (const marker of await dialog.locator('.witness-marker').all()) {
      assert.equal(await baseText(marker), '');
      assert.equal(await marker.getAttribute('aria-label'), '要検討');
    }
    await page.keyboard.press('Escape');
    await opener.waitFor({ state: 'visible' });
    assert.equal(await opener.evaluate(button => button === document.activeElement), true);
  }
  const paid = fixture.puzzle.testimonyCosts.indexOf(1);
  await page.locator(`[data-related="${paid}"]`).click();
  await page.locator(`[data-related-reveal="${paid}"]`).click();
  assert.equal(await baseText(page.locator(`#related-statement-${paid} .statement`)), fixture.texts[paid]);
  assert.equal(await baseText(page.locator(`#statement-${paid} .statement`)), fixture.texts[paid]);
  assert.equal(await page.locator('#trust').getAttribute('aria-label'), '残り捜査資金 0');
  assert.equal(await page.locator(`#related-statement-${paid}`).evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Escape');
  await page.locator(`[data-related="${paid}"]`).click();
  assert.equal(await page.locator(`[data-related-reveal="${paid}"]`).count(), 0, 'heard testimony never charges again');
  await page.locator(`[data-related-person="${paid}"]`).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.locator(`#person-${paid}`).evaluate(element => element === document.activeElement), true);
  await page.reload();
  assert.equal(await page.locator('#trust').getAttribute('aria-label'), '残り捜査資金 0');
  const expensive = fixture.puzzle.testimonyCosts.indexOf(2);
  await page.locator(`[data-related="${expensive}"]`).click();
  assert.ok(await page.locator(`[data-related-reveal="${expensive}"]`).isDisabled());
  await page.keyboard.press('Escape');
  const free = fixture.puzzle.testimonyCosts.indexOf(0);
  // Open a target of a free statement, to check highlighting in another animal's testimony.
  const selected = fixture.puzzle.statements[free].targets.find(i => i !== free)!;
  await page.locator(`[data-related="${selected}"]`).click();
  await page.locator(`[data-related-reveal="${free}"]`).click();
  assert.equal(await baseText(page.locator(`#related-statement-${free} .statement`)), fixture.texts[free]);
  assert.ok(await page.locator(`#related-statement-${free} .selected-animal`).count() > 0);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const box = await dialog.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 844);
    assert.ok(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth), 'dialog has no horizontal overflow');
    if (width === 390) await page.screenshot({ path: '/tmp/detective-related-mobile.png' });
  }
  const missingReadings = await dialog.evaluate(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const missing: string[] = [];
    while (walker.nextNode()) {
      if (!walker.currentNode.parentElement?.closest('ruby, svg') && /[一-龯々]/.test(walker.currentNode.textContent || '')) missing.push(walker.currentNode.textContent || '');
    }
    return missing;
  });
  assert.deepEqual(missingReadings, []);
  await page.keyboard.press('Escape');
  await page.locator('#menu-toggle').click();
  await page.locator('#language-select').selectOption('en');
  await checkActionLayout(page);
  await page.locator(`[data-related="${selected}"]`).click();
  assert.ok((await dialog.locator('h2').textContent())?.startsWith('Testimony related to '));
  assert.equal(await baseText(page.locator('#own-testimony-heading')), 'Own testimony');
  assert.equal(await dialog.locator('ruby').count(), 0);
  assert.equal(/[\u3040-\u9fff]/u.test(await dialog.textContent() || ''), false);
  await page.keyboard.press('Escape');
  // Finished cases expose every related statement without requiring payment.
  for (const [i, culprit] of fixture.puzzle.answer.entries()) {
    if (culprit) await page.locator(`#person-${i} [data-judge]`).click();
  }
  await page.locator('#result-dialog').waitFor({ state: 'visible' });
  await page.locator('[data-close="result-dialog"]').first().click();
  await page.locator(`[data-related="${selected}"]`).click();
  assert.equal(await dialog.locator('.unheard-label').count(), 0);
  assert.equal(await dialog.locator('[data-related-reveal]').count(), 0);
  assert.equal(await dialog.locator('.statement').count(), await dialog.locator('.related-entry').count());
  assert.deepEqual(errors, []);
  await page.close();
}

async function checkActionLayout(page: Page) {
  for (const width of [320, 390, 760, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const buttons = await page.locator('.suspect .actions').evaluateAll(rows => rows.map(row => {
      const judge = row.querySelector('.judge')!.getBoundingClientRect();
      const related = row.querySelector('.related-button')!.getBoundingClientRect();
      const content = row.closest('.person-content')!.getBoundingClientRect();
      return { judgeHeight: judge.height, relatedHeight: related.height,
        withinContent: [judge, related].every(button => button.left >= content.left && button.right <= content.right),
        sameRow: Math.abs(judge.top - related.top) < 1 };
    }));
    for (const pair of buttons) {
      assert.equal(pair.judgeHeight, 44);
      assert.equal(pair.relatedHeight, 44);
      assert.ok(pair.withinContent, `action buttons stay within the text column at ${width}px`);
      if (await page.locator('html').getAttribute('lang') === 'ja') assert.ok(pair.sameRow, `action buttons share a row at ${width}px`);
    }
  }
}
