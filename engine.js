/* Pure, deterministic puzzle engine. true means liar. No network or DOM needed. */
(function (root) {
  'use strict';
  const roles = [
    { id: 'fox', name: 'キツネ', job: '目撃者', rule: 'ほかの1人が犯人か善人かを証言する。', type: 'single' },
    { id: 'rabbit', name: 'ウサギ', job: '比較屋', rule: 'ほかの2人が同じ立場か、違う立場かを証言する。', type: 'same' },
    { id: 'owl', name: 'フクロウ', job: '記録係', rule: '指定した3人の中にいる犯人の人数を証言する。', type: 'count' },
    { id: 'cat', name: 'ネコ', job: '情報屋', rule: '指定した2人に少なくとも1人、犯人がいるかを証言する。', type: 'any' },
    { id: 'wolf', name: 'オオカミ', job: '見張り', rule: '指定した2人が両方とも犯人かを証言する。', type: 'both' },
    { id: 'bear', name: 'クマ', job: '帳簿係', rule: '指定した3人の犯人数が奇数か偶数かを証言する。', type: 'parity' },
    { id: 'raccoon', name: 'アライグマ', job: '仲介人', rule: '「Aが犯人で、Bが善人」という組み合わせかを証言する。', type: 'ordered' },
    { id: 'frog', name: 'カエル', job: '調査員', rule: '指定した3人の中に犯人が2人以上いるかを証言する。', type: 'majority' }
  ];
  const caseStories = [
    { title: '消えたケーキ事件', description: '広場のパーティーに用意したケーキが、始まる前に食べられてしまいました。集まった動物たちの証言から、犯人を見つけましょう。' },
    { title: '図書館の本事件', description: '図書館の大切な絵本が、だれかに隠されてしまいました。その場にいた動物たちの証言を聞いて、犯人を見つけましょう。' },
    { title: '花だんの足あと事件', description: '公園の花だんが、だれかにふみあらされてしまいました。近くにいた動物たちの証言から、何があったのか調べましょう。' },
    { title: '金メダル事件', description: '運動会で渡すはずの金メダルが、だれかに持ち去られてしまいました。会場にいた動物たちの証言を聞いて、犯人を見つけましょう。' },
    { title: 'お祭りのかざり事件', description: 'お祭りのために作ったかざりが、だれかにこわされてしまいました。準備に来ていた動物たちの証言から、犯人を見つけましょう。' },
    { title: '郵便局の手紙事件', description: '郵便局で仕分けた手紙が、だれかのいたずらでばらばらに。その場にいた動物たちの証言から、いたずらの犯人を見つけましょう。' }
  ];
  const levels = { easy: { n: 4, k: 1, label: 'かんたん' }, normal: { n: 5, k: 2, label: 'ふつう' }, hard: { n: 7, k: 3, label: 'むずかしい' } };
  function random(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(a, rng) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  function combinations(a, n) { if (!n) return [[]]; return a.flatMap((v, i) => combinations(a.slice(i + 1), n - 1).map(rest => [v, ...rest])); }
  function assignments(n, k) { return combinations(Array.from({ length: n }, (_, i) => i), k).map(ids => Array.from({ length: n }, (_, i) => ids.includes(i))); }
  function evaluate(s, a) {
    const values = s.targets.map(i => a[i]); const count = values.filter(Boolean).length;
    switch (s.type) {
      case 'single': return values[0] === s.value;
      case 'same': return (values[0] === values[1]) === s.value;
      case 'count': return count === s.value;
      case 'any': return (count >= 1) === s.value;
      case 'both': return (count === 2) === s.value;
      case 'parity': return (count % 2 === 1) === s.value;
      case 'ordered': return (values[0] && !values[1]) === s.value;
      case 'majority': return (count >= 2) === s.value;
      default: throw new Error('Unknown statement type');
    }
  }
  function candidates(type, speaker, n) {
    const targets = Array.from({ length: n }, (_, i) => i).filter(i => i !== speaker);
    const size = type === 'single' ? 1 : ['count', 'parity', 'majority'].includes(type) ? 3 : 2;
    let groups = combinations(targets, size);
    if (type === 'ordered') groups = groups.flatMap(g => [g, [...g].reverse()]);
    return groups.flatMap(g => (type === 'count' ? [0, 1, 2, 3] : [false, true]).map(value => ({ type, targets: g, value })));
  }
  function solve(puzzle) { return assignments(puzzle.people.length, puzzle.k).filter(a => puzzle.statements.every((s, i) => evaluate(s, a) === !a[i])); }
  function generate(seed, level = 'normal') {
    if (!levels[level]) throw new Error('Invalid difficulty');
    const rng = random(seed); const { n, k } = levels[level]; const all = assignments(n, k);
    for (let attempt = 0; attempt < 2000; attempt++) {
      const people = shuffle(roles, rng).slice(0, n);
      const answer = all[Math.floor(rng() * all.length)];
      let remaining = all; const statements = Array(n);
      for (const i of shuffle(Array.from({ length: n }, (_, j) => j), rng)) {
        const valid = shuffle(candidates(people[i].type, i, n), rng).filter(s => evaluate(s, answer) === !answer[i]);
        let best; let survivors;
        for (const s of valid) {
          const next = remaining.filter(a => evaluate(s, a) === !a[i]);
          if (!survivors || next.length < survivors.length) { best = s; survivors = next; }
        }
        statements[i] = best; remaining = survivors;
      }
      if (remaining.length === 1) return { seed: seed >>> 0, level, k, people, statements, answer };
    }
    throw new Error('問題を生成できませんでした。もう一度お試しください。');
  }
  function statementText(s, people) {
    const names = s.targets.map(i => people[i].name); const [a, b] = names; const list = names.join('、');
    switch (s.type) {
      case 'single': return `${a}は${s.value ? '犯人' : '善人'}だ。`;
      case 'same': return `${a}と${b}は、${s.value ? '同じ立場' : '違う立場'}だ。`;
      case 'count': return `${list}の3人のうち、犯人はちょうど${s.value}人だ。`;
      case 'any': return s.value ? `${a}と${b}のうち、少なくとも1人は犯人だ。` : `${a}と${b}の中に、犯人はいない。`;
      case 'both': return s.value ? `${a}と${b}は、両方とも犯人だ。` : `${a}と${b}が、両方とも犯人ということはない。`;
      case 'parity': return `${list}の3人のうち、犯人の人数は${s.value ? '奇数（1人か3人）' : '偶数（0人か2人）'}だ。`;
      case 'ordered': return s.value ? `${a}は犯人で、${b}は善人だ。` : `「${a}が犯人で、${b}が善人」という組み合わせではない。`;
      case 'majority': return `${list}の3人のうち、犯人は${s.value ? '2人以上' : '1人以下'}だ。`;
    }
  }
  const initialTrust = 5;
  function judge(state, index, guess) {
    if (state.status !== 'playing' || state.resolved[index] !== null) return null;
    const correct = state.puzzle.answer[index] === guess;
    state.resolved[index] = { correct, guess };
    state.trust += correct ? 1 : -1;
    if (state.trust === 0) state.status = 'lost';
    else if (state.resolved.every(r => r !== null)) state.status = 'won';
    return correct;
  }
  const api = { initialTrust, roles, caseStories, levels, generate, solve, evaluate, statementText, assignments, judge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DetectiveEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
