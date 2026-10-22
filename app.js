(function () {
  'use strict';
  const E = window.DetectiveEngine;
  const $ = id => document.getElementById(id);
  const key = 'beast-detective-v1';
  const markers = [ { name: '未設定', color: '#d4d7ca' }, { name: '犯人候補', color: '#b96d58' }, { name: '善人候補', color: '#749476' }, { name: '要検討', color: '#c4a359' } ];
  const preferencesKey = 'animal-detective-preferences-v1';
  const preferences = { ruby: true };
  try {
    const saved = JSON.parse(localStorage.getItem(preferencesKey));
    for (const name of Object.keys(preferences)) {
      if (typeof saved?.[name] === 'boolean') preferences[name] = saved[name];
    }
  } catch { /* Settings still work when storage is unavailable. */ }
  function savePreferences() {
    try { localStorage.setItem(preferencesKey, JSON.stringify(preferences)); } catch { /* Optional persistence. */ }
  }
  function applyRubyPreference() {
    document.documentElement.classList.toggle('ruby-off', !preferences.ruby);
    $('ruby-toggle').checked = preferences.ruby;
  }
  applyRubyPreference();
  $('ruby-toggle').addEventListener('change', event => {
    preferences.ruby = event.target.checked;
    applyRubyPreference();
    savePreferences();
  });
  let state; let storageAvailable = true;
  function fresh(level) {
    const seed = window.crypto ? crypto.getRandomValues(new Uint32Array(1))[0] : Date.now() >>> 0;
    const puzzle = E.generate(seed, level);
    return { version: 1, puzzle, lives: 3, status: 'playing', resolved: puzzle.people.map(() => null), notes: puzzle.people.map(() => ''), markers: puzzle.people.map(() => 0), revealed: puzzle.people.map(() => false) };
  }
  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (!saved || saved.version !== 1 || !E.levels[saved.puzzle?.level] || !Number.isInteger(saved.puzzle.seed)) return null;
      const puzzle = E.generate(saved.puzzle.seed, saved.puzzle.level); const n = puzzle.people.length;
      if (![saved.resolved, saved.notes, saved.markers].every(a => Array.isArray(a) && a.length === n)) return null;
      if (!saved.notes.every(v => typeof v === 'string' && v.length <= 1000) || !saved.markers.every(v => Number.isInteger(v) && v >= 0 && v <= 3)) return null;
      if (!saved.resolved.every((r, i) => r === null || (typeof r.guess === 'boolean' && r.correct === (r.guess === puzzle.answer[i])))) return null;
      const mistakes = saved.resolved.filter(r => r && !r.correct).length;
      if (mistakes > 3 || saved.lives !== 3 - mistakes) return null;
      const status = saved.lives === 0 ? 'lost' : saved.resolved.every(r => r !== null) ? 'won' : 'playing';
      const revealed = saved.revealed === undefined ? puzzle.people.map(() => false) : saved.revealed;
      if (!Array.isArray(revealed) || revealed.length !== n || !revealed.every(v => typeof v === 'boolean')) return null;
      return { ...saved, puzzle, status, revealed };
    } catch { return null; }
  }
  function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); storageAvailable = true; }
    catch { storageAvailable = false; }
    $('save-status').textContent = storageAvailable ? '捜査状況は自動保存されます' : 'この環境では保存できません（現在の画面では遊べます）';
    addReadings();
  }
  function renderCard(person, i) {
    const resolved = state.resolved[i]; const ended = state.status !== 'playing'; const liar = state.puzzle.answer[i];
    let actions;
    if (resolved) actions = `<span class="resolved-tag ${resolved.correct ? '' : 'wrong'}">${resolved.correct ? '✓ 正解' : '× 誤判定'} · ${person.name}は${liar ? '犯人' : '善人'}</span>`;
    else if (ended) actions = `<span class="resolved-tag revealed">未判定 · 真相：${liar ? '犯人' : '善人'}</span>`;
    else actions = `<button class="judge" data-judge="good" data-index="${i}" aria-label="${person.name}を善人と判定">◇ 善人と判定</button><button class="judge liar" data-judge="liar" data-index="${i}" aria-label="${person.name}を犯人と判定">⊗ 犯人と判定</button>`;
    const truth = ended ? `<details class="truth-detail"><summary>真相と証言の照合：この証言は${liar ? '嘘' : '本当'}</summary><p>${state.puzzle.statements[i].targets.map(t => `${state.puzzle.people[t].name}＝${state.puzzle.answer[t] ? '犯人' : '善人'}`).join(' ／ ')}</p><p>この組み合わせでは、上の証言は${E.evaluate(state.puzzle.statements[i], state.puzzle.answer) ? '正しい' : '間違っています'}。${person.name}が${liar ? '犯人' : '善人'}という真相と一致します。</p></details>` : '';
    return `<article class="suspect" data-marker="${state.markers[i]}" id="person-${i}" aria-labelledby="name-${i}"><div class="card-main"><div class="portrait-box"><span class="person-number">0${i + 1}</span>${portrait(person.id, '', resolved ? (liar ? 'liar' : 'good') : 'neutral')}</div><div class="person-content"><div class="person-heading"><h3 id="name-${i}">${person.name}</h3><span class="job">${person.job}</span><details class="role-details"><summary>証言ルール</summary><p>${person.rule}</p></details></div><div id="statement-${i}">${state.revealed[i] || ended ? `<p class="statement">${E.statementText(state.puzzle.statements[i], state.puzzle.people)}</p>` : `<button class="reveal-button quiet-button" data-reveal="${i}" aria-controls="statement-${i}">${person.name}の証言を聞く</button>`}</div><div class="actions">${actions}</div></div></div><div class="memo-row"><div class="marker-group" role="group" aria-label="${person.name}のマーカー">${markers.map((m, j) => `<button class="marker-button" style="--dot:${m.color}" data-marker-value="${j}" data-index="${i}" aria-label="${person.name}：${m.name}" title="${m.name}" aria-pressed="${state.markers[i] === j}"></button>`).join('')}</div><label class="memo-label" for="memo-${i}">MEMO</label><textarea id="memo-${i}" data-note="${i}" aria-label="${person.name}の捜査メモ" maxlength="1000" rows="1" placeholder="きになることをメモ…"></textarea></div>${truth}</article>`;
  }
  function render(message) {
    const p = state.puzzle; const count = state.resolved.filter(r => r !== null).length;
    $('case-id').textContent = `#${p.seed.toString(16).toUpperCase().padStart(8, '0')} · ${E.levels[p.level].label}`;
    $('liar-count').textContent = `犯人 ${p.k}人`;
    $('good-count').textContent = `善人 ${p.people.length - p.k}人`;
    $('progress-count').textContent = `${count} / ${p.people.length}`;
    $('people-count').textContent = `${p.people.length} PERSONS`;
    $('lives').innerHTML = Array.from({ length: 3 }, (_, i) => `<span ${i >= state.lives ? 'class="spent"' : ''} aria-hidden="true">♥</span>`).join('');
    $('lives').setAttribute('aria-label', `残りライフ ${state.lives} / 3`);
    $('suspects').innerHTML = p.people.map(renderCard).join('');
    state.notes.forEach((v, i) => { $(`memo-${i}`).value = v; });
    $('feedback').textContent = message || '「証言を聞く」をタップして、証言を読み比べましょう。';
    $('case-stamp').textContent = state.status === 'playing' ? '捜査中' : state.status === 'won' ? '解決済' : '捜査終了';
    const result = $('result'); result.hidden = state.status === 'playing';
    if (!result.hidden) {
      const won = state.status === 'won';
      result.className = `result ${won ? '' : 'lost'}`;
      result.innerHTML = `<span class="eyebrow">${won ? 'CASE CLOSED' : 'INVESTIGATION ENDED'}</span><h2>${won ? 'すべての嘘が、ほどけた。' : '今回の捜査は、ここまで。'}</h2><p>${won ? `事件解決。${3 - state.lives === 0 ? '一度も間違えず、全員の正体を見抜きました。' : `誤判定 ${3 - state.lives}回で、全員の正体が明らかになりました。`}` : 'ライフがなくなりました。証言と真相を照らし合わせて、次の捜査に活かしましょう。'}</p><p>各カードの「真相と証言の照合」で振り返れます。犯人${p.k}人の組み合わせ${E.assignments(p.people.length, p.k).length}通りのうち、全員の証言と矛盾しないのはこの1通りです。</p><button class="primary-button" id="next-case">次の事件へ →</button>`;
      $('next-case').addEventListener('click', startCase);
    }
    save();
  }
  function startCase() {
    try {
      state = fresh($('difficulty').value);
      $('feedback').className = 'feedback';
      render('新しい事件が届きました。全員の証言が、捜査の手がかりです。');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { $('feedback').textContent = err.message; addReadings($('feedback')); }
  }
  state = restore() || fresh('normal');
  $('difficulty').value = state.puzzle.level;
  render(state.status !== 'playing' ? '前回の捜査結果を開きました。新しい事件にも挑戦できます。' : undefined);
  $('suspects').addEventListener('click', event => {
    const reveal = event.target.closest('[data-reveal]');
    if (reveal) {
      const i = Number(reveal.dataset.reveal);
      state.revealed[i] = true;
      render();
      const statement = $(`statement-${i}`);
      statement.tabIndex = -1;
      statement.focus({ preventScroll: true });
      return;
    }
    const judge = event.target.closest('[data-judge]');
    if (judge) {
      const i = Number(judge.dataset.index); const correct = E.judge(state, i, judge.dataset.judge === 'liar');
      if (correct === null) return;
      $('feedback').className = `feedback ${correct ? '' : 'error'}`;
      render(`${correct ? '✓ 正解です。' : '× 誤判定。ライフ −1。'}${state.puzzle.people[i].name}は${state.puzzle.answer[i] ? '犯人' : '善人'}でした。`);
      // Restore keyboard focus after replacing the card list.
      const next = $('suspects').querySelector('[data-judge]') || $('next-case');
      if (next) next.focus({ preventScroll: true });
    }
    const marker = event.target.closest('[data-marker-value]');
    if (marker) {
      const i = Number(marker.dataset.index); state.markers[i] = Number(marker.dataset.markerValue);
      $(`person-${i}`).dataset.marker = state.markers[i];
      marker.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === marker)));
      save();
    }
  });
  $('suspects').addEventListener('input', event => {
    if (event.target.matches('[data-note]')) { state.notes[Number(event.target.dataset.note)] = event.target.value; save(); }
  });
  $('animals-list').innerHTML = E.roles.map(person => `<article class="animal-entry"><div>${portrait(person.id)}</div><div><h3>${person.name} <small>${person.job}</small></h3><p>${person.rule}</p></div></article>`).join('');
  addReadings($('animals-list'));
  $('animals-button').addEventListener('click', () => $('animals-dialog').showModal());
  $('help-button').addEventListener('click', () => $('help-dialog').showModal());
  $('new-case').addEventListener('click', () => {
    if (state.status === 'playing') $('new-dialog').showModal(); else startCase();
  });
  $('confirm-new').addEventListener('click', () => { $('new-dialog').close(); startCase(); });
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(b.dataset.close).close()));
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } }));
})();
