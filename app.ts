(function () {
  'use strict';
  const E = window.DetectiveEngine;
  function $<T extends HTMLElement = HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing element: ${id}`);
    return element as T;
  }
  const key = 'beast-detective-v1';
  const saveVersion = 8;
  const markers = [ { name: '未設定', color: '#d4d7ca' }, { name: '犯人候補', color: '#b96d58' }, { name: '善人候補', color: '#749476' }, { name: '要検討', color: '#c4a359' } ];
  const preferencesKey = 'animal-detective-preferences-v1';
  const preferences = { ruby: true, sound: true };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(preferencesKey) || 'null');
    if (!saved || typeof saved !== 'object') throw new Error('Invalid preferences');
    const values = saved as Record<string, unknown>;
    for (const name of Object.keys(preferences) as (keyof typeof preferences)[]) {
      if (typeof values[name] === 'boolean') preferences[name] = values[name];
    }
  } catch { /* Settings still work when storage is unavailable. */ }
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
  function fresh(level: Level, round = 1, trust = E.initialTrust): GameState {
    const seed = window.crypto ? crypto.getRandomValues(new Uint32Array(1))[0] : Date.now() >>> 0;
    const puzzle = E.generate(seed, level, round);
    return { version: saveVersion, puzzle, startingTrust: trust, trust, status: 'playing', resolved: puzzle.people.map(() => null), notes: puzzle.people.map(() => ''), markers: puzzle.people.map(() => 0), revealed: puzzle.people.map(() => false) };
  }
  function restore(): GameState | null {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(key) || 'null');
      if (!raw || typeof raw !== 'object') return null;
      const saved = raw as Record<string, unknown>;
      const storedPuzzle = saved.puzzle as Partial<Puzzle> | undefined;
      if (saved.version !== saveVersion || !storedPuzzle ||
          !Object.hasOwnProperty.call(E.levels, storedPuzzle.level || '') ||
          !Number.isInteger(storedPuzzle.seed) ||
          !Number.isInteger(storedPuzzle.round) || storedPuzzle.round! < 1 || storedPuzzle.round! > E.totalCases ||
          !Number.isInteger(saved.startingTrust) || (saved.startingTrust as number) < 1 ||
          (storedPuzzle.round === 1 && saved.startingTrust !== E.initialTrust)) return null;
      const puzzle = E.generate(storedPuzzle.seed!, storedPuzzle.level!, storedPuzzle.round!);
      const n = puzzle.people.length;
      const { resolved, notes, markers, revealed } = saved;
      if (!Array.isArray(resolved) || !Array.isArray(notes) || !Array.isArray(markers) ||
          ![resolved, notes, markers].every(a => a.length === n)) return null;
      if (!notes.every((v: unknown): v is string => typeof v === 'string' && v.length <= 1000) ||
          !markers.every((v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 3)) return null;
      if (!resolved.every((r: unknown, i): r is Resolution | null => r === null ||
          (typeof r === 'object' && 'guess' in r && 'correct' in r && r.guess === true && r.correct === puzzle.answer[i] &&
            ('reward' in r && (r.correct ? r.reward === 0 || r.reward === 1 : r.reward === -2))))) return null;
      const trust = Math.max(0, (saved.startingTrust as number) + resolved.reduce((sum, r) => sum + (r ? r.reward! : 0), 0));
      const status = trust === 0 ? 'lost' : puzzle.answer.every((liar, i) => !liar || resolved[i] !== null) ? 'won' : 'playing';
      const finalTrust = trust + (status === 'won' ? 1 : 0);
      if (saved.trust !== finalTrust || saved.status !== status) return null;
      if (!Array.isArray(revealed) || revealed.length !== n || !revealed.every(v => typeof v === 'boolean')) return null;
      return { version: saveVersion, puzzle, startingTrust: saved.startingTrust as number, trust: finalTrust, status, resolved, notes, markers, revealed };
    } catch { return null; }
  }
  function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); storageAvailable = true; }
    catch { storageAvailable = false; }
    $('save-status').textContent = storageAvailable ? '捜査状況は自動保存されます' : 'この環境では保存できません（現在の画面では遊べます）';
    addReadings();
  }
  function portraitStateFor(i: number) {
    return state.resolved[i] ? (state.puzzle.answer[i] ? 'liar' : 'sad') : state.status === 'won' ? 'good' : 'neutral';
  }
  function renderCard(person: Person, i: number) {
    const resolved = state.resolved[i]; const ended = state.status !== 'playing'; const liar = state.puzzle.answer[i];
    const portraitState = portraitStateFor(i);
    let actions;
    if (resolved) actions = `<span class="resolved-tag ${resolved.correct ? '' : 'wrong'}">${resolved.correct ? '✅ 正解' : '❌ 誤判定'} · ${person.name}は${liar ? '犯人' : '善人'}</span>`;
    else if (state.status === 'won') actions = `<span class="resolved-tag revealed">✓ 善人と確定 · ${person.name}は善人</span>`;
    else if (ended) actions = `<span class="resolved-tag revealed">未判定 · 真相：${liar ? '犯人' : '善人'}</span>`;
    else actions = `<button class="judge liar" data-judge="liar" data-index="${i}" aria-label="${person.name}を犯人と判定"><span class="judge-icon" aria-hidden="true">😈</span><span>犯人と判定</span></button>`;
    const truth = ended ? `<details class="truth-detail"><summary>真相と証言の照合：この証言は${liar ? '嘘' : '本当'}</summary><p>${state.puzzle.statements[i].targets.map(t => `${state.puzzle.people[t].name}＝${state.puzzle.answer[t] ? '犯人' : '善人'}`).join(' ／ ')}</p><p>この組み合わせでは、上の証言は${E.evaluate(state.puzzle.statements[i], state.puzzle.answer) ? '正しい' : '間違っています'}。${person.name}が${liar ? '犯人' : '善人'}という真相と一致します。</p></details>` : '';
    return `<article class="suspect" data-marker="${state.markers[i]}" id="person-${i}" aria-labelledby="name-${i}"><div class="card-main"><div class="portrait-box"><span class="person-number">${String(i + 1).padStart(2, '0')}</span>${portrait(person.id, '', portraitState)}</div><div class="person-content"><div class="person-heading"><h3 id="name-${i}">${i + 1}. ${person.name}</h3><span class="job">${person.job}</span><details class="role-details"><summary>証言ルール</summary><p>${person.rule}</p></details></div><div id="statement-${i}">${state.revealed[i] || ended ? `<p class="statement">${E.statementText(state.puzzle.statements[i], state.puzzle.people)}</p>` : `<button class="reveal-button quiet-button" data-reveal="${i}" aria-controls="statement-${i}">${person.name}の証言を聞く</button>`}</div><div class="actions">${actions}</div></div></div><div class="memo-row"><div class="marker-group" role="group" aria-label="${person.name}のマーカー">${markers.map((m, j) => `<button class="marker-button" style="--dot:${m.color}" data-marker-value="${j}" data-index="${i}" aria-label="${person.name}：${m.name}" title="${m.name}" aria-pressed="${state.markers[i] === j}"></button>`).join('')}</div><label class="memo-label" for="memo-${i}">MEMO</label><textarea id="memo-${i}" data-note="${i}" aria-label="${person.name}の捜査メモ" maxlength="1000" rows="1" placeholder="きになることをメモ…"></textarea></div>${truth}</article>`;
  }
  function render(message?: string, persist = true) {
    hasGame = true;
    $('home-page').hidden = true;
    $('game-page').hidden = false;
    $('new-case').hidden = false;
    const p = state.puzzle; const count = state.resolved.filter((r, i) => r !== null && p.answer[i]).length;
    const mistakes = state.resolved.filter(r => r && !r.correct).length;
    const story = E.caseStories[p.seed % E.caseStories.length];
    $('campaign-progress').textContent = `捜査 ${p.round} / ${E.totalCases}`;
    $('campaign-steps').innerHTML = Array.from({ length: E.totalCases }, (_, i) => {
      const round = i + 1;
      const completed = round < p.round || (round === p.round && state.status === 'won');
      const current = round === p.round;
      const label = completed ? '解決済み' : current ? '今回の捜査' : 'これから';
      return `<li class="campaign-step${completed ? ' completed' : ''}${current ? ' current' : ''}"${current ? ' aria-current="step"' : ''} aria-label="捜査 ${round}：${label}"><span aria-hidden="true">${completed ? '✓' : current ? round : ''}</span></li>`;
    }).join('');
    $('case-title').textContent = story.title;
    $('case-description').textContent = story.description;
    document.title = `${story.title} — どうぶつ探偵`;
    $('liar-count').textContent = `犯人 ${p.k}匹`;
    $('good-count').textContent = `善人 ${p.people.length - p.k}匹`;
    $('progress-count').textContent = `${count} / ${p.k}`;
    $('trust-value').textContent = String(state.trust);
    $('trust').setAttribute('aria-label', `残り信用 ${state.trust}`);
    $('suspects').innerHTML = p.people.map(renderCard).join('');
    $('testimony-nav').innerHTML = p.people.map((person, i) => `<button type="button" class="testimony-link" data-person="${i}" style="--marker-color:${markers[state.markers[i]].color}" aria-label="${person.name}の証言へ移動（${markers[state.markers[i]].name}）" title="${person.name}：${markers[state.markers[i]].name}">${portrait(person.id, '', portraitStateFor(i))}</button>`).join('');
    state.notes.forEach((v, i) => { $<HTMLTextAreaElement>(`memo-${i}`).value = v; });
    $('feedback').textContent = message || '「証言を聞く」をタップして、証言を読み比べましょう。';
    const result = $('result'); result.hidden = state.status === 'playing';
    if (!result.hidden) {
      const won = state.status === 'won';
      const cleared = won && p.round === E.totalCases;
      const nextLabel = won && !cleared ? '次の事件へ →' : 'もう一度挑戦 →';
      $('dialog-next-case').textContent = nextLabel;
      result.className = `result ${won ? '' : 'lost'}`;
      result.innerHTML = `<span class="eyebrow">${cleared ? 'ALL CASES CLOSED' : won ? 'CASE CLOSED' : 'INVESTIGATION ENDED'}</span><h2>${cleared ? '全5回の捜査完了！ ゲームクリア！' : won ? `捜査 ${p.round} / ${E.totalCases} 事件解決！` : '今回の捜査は、ここまで。'}</h2><p>${won ? `事件解決。信用 ＋1。${mistakes === 0 ? '一度も間違えず、みんなの正体を見抜きました。' : `誤判定 ${mistakes}回で、みんなの正体が明らかになりました。`}` : '信用がなくなりました。証言と真相を照らし合わせて、次の捜査に活かしましょう。'}</p><p>${won && !cleared ? '次の捜査へ進みましょう。' : cleared ? `信用 ${state.trust}を残して、すべての事件を解決しました。` : `${p.round - 1} / ${E.totalCases}の事件を解決しました。最初から挑戦できます。`}</p><p>各カードの「真相と証言の照合」で振り返れます。</p><button class="primary-button" id="next-case">${nextLabel}</button>`;
      $('next-case').addEventListener('click', nextCase);
    }
    if (persist) save();
    else addReadings();
  }
  function showResultDialog() {
    const content = $('result-dialog-content');
    const resultCopy = $('result').cloneNode(true) as HTMLElement;
    resultCopy.querySelector('#next-case')!.remove();
    resultCopy.querySelector('h2')!.id = 'result-dialog-title';
    content.replaceChildren(...resultCopy.childNodes);
    $('result-dialog').classList.toggle('lost', state.status === 'lost');
    $<HTMLDialogElement>('result-dialog').showModal();
  }
  function nextCase() {
    if (state.status !== 'won' || state.puzzle.round === E.totalCases) { openNewCaseDialog(); return; }
    $<HTMLDialogElement>('result-dialog').close();
    judgmentSound.stop();
    state = fresh(state.puzzle.level, state.puzzle.round + 1, state.trust);
    $('feedback').className = 'feedback';
    render('信用を引き継いで、新しい事件の捜査を始めましょう。');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $('dialog-next-case').addEventListener('click', nextCase);
  $('result-dialog').addEventListener('close', () => {
    if (hasGame && !$('game-page').hidden && state.status !== 'playing' && !$<HTMLDialogElement>('new-dialog').open) {
      $('result').scrollIntoView({ block: 'start', behavior: 'instant' });
      $('next-case').focus({ preventScroll: true });
    }
  });
  function openNewCaseDialog() {
    $<HTMLSelectElement>('difficulty').value = hasGame ? state.puzzle.level : 'normal';
    $('replace-case-note').hidden = !hasGame;
    $<HTMLDialogElement>('result-dialog').close();
    $<HTMLDialogElement>('new-dialog').showModal();
  }
  function startCase() {
    try {
      $<HTMLDialogElement>('result-dialog').close();
      judgmentSound.stop();
      state = fresh($<HTMLSelectElement>('difficulty').value as Level);
      $('feedback').className = 'feedback';
      render('新しい事件が届きました。みんなの証言が、捜査の手がかりです。');
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    document.title = 'どうぶつ探偵';
    addReadings();
  }
  const restored = restore();
  if (restored) {
    state = restored;
    $<HTMLSelectElement>('difficulty').value = state.puzzle.level;
    render(state.status !== 'playing' ? '前回の捜査結果を開きました。新しい事件にも挑戦できます。' : undefined);
  } else showHome();
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
    const card = $(`person-${button.dataset.person}`);
    card.tabIndex = -1;
    card.focus({ preventScroll: true });
    card.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    testimonyHighlight?.cancel();
    testimonyHighlight = card.animate([
      { boxShadow: '0 0 0 3px var(--green)', offset: 0 },
      { boxShadow: '0 0 0 3px var(--green)', offset: 0.65 },
      { boxShadow: '0 0 0 3px transparent', offset: 1 },
    ], { duration: 1500, easing: 'ease-out' });
  });
  $('suspects').addEventListener('click', event => {
    const reveal = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-reveal]');
    if (reveal) {
      const i = Number(reveal.dataset.reveal);
      if (preferences.sound) void judgmentSound.testimony();
      state.revealed[i] = true;
      render();
      const statement = $(`statement-${i}`);
      statement.tabIndex = -1;
      statement.focus({ preventScroll: true });
      return;
    }
    const judge = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-judge]');
    if (judge) {
      const i = Number(judge.dataset.index);
      const reward = state.revealed[i] ? 0 : 1;
      const correct = E.judge(state, i);
      if (correct === null) return;
      if (preferences.sound) void judgmentSound.play(correct);
      $('feedback').className = `feedback ${correct ? '' : 'error'}`;
      render(`${correct ? `✅ 正解です。${reward ? '信用 ＋1。' : '信用の増減はありません。'}` : '❌ 誤判定。信用 −2。'}${state.puzzle.people[i].name}は${state.puzzle.answer[i] ? '犯人' : '善人'}でした。`);
      if (state.status !== 'playing') {
        showResultDialog();
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
      navLink.setAttribute('aria-label', `${person.name}の証言へ移動（${selectedMarker.name}）`);
      navLink.title = `${person.name}：${selectedMarker.name}`;
      marker.parentElement!.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === marker)));
      save();
    }
  });
  $('suspects').addEventListener('input', event => {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement && target.matches('[data-note]')) { state.notes[Number(target.dataset.note)] = target.value; save(); }
  });
  $('animals-list').innerHTML = E.roles.map(person => `<article class="animal-entry"><div>${portrait(person.id)}</div><div><h3>${person.name} <small>${person.job}</small></h3><p>${person.rule}</p></div></article>`).join('');
  addReadings($('animals-list'));
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
