(function () {
  'use strict';
  const tr = DetectiveI18n.text;
  const E = window.DetectiveEngine;
  function $<T extends HTMLElement = HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing element: ${id}`);
    return element as T;
  }
  const key = 'beast-detective-v1';
  const saveVersion = 13;
  const markers = [{ get name() { return tr('未設定'); }, color: '#d4d7ca' }, { get name() { return tr('犯人候補'); }, color: '#b96d58' }, { get name() { return tr('善人候補'); }, color: '#749476' }, { get name() { return tr('要検討'); }, color: '#c4a359' }, { get name() { return tr('勘違い候補'); }, color: '#9481bb' }];
  const preferencesKey = 'animal-detective-preferences-v1';
  const browserLanguage = navigator.languages.map(language => language.toLowerCase().split('-')[0])
    .find(language => language === 'ja' || language === 'en');
  const preferences: { ruby: boolean; sound: boolean; language: 'ja' | 'en' } = { ruby: true, sound: true, language: browserLanguage === 'en' ? 'en' : 'ja' };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(preferencesKey) || 'null');
    if (!saved || typeof saved !== 'object') throw new Error('Invalid preferences');
    const values = saved as Record<string, unknown>;
    for (const name of ['ruby', 'sound'] as const) {
      if (typeof values[name] === 'boolean') preferences[name] = values[name];
    }
    if (values.language === 'ja' || values.language === 'en') preferences.language = values.language;
  } catch { /* Settings still work when storage is unavailable. */ }
  DetectiveI18n.setLanguage(preferences.language);
  DetectiveI18n.localizePage();
  $<HTMLSelectElement>('language-select').value = preferences.language;
  $('ruby-toggle').hidden = preferences.language === 'en';
  function savePreferences() {
    try { localStorage.setItem(preferencesKey, JSON.stringify(preferences)); } catch { /* Optional persistence. */ }
  }
  function applyRubyPreference() {
    document.documentElement.classList.toggle('ruby-off', !preferences.ruby);
    $('ruby-toggle').setAttribute('aria-pressed', String(preferences.ruby));
    $('ruby-toggle').querySelector('[data-toggle-status]')!.textContent = preferences.ruby ? 'ON' : 'OFF';
  }
  applyRubyPreference();
  $('ruby-toggle').addEventListener('click', () => {
    preferences.ruby = !preferences.ruby;
    applyRubyPreference();
    savePreferences();
  });
  function applySoundPreference() {
    $('sound-toggle').setAttribute('aria-pressed', String(preferences.sound));
    $('sound-toggle').querySelector('[data-toggle-status]')!.textContent = preferences.sound ? 'ON' : 'OFF';
  }
  applySoundPreference();
  $('sound-toggle').addEventListener('click', () => {
    preferences.sound = !preferences.sound;
    applySoundPreference();
    if (!preferences.sound) judgmentSound.stop();
    savePreferences();
  });
  let state: GameState; let hasGame = false; let storageAvailable = true;
  const debugMoneyParam = new URLSearchParams(location.search).get('debugMoney');
  let debugMoney = debugMoneyParam !== null && /^-?\d+$/.test(debugMoneyParam) && Math.abs(Number(debugMoneyParam)) <= 1_000_000_000
    ? Number(debugMoneyParam) : null;
  function applyDebugMoney() {
    if (debugMoney === null) return;
    const solved = state.puzzle.answer.every((liar, i) => !liar || state.resolved[i] !== null);
    state.status = debugMoney < 0 ? 'lost' : solved ? 'won' : 'playing';
    // Retain the original starting funds so ordinary save validation still applies.
    state.debugMoneyAdjustment = (state.debugMoneyAdjustment ?? 0) + debugMoney - state.trust;
    state.trust = debugMoney;
    debugMoney = null;
  }
  function fresh(level: Level, round = 1, trust = E.initialTrust, previousStories: readonly number[] = [], previousMistakes = 0): GameState {
    const seed = window.crypto ? crypto.getRandomValues(new Uint32Array(1))[0] : Date.now() >>> 0;
    const puzzle = E.generate(seed, level, round);
    const storyHistory = [...previousStories, E.selectStory(seed, previousStories)];
    return { version: saveVersion, puzzle, storyHistory, previousMistakes, startingTrust: trust, trust, status: 'playing', resolved: puzzle.people.map(() => null), notes: puzzle.people.map(() => ''), markers: puzzle.people.map(() => 0), revealed: puzzle.people.map(() => false) };
  }
  function restore(): GameState | null {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(key) || 'null');
      if (!raw || typeof raw !== 'object') return null;
      const saved = raw as Record<string, unknown>;
      const debugMoneyAdjustment = saved.debugMoneyAdjustment ?? 0;
      if (!Number.isSafeInteger(debugMoneyAdjustment) || Math.abs(debugMoneyAdjustment as number) > 1_000_000_000_000) return null;
      const storedPuzzle = saved.puzzle as Partial<Puzzle> | undefined;
      if (saved.version !== saveVersion || !storedPuzzle ||
        !Object.hasOwnProperty.call(E.levels, storedPuzzle.level || '') ||
        !Number.isInteger(storedPuzzle.seed) ||
        !Number.isInteger(storedPuzzle.round) || storedPuzzle.round! < 1 || storedPuzzle.round! > E.totalCases(storedPuzzle.level!) ||
        !Number.isInteger(saved.startingTrust) || (saved.startingTrust as number) < 0 ||
        (storedPuzzle.round === 1 && saved.startingTrust !== E.initialTrust)) return null;
      const puzzle = E.generate(storedPuzzle.seed!, storedPuzzle.level, storedPuzzle.round);
      // Older saves only retain the current story; preserve it when upgrading.
      const storyHistory = saved.storyHistory ?? [puzzle.seed % E.caseStories.length];
      if (!Array.isArray(storyHistory) || storyHistory.length < 1 || storyHistory.length > puzzle.round ||
        !storyHistory.every((id: unknown): id is number => typeof id === 'number' && Number.isInteger(id) && id >= 0 && id < E.caseStories.length) ||
        new Set(storyHistory).size !== storyHistory.length) return null;
      const previousMistakes = saved.previousMistakes;
      if (!Number.isSafeInteger(previousMistakes) || (previousMistakes as number) < 0 ||
        (puzzle.round === 1 && previousMistakes !== 0)) return null;
      const n = puzzle.people.length;
      const { resolved, notes, markers, revealed } = saved;
      if (!Array.isArray(resolved) || !Array.isArray(notes) || !Array.isArray(markers) ||
        ![resolved, notes, markers].every(a => a.length === n)) return null;
      if (!notes.every((v: unknown): v is string => typeof v === 'string' && v.length <= 1000) ||
        !markers.every((v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 4)) return null;
      if (!resolved.every((r: unknown, i): r is Resolution | null => r === null ||
        (typeof r === 'object' && 'guess' in r && 'correct' in r && r.guess === true && r.correct === puzzle.answer[i] &&
          ('reward' in r && (r.correct ? r.reward === 0 || r.reward === 1 : r.reward === -2))))) return null;
      if (!Array.isArray(revealed) || revealed.length !== n || !revealed.every(v => typeof v === 'boolean')) return null;
      const testimonySpent = revealed.reduce((sum, heard, i) => sum + (heard ? puzzle.testimonyCosts[i] : 0), 0);
      const trust = (saved.startingTrust as number) + (debugMoneyAdjustment as number) + resolved.reduce((sum, r) => sum + (r ? r.reward! : 0), 0) - testimonySpent;
      const solved = puzzle.answer.every((liar, i) => !liar || resolved[i] !== null);
      const finalTrust = trust + (solved ? E.caseReward(resolved) : 0);
      const status = finalTrust < 0 ? 'lost' : solved ? 'won' : 'playing';
      if (saved.trust !== finalTrust || saved.status !== status) return null;
      return { version: saveVersion, puzzle, storyHistory, previousMistakes: previousMistakes as number, startingTrust: saved.startingTrust as number, debugMoneyAdjustment: debugMoneyAdjustment as number, trust: finalTrust, status, resolved, notes, markers, revealed };
    } catch { return null; }
  }
  function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); storageAvailable = true; }
    catch { storageAvailable = false; }
    updateSaveStatus();
    addReadings();
  }
  function updateSaveStatus() {
    $('save-status').hidden = storageAvailable;
    $('save-status').textContent = storageAvailable ? '' : tr('この環境では保存できません（現在の画面では遊べます）');
  }
  function portraitStateFor(i: number) {
    return state.resolved[i] ? (state.puzzle.answer[i] ? 'liar' : 'sad') : state.status === 'won' ? 'good' : 'neutral';
  }
  function withAnimalIcons(text: string, highlighted?: number) {
    const people = state.puzzle.people;
    const names = people.map(person => person.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return text.replace(new RegExp(`(\\d+\\.\\s*)?(${names.join('|')})`, 'g'), (_match, number: string | undefined, name: string) => {
      const person = people.find(person => person.name === name)!;
      const i = people.indexOf(person);
      return `<span class="animal-mention${i === highlighted ? ' selected-animal' : ''}">${portrait(person.id, 'inline-portrait')}${number ?? ''}${name}</span>`;
    });
  }
  function statusIcon(i: number) {
    const marker = markers[state.markers[i]];
    return `<span class="animal-status-icon" role="img" aria-label="${marker.name}" title="${marker.name}" style="--marker-color:${marker.color}">${portrait(state.puzzle.people[i].id, '', portraitStateFor(i))}</span>`;
  }
  let relatedAnimal: number | null = null;
  function relatedWitnesses(index: number) {
    return state.puzzle.statements.flatMap((statement, i) => i !== index && statement.targets.includes(index) ? [i] : []);
  }
  function renderRelatedDialog() {
    if (relatedAnimal === null) return;
    const selected = relatedAnimal;
    const person = state.puzzle.people[selected];
    $('related-dialog-title').textContent = tr`${person.name}に関連する証言`;
    $('related-funds').textContent = tr`残り捜査資金 ${`🪙${state.trust}`}`;
    function entry(i: number) {
      const witness = state.puzzle.people[i];
      const heard = state.revealed[i] || state.status !== 'playing';
      const cost = state.puzzle.testimonyCosts[i];
      const statement = heard
        ? `<p class="statement">${withAnimalIcons(E.statementText(state.puzzle.statements[i], state.puzzle.people), selected)}</p>`
        : `<button type="button" class="quiet-button" data-related-reveal="${i}" aria-controls="related-statement-${i}" ${state.trust < cost ? 'disabled' : ''}>💬 ${tr('証言を聞く')}${cost ? tr`（🪙${cost}使用）` : ''}</button>${cost && state.trust < cost ? tr`<p class="testimony-cost-note">捜査資金が${cost}未満のときは聞けません。</p>` : ''}`;
      return `<article class="related-entry" aria-labelledby="related-witness-${i}"><div class="related-witness">${statusIcon(i)}<h4 id="related-witness-${i}">${i + 1}. ${witness.name}</h4><button type="button" class="related-card-link" data-related-person="${i}">${tr('元のカードへ')}</button></div><div id="related-statement-${i}" tabindex="-1">${statement}</div>${state.notes[i] ? `<div class="related-memo"><span class="memo-label">MEMO</span><p data-related-note="${i}"></p></div>` : ''}</article>`;
    }
    const scrollTop = $('related-dialog').scrollTop;
    $('related-content').innerHTML = `<section aria-labelledby="own-testimony-heading"><h3 id="own-testimony-heading">${tr('本人の証言')}</h3>${entry(selected)}</section><section aria-labelledby="other-testimony-heading"><h3 id="other-testimony-heading">${tr`${person.name}についての証言`}</h3>${relatedWitnesses(selected).map(entry).join('') || `<p>${tr('この動物についての証言はありません。')}</p>`}</section>`;
    $('related-content').querySelectorAll<HTMLElement>('[data-related-note]').forEach(note => {
      note.textContent = state.notes[Number(note.dataset.relatedNote)];
    });
    addReadings($('related-dialog'));
    $('related-dialog').scrollTop = scrollTop;
  }
  function renderCard(person: Person, i: number) {
    const resolved = state.resolved[i]; const ended = state.status !== 'playing'; const liar = state.puzzle.answer[i];
    const portraitState = portraitStateFor(i);
    const cost = state.puzzle.testimonyCosts[i];
    const sortedTargets = [...state.puzzle.statements[i].targets].sort((a, b) => a - b);
    const targets = sortedTargets.map(t => `${t + 1}. ${state.puzzle.people[t].name}`).join(tr('、'));
    const testimonyHint = state.revealed[i] || ended ? '' : tr`<p class="testimony-targets">${withAnimalIcons(targets)}についての証言が聞けそうだ</p>`;
    let actions;
    const identity = `<strong class="identity-${liar ? 'liar' : 'good'}">${E.identity(state.puzzle, i).replace(tr('勘違いしている'), tr('<span class="mistaken-emphasis">勘違い</span><span class="identity-connector">している</span>'))}</strong>`;
    if (resolved) actions = tr`<span class="resolved-tag ${resolved.correct ? '' : 'wrong'}">${resolved.correct ? tr('✅ 正解') : tr('❌ 誤判定')} · ${person.name}は${identity}</span>`;
    else if (state.status === 'won') actions = tr`<span class="resolved-tag revealed">✓ ${identity}と確定 · ${person.name}は${identity}</span>`;
    else if (ended) actions = tr`<span class="resolved-tag unjudged">未判定 · 真相：${identity}</span>`;
    else actions = tr`<button class="judge liar" data-judge="liar" data-index="${i}" aria-label="${person.name}を犯人と判定"><span class="judge-icon" aria-hidden="true">😈</span><span>犯人と判定</span></button>`;
    actions += `<button type="button" class="quiet-button related-button" data-related="${i}" aria-haspopup="dialog" aria-controls="related-dialog">🔎 ${tr('関連する証言')}</button>`;
    const truth = ended ? tr`<details class="truth-detail"><summary>真相と証言の照合：この証言は${liar ? tr('嘘') : state.puzzle.mistaken === i ? tr('勘違い（間違い）') : tr('本当')}</summary><p>${sortedTargets.map(t => tr`${state.puzzle.people[t].name}＝${E.identity(state.puzzle, t)}`).join(tr(' ／ '))}</p><p>この組み合わせでは、上の証言は${E.evaluate(state.puzzle.statements[i], state.puzzle.answer) ? tr('正しい') : tr('間違っています')}。${person.name}が${E.identity(state.puzzle, i)}という真相と一致します。</p></details>` : '';
    return tr`<article class="suspect" data-marker="${state.markers[i]}" id="person-${i}" aria-labelledby="name-${i}"><div class="card-main"><div class="portrait-box"><span class="person-number">${String(i + 1).padStart(2, '0')}</span>${portrait(person.id, '', portraitState)}</div><div class="person-content"><div class="person-heading"><h3 id="name-${i}">${i + 1}. ${person.name}</h3><details class="role-details"><summary>証言ルール</summary><p>${person.rule}</p></details></div>${testimonyHint}<div id="statement-${i}">${state.revealed[i] || ended ? `<p class="statement">${withAnimalIcons(E.statementText(state.puzzle.statements[i], state.puzzle.people))}</p>` : tr`<button class="reveal-button quiet-button" data-reveal="${i}" aria-controls="statement-${i}" ${state.trust < cost ? 'disabled' : ''}>💬 ${tr('証言を聞く')}${cost ? tr`（🪙${cost}使用）` : ''}</button>${cost && state.trust < cost ? tr`<p class="testimony-cost-note">捜査資金が${cost}未満のときは聞けません。</p>` : ''}`}</div><div class="actions">${actions}</div></div></div><div class="memo-row"><div class="marker-group" role="group" aria-label="${person.name}のマーカー">${markers.map((m, j) => tr`<button class="marker-button" style="--dot:${m.color}" data-marker-value="${j}" data-index="${i}" aria-label="${person.name}：${m.name}" title="${m.name}" aria-pressed="${state.markers[i] === j}"></button>`).join('')}</div><label class="memo-label" for="memo-${i}">MEMO</label><textarea id="memo-${i}" data-note="${i}" aria-label="${person.name}の捜査メモ" maxlength="1000" rows="1" placeholder="きになることをメモ…"></textarea></div>${truth}</article>`;
  }
  let resultPendingDialog = false;
  function render(message?: string, persist = true) {
    applyDebugMoney();
    hasGame = true;
    $('home-page').hidden = true;
    $('game-page').hidden = false;
    $('new-case').hidden = false;
    const p = state.puzzle; const count = state.resolved.filter((r, i) => r !== null && p.answer[i]).length;
    const mistakes = state.resolved.filter(r => r && !r.correct).length;
    const story = E.caseStories[state.storyHistory[state.storyHistory.length - 1]];
    $('campaign-progress').textContent = tr`事件 ${p.round} / ${E.totalCases(p.level)}`;
    $('campaign-steps').innerHTML = Array.from({ length: E.totalCases(p.level) }, (_, i) => {
      const round = i + 1;
      const completed = round < p.round || (round === p.round && state.status === 'won');
      const current = round === p.round;
      const label = completed ? tr('解決済み') : current ? tr('今回の捜査') : tr('これから');
      return tr`<li class="campaign-step${completed ? ' completed' : ''}${current ? ' current' : ''}"${current ? ' aria-current="step"' : ''} aria-label="捜査 ${round}：${label}"><span aria-hidden="true">${completed ? '✓' : current ? round : ''}</span></li>`;
    }).join('');
    $('case-title').textContent = story.title;
    $('case-description').textContent = story.description;
    $<HTMLImageElement>('case-illustration').src = `assets/cases/${story.illustration}.png`;
    document.title = tr`${story.title} — どうぶつ探偵`;
    $('liar-count').textContent = tr`犯人 ${p.k}匹`;
    $('good-count').textContent = tr`善人 ${p.people.length - p.k}匹`;
    $('mistaken-count').hidden = p.mistakenCount === 0;
    $('mistaken-count').innerHTML = tr`（うち<strong class="mistaken-emphasis">勘違い</strong>している<strong class="identity-good">善人</strong>${p.mistakenCount === 1 ? tr('１') : tr('０')}匹）`;
    $('mistaken-rule').hidden = p.mistakenCount === 0;
    $('mistaken-rule').textContent = tr('この事件には、勘違いしている善人がいます。証言は必ず間違っていますが、犯人ではありません。\n「同じ立場」や犯人の数では善人として扱います。');
    $('progress-count').textContent = `${count} / ${p.k}`;
    $('trust-value').textContent = String(state.trust);
    $('trust').setAttribute('aria-label', tr`残り捜査資金 ${state.trust}`);
    $('suspects').innerHTML = p.people.map(renderCard).join('');
    $('testimony-nav').innerHTML = p.people.map((person, i) => tr`<button type="button" class="testimony-link" data-person="${i}" style="--marker-color:${markers[state.markers[i]].color}" aria-label="${person.name}の証言へ移動（${markers[state.markers[i]].name}）" title="${person.name}：${markers[state.markers[i]].name}">${portrait(person.id, '', portraitStateFor(i))}</button>`).join('');
    state.notes.forEach((v, i) => { $<HTMLTextAreaElement>(`memo-${i}`).value = v; });
    $('feedback').textContent = message || tr('「証言を聞く」をタップして、証言を読み比べましょう。');
    if (state.status === 'playing') resultPendingDialog = false;
    const result = $('result'); result.hidden = state.status === 'playing' || resultPendingDialog;
    if (state.status === 'playing') result.replaceChildren();
    if (state.status !== 'playing') {
      const won = state.status === 'won';
      const cleared = won && p.round === E.totalCases(p.level);
      const nextLabel = won && !cleared ? tr('次の事件へ') : tr('もう一度挑戦');
      $('dialog-next-case').textContent = nextLabel;
      result.className = `result ${won ? '' : 'lost'}`;
      const stamp = won ? '<span class="case-closed-stamp-layer" aria-hidden="true"><img class="case-closed-stamp" src="assets/case-closed.png" alt="" width="1280" height="1280"></span>' : '';
      const totalMistakes = state.previousMistakes + mistakes;
      const heading = cleared ? tr('すべての事件を解決！') : won ? tr`事件解決！ (${p.round} / ${E.totalCases(p.level)})` : tr('今回の捜査は、ここまで');
      const description = cleared
        ? tr`<p>おめでとうございます！<br>あなたの推理で、全${E.totalCases(p.level)}件の事件が解決しました。<br>森の名探偵、おつかれさまでした！</p><table class="campaign-results" aria-label="全事件の結果"><tbody><tr><th scope="row">解決した事件</th><td>${E.totalCases(p.level)}件</td></tr><tr><th scope="row">全事件で間違えて犯人と判定した回数</th><td>${totalMistakes}回</td></tr><tr><th scope="row">残った捜査資金</th><td>${state.trust}</td></tr></tbody></table>${totalMistakes === 0 ? tr('<p><strong>一度も間違えずに、すべての事件を解決しました！🎉</strong></p>') : ''}`
        : `<p>${won ? tr`事件解決。捜査資金 ＋${E.caseReward(state.resolved)}。${mistakes === 0 ? tr('一度も間違えず、みんなの正体を見抜きました。') : tr`誤判定 ${mistakes}回で、みんなの正体が明らかになりました。`}` : tr('捜査資金がマイナスになりました。証言と真相を照らし合わせて、次の捜査に活かしましょう。')}</p>${won ? tr('<p>次の捜査へ進みましょう。</p>') : ''}`;
      result.innerHTML = tr`${stamp}<h2>${heading}</h2>${description}<p>各カードの「真相と証言の照合」で振り返れます。</p>${!won ? tr`<p>${p.round - 1} / ${E.totalCases(p.level)}の事件を解決しました。最初から挑戦できます。</p>` : ''}${won ? `<details class="case-ending"><summary>${cleared ? tr('最後の事件のその後') : tr('事件のその後')}</summary><p>${story.ending}</p></details>` : ''}<button class="primary-button" id="next-case">${nextLabel}</button>`;
      $('next-case').addEventListener('click', nextCase);
    }
    renderRelatedDialog();
    if (persist) save();
    else { updateSaveStatus(); addReadings(); }
  }
  let resultDialogTimer: ReturnType<typeof setTimeout> | undefined;
  let stampSoundTimer: ReturnType<typeof setTimeout> | undefined;
  function showResultDialog() {
    clearTimeout(stampSoundTimer);
    const content = $('result-dialog-content');
    const resultCopy = $('result').cloneNode(true) as HTMLElement;
    resultCopy.querySelector('#next-case')!.remove();
    resultCopy.querySelector('h2')!.id = 'result-dialog-title';
    content.replaceChildren(...resultCopy.childNodes);
    $('result-dialog').classList.toggle('lost', state.status === 'lost');
    $<HTMLDialogElement>('result-dialog').showModal();
    const stamp = content.querySelector<HTMLElement>('.case-closed-stamp');
    if (stamp) {
      const playStamp = () => {
        if (preferences.sound && $<HTMLDialogElement>('result-dialog').open) {
          void judgmentSound.stamp(state.puzzle.round === E.totalCases(state.puzzle.level));
        }
      };
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) playStamp();
      else stamp.addEventListener('animationstart', event => {
        if (event.animationName !== 'case-closed-press') return;
        // The stamp first hits the paper at 55% of its pressing animation.
        const duration = parseFloat(getComputedStyle(stamp).animationDuration) * 1000;
        stampSoundTimer = setTimeout(playStamp, duration * .55);
      }, { once: true });
    }
  }
  const caseIntro = $<HTMLDialogElement>('case-intro');
  let caseIntroTimer: ReturnType<typeof setTimeout>;
  function finishCaseIntro(animateCards = false) {
    clearTimeout(caseIntroTimer);
    if (!caseIntro.open) return;
    caseIntro.close();
    $('case-title').tabIndex = -1;
    $('case-title').focus({ preventScroll: true });
    if (animateCards && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      $('suspects').querySelectorAll<HTMLElement>('.suspect').forEach((card, index) => {
        card.animate([
          { opacity: 0, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 280, delay: index * 45, fill: 'backwards', easing: 'ease-out' });
      });
    }
  }
  function showCaseIntro() {
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    $('case-intro-number').textContent = tr`事件 ${state.puzzle.round}`;
    $('case-intro-title').textContent = E.caseStories[state.storyHistory[state.storyHistory.length - 1]].title;
    addReadings(caseIntro);
    caseIntro.showModal();
    caseIntroTimer = setTimeout(() => finishCaseIntro(true), 1400);
  }
  caseIntro.addEventListener('click', () => finishCaseIntro());
  caseIntro.addEventListener('cancel', event => {
    event.preventDefault();
    finishCaseIntro();
  });
  function nextCase() {
    clearTimeout(resultDialogTimer);
    if (state.status !== 'won' || state.puzzle.round === E.totalCases(state.puzzle.level)) { openNewCaseDialog(); return; }
    $<HTMLDialogElement>('result-dialog').close();
    judgmentSound.stop();
    state = fresh(state.puzzle.level, state.puzzle.round + 1, state.trust, state.storyHistory, state.previousMistakes + state.resolved.filter(r => r && !r.correct).length);
    $('feedback').className = 'feedback';
    render(tr('捜査資金を引き継いで、新しい事件の捜査を始めましょう。'));
    showCaseIntro();
  }
  $('dialog-next-case').addEventListener('click', nextCase);
  $('result-dialog').addEventListener('close', () => {
    clearTimeout(stampSoundTimer);
    judgmentSound.stop();
    resultPendingDialog = false;
    $('result').hidden = state.status === 'playing';
    if (hasGame && !$('game-page').hidden && state.status !== 'playing' && !$<HTMLDialogElement>('new-dialog').open) {
      $('result').scrollIntoView({ block: 'start', behavior: 'instant' });
      $('next-case').focus({ preventScroll: true });
    }
  });
  function openNewCaseDialog() {
    clearTimeout(resultDialogTimer);
    $<HTMLSelectElement>('difficulty').value = hasGame ? state.puzzle.level : 'normal';
    $('replace-case-note').hidden = !hasGame;
    $<HTMLDialogElement>('result-dialog').close();
    $<HTMLDialogElement>('new-dialog').showModal();
  }
  function startCase() {
    clearTimeout(resultDialogTimer);
    try {
      $<HTMLDialogElement>('result-dialog').close();
      judgmentSound.stop();
      state = fresh($<HTMLSelectElement>('difficulty').value as Level);
      $('feedback').className = 'feedback';
      render(tr('新しい事件が届きました。みんなの証言が、捜査の手がかりです。'));
      showCaseIntro();
    } catch (err) { $('feedback').textContent = err instanceof Error ? err.message : String(err); addReadings($('feedback')); }
  }
  // Keep keyboard/scrollIntoView targets below the pinned summary, including with ruby enabled.
  const summary = document.querySelector<HTMLElement>('.case-status')!;
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--summary-height', `${summary.getBoundingClientRect().height}px`);
  }).observe(summary);
  const menu = document.querySelector<HTMLElement>('.masthead')!;
  const menuToggle = $('menu-toggle');
  const gameMenu = $('game-menu');
  function setMenuOpen(open: boolean) {
    menuToggle.setAttribute('aria-expanded', String(open));
    gameMenu.hidden = !open;
  }
  menuToggle.addEventListener('click', () => setMenuOpen(gameMenu.hidden));
  document.addEventListener('click', event => {
    if (!menu.contains(event.target as Node)) setMenuOpen(false);
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !gameMenu.hidden) {
      setMenuOpen(false);
      menuToggle.focus({ preventScroll: true });
    }
  });
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--menu-height', `${menu.getBoundingClientRect().height}px`);
  }).observe(menu);
  function showHome() {
    judgmentSound.stop();
    setMenuOpen(false);
    $('home-page').hidden = false;
    $('game-page').hidden = true;
    $('new-case').hidden = true;
    $('continue-game').hidden = !hasGame;
    if (!hasGame) {
      $('suspects').replaceChildren();
      $('testimony-nav').replaceChildren();
    }
    document.title = tr('どうぶつ探偵');
    addReadings();
  }
  const restored = restore();
  if (restored) {
    state = restored;
    $<HTMLSelectElement>('difficulty').value = state.puzzle.level;
    render();
  }
  showHome();
  $('start-game').addEventListener('click', openNewCaseDialog);
  $('continue-game').addEventListener('click', () => {
    if (!hasGame) return;
    render(undefined, false);
    $('case-title').tabIndex = -1;
    $('case-title').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  document.querySelector<HTMLAnchorElement>('.brand')!.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    showHome();
    $('start-game').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  let testimonyHighlight: Animation | undefined;
  $('testimony-nav').addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-person]');
    if (!button) return;
    focusPerson(Number(button.dataset.person));
  });
  function focusPerson(index: number) {
    const card = $(`person-${index}`);
    card.tabIndex = -1;
    card.focus({ preventScroll: true });
    card.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    testimonyHighlight?.cancel();
    testimonyHighlight = card.animate([
      { boxShadow: '0 0 0 3px #83c991', offset: 0 },
      { boxShadow: '0 0 0 3px #83c991', offset: 0.65 },
      { boxShadow: '0 0 0 3px transparent', offset: 1 },
    ], { duration: 1500, easing: 'ease-out' });
  }
  let feedbackHighlight: Animation | undefined;
  function animateJudgment(trustChange: number) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    feedbackHighlight?.cancel();
    feedbackHighlight = $('feedback').animate([
      { backgroundColor: '#e8dca7', boxShadow: '0 0 0 3px #b1945866' },
      { backgroundColor: 'transparent', boxShadow: '0 0 0 0 transparent' },
    ], { duration: reducedMotion ? 200 : 800, easing: 'ease-out' });
    if (!trustChange) return;
    const delta = document.createElement('span');
    delta.className = `trust-delta ${trustChange > 0 ? 'positive' : 'negative'}`;
    delta.textContent = `${trustChange > 0 ? '+' : ''}${trustChange}`;
    delta.setAttribute('aria-hidden', 'true');
    $('trust-value').append(delta);
    const animation = delta.animate([
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 1, transform: reducedMotion ? 'none' : 'translateY(-8px)', offset: 0.6 },
      { opacity: 0, transform: reducedMotion ? 'none' : 'translateY(-18px)' },
    ], { duration: 1100, easing: 'ease-out', fill: 'forwards' });
    animation.onfinish = () => delta.remove();
  }
  function hearTestimony(i: number) {
    const previousTrust = state.trust;
    if (!E.reveal(state, i)) return;
    if (preferences.sound) void judgmentSound.testimony();
    $('feedback').className = 'feedback';
    render(state.puzzle.testimonyCosts[i] ? tr`証言を聞きました。捜査資金 −${state.puzzle.testimonyCosts[i]}。` : undefined);
    if (state.trust !== previousTrust) animateJudgment(state.trust - previousTrust);
    const statement = $(relatedAnimal === null ? `statement-${i}` : `related-statement-${i}`);
    statement.tabIndex = -1;
    statement.focus({ preventScroll: true });
  }
  $('related-dialog').addEventListener('close', () => {
    const selected = relatedAnimal;
    relatedAnimal = null;
    $('related-content').replaceChildren();
    if (selected !== null) $('suspects').querySelector<HTMLButtonElement>(`[data-related="${selected}"]`)?.focus({ preventScroll: true });
  });
  $('related-content').addEventListener('click', event => {
    const target = event.target as Element;
    const reveal = target.closest<HTMLButtonElement>('[data-related-reveal]');
    if (reveal) hearTestimony(Number(reveal.dataset.relatedReveal));
    const link = target.closest<HTMLButtonElement>('[data-related-person]');
    if (link) {
      relatedAnimal = null;
      $<HTMLDialogElement>('related-dialog').close();
      focusPerson(Number(link.dataset.relatedPerson));
    }
  });
  $('suspects').addEventListener('click', event => {
    const related = (event.target as Element).closest<HTMLButtonElement>('[data-related]');
    if (related) {
      relatedAnimal = Number(related.dataset.related);
      renderRelatedDialog();
      $('related-dialog').scrollTop = 0;
      $<HTMLDialogElement>('related-dialog').showModal();
      return;
    }
    const reveal = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-reveal]');
    if (reveal) {
      hearTestimony(Number(reveal.dataset.reveal));
      return;
    }
    const judge = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-judge]');
    if (judge) {
      const i = Number(judge.dataset.index);
      const previousTrust = state.trust;
      const correct = E.judge(state, i);
      if (correct === null) return;
      resultPendingDialog = state.status !== 'playing';
      $('feedback').className = `feedback ${correct ? '' : 'error'}`;
      render(tr`${correct ? tr('✅ 正解です。捜査資金の増減はありません。') : tr('❌ 誤判定。捜査資金 −2。')}${state.puzzle.people[i].name}は${E.identity(state.puzzle, i)}でした。`);
      const judgedState = state;
      const gates = correct
        ? [...document.querySelectorAll(`#person-${i} .jail-gate, #testimony-nav [data-person="${i}"] .jail-gate`)]
        : [];
      gates.forEach(gate => gate.classList.add('jail-gate-waiting'));
      const finishJudgment = () => {
        if (state !== judgedState || (correct && !gates.some(gate => gate.isConnected))) return;
        gates.forEach(gate => {
          gate.classList.remove('jail-gate-waiting');
          gate.classList.add('jail-gate-closing');
        });
      };
      if (preferences.sound) void judgmentSound.play(correct, finishJudgment, state.status !== 'won');
      if (!preferences.sound || !correct) finishJudgment();
      animateJudgment(state.trust - previousTrust);
      if (state.status !== 'playing') {
        clearTimeout(resultDialogTimer);
        resultDialogTimer = setTimeout(() => {
          if (hasGame && state === judgedState && !$('game-page').hidden) showResultDialog();
        }, 1250);
        return;
      }
      // Restore keyboard focus after replacing the card list.
      const next = $('suspects').querySelector<HTMLElement>('[data-judge]') || $('next-case');
      if (next) next.focus({ preventScroll: true });
    }
    const marker = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-marker-value]');
    if (marker) {
      const i = Number(marker.dataset.index); state.markers[i] = Number(marker.dataset.markerValue);
      $(`person-${i}`).dataset.marker = String(state.markers[i]);
      const navLink = $('testimony-nav').querySelector<HTMLButtonElement>(`[data-person="${i}"]`)!;
      const selectedMarker = markers[state.markers[i]];
      const person = state.puzzle.people[i];
      navLink.style.setProperty('--marker-color', selectedMarker.color);
      navLink.setAttribute('aria-label', tr`${person.name}の証言へ移動（${selectedMarker.name}）`);
      navLink.title = tr`${person.name}：${selectedMarker.name}`;
      marker.parentElement!.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === marker)));
      save();
    }
  });
  $('suspects').addEventListener('input', event => {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement && target.matches('[data-note]')) { state.notes[Number(target.dataset.note)] = target.value; save(); }
  });
  function renderAnimals() {
    $('animals-list').innerHTML = E.roles.map(person => `<article class="animal-entry"><div>${portrait(person.id)}</div><div><h3>${person.name}</h3><p>${person.rule}</p></div></article>`).join('');
    addReadings($('animals-list'));
  }
  renderAnimals();
  $('language-select').addEventListener('change', () => {
    const language = $<HTMLSelectElement>('language-select').value;
    if (language !== 'ja' && language !== 'en') return;
    preferences.language = language;
    DetectiveI18n.setLanguage(language);
    DetectiveI18n.localizePage();
    $('ruby-toggle').hidden = language === 'en';
    savePreferences();
    const onHome = !$('home-page').hidden;
    if (hasGame) {
      render(undefined, false);
      $('case-intro-number').textContent = tr`事件 ${state.puzzle.round}`;
      $('case-intro-title').textContent = E.caseStories[state.storyHistory[state.storyHistory.length - 1]].title;
    }
    $('result-dialog-content').replaceChildren();
    if (onHome) showHome();
    renderAnimals();
    addReadings();
  });
  $('animals-button').addEventListener('click', () => $<HTMLDialogElement>('animals-dialog').showModal());
  $('help-button').addEventListener('click', () => $<HTMLDialogElement>('help-dialog').showModal());
  $('new-case').addEventListener('click', openNewCaseDialog);
  $('delete-save').addEventListener('click', () => {
    setMenuOpen(false);
    $('delete-save-error').hidden = true;
    $<HTMLDialogElement>('delete-save-dialog').showModal();
  });
  $('confirm-delete-save').addEventListener('click', () => {
    try { localStorage.removeItem(key); }
    catch { $('delete-save-error').hidden = false; return; }
    judgmentSound.stop();
    $<HTMLDialogElement>('result-dialog').close();
    hasGame = false;
    showHome();
    $<HTMLDialogElement>('delete-save-dialog').close();
    $('start-game').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  $('confirm-new').addEventListener('click', () => { $<HTMLDialogElement>('new-dialog').close(); startCase(); });
  document.querySelectorAll<HTMLElement>('[data-close]').forEach(b => b.addEventListener('click', () => $<HTMLDialogElement>(b.dataset.close!).close()));
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } }));
})();
