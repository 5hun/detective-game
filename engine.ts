/* Pure, deterministic puzzle engine. true means liar. No network or DOM needed. */
var DetectiveEngine = (function () {
  'use strict';
  const roles: Person[] = [
    { id: 'fox', name: 'キツネ', job: '目撃者', rule: 'ほかの1匹が犯人か善人かを証言する。', type: 'single' },
    { id: 'rabbit', name: 'ウサギ', job: '比較屋', rule: 'ほかの2匹が同じ立場か、違う立場かを証言する。', type: 'same' },
    { id: 'owl', name: 'フクロウ', job: '記録係', rule: '指定した3匹の中にいる犯人の数を証言する。', type: 'count' },
    { id: 'cat', name: 'ネコ', job: '情報屋', rule: '指定した2匹に少なくとも1匹、犯人がいるかを証言する。', type: 'any' },
    { id: 'wolf', name: 'オオカミ', job: '見張り', rule: '指定した2匹が両方とも犯人かを証言する。', type: 'both' },
    { id: 'bear', name: 'クマ', job: '帳簿係', rule: '指定した3匹の犯人の数が奇数か偶数かを証言する。', type: 'parity' },
    { id: 'raccoon', name: 'アライグマ', job: '仲介人', rule: '「Aが犯人で、Bが善人」という組み合わせかを証言する。', type: 'ordered' },
    { id: 'frog', name: 'カエル', job: '調査員', rule: '指定した3匹の中に犯人が2匹以上いるかを証言する。', type: 'majority' }
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
  function random(seed: number) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle<T>(a: readonly T[], rng: () => number): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  function combinations<T>(a: T[], n: number): T[][] { if (!n) return [[]]; return a.flatMap((v, i) => combinations(a.slice(i + 1), n - 1).map(rest => [v, ...rest])); }
  function assignments(n: number, k: number) { return combinations(Array.from({ length: n }, (_, i) => i), k).map(ids => Array.from({ length: n }, (_, i) => ids.includes(i))); }
  function evaluate(s: Statement, a: boolean[]) {
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
  function candidates(type: StatementType, speaker: number, n: number): Statement[] {
    const targets = Array.from({ length: n }, (_, i) => i).filter(i => i !== speaker);
    const size = type === 'single' ? 1 : ['count', 'parity', 'majority'].includes(type) ? 3 : 2;
    let groups = combinations(targets, size);
    if (type === 'ordered') groups = groups.flatMap(g => [g, [...g].reverse()]);
    if (type === 'count') return groups.flatMap(targets => [0, 1, 2, 3].map(value => ({ type, targets, value })));
    return groups.flatMap(targets => [false, true].map(value => ({ type, targets, value })));
  }
  function solve(puzzle: Puzzle) { return assignments(puzzle.people.length, puzzle.k).filter(a => puzzle.statements.every((s, i) => evaluate(s, a) === !a[i])); }
  function generate(seed: number, level: Level = 'normal'): Puzzle {
    if (!levels[level]) throw new Error('Invalid difficulty');
    const rng = random(seed); const { n, k } = levels[level]; const all = assignments(n, k);
    for (let attempt = 0; attempt < 2000; attempt++) {
      const people = shuffle(roles, rng).slice(0, n);
      const answer = all[Math.floor(rng() * all.length)];
      let remaining = all; const statements: Statement[] = Array(n);
      for (const i of shuffle(Array.from({ length: n }, (_, j) => j), rng)) {
        const valid = shuffle(candidates(people[i].type, i, n), rng).filter(s => evaluate(s, answer) === !answer[i]);
        let best: Statement | undefined; let survivors: boolean[][] | undefined;
        for (const s of valid) {
          const next = remaining.filter(a => evaluate(s, a) === !a[i]);
          if (!survivors || next.length < survivors.length) { best = s; survivors = next; }
        }
        if (!best || !survivors) throw new Error('No valid statement for this role');
        statements[i] = best; remaining = survivors;
      }
      if (remaining.length === 1) return { seed: seed >>> 0, level, k, people, statements, answer };
    }
    throw new Error('問題を生成できませんでした。もう一度お試しください。');
  }
  function statementText(s: Statement, people: Person[]) {
    const names = s.targets.map(i => people[i].name); const [a, b] = names; const list = names.join('、');
    switch (s.type) {
      case 'single': return `${a}は${s.value ? '犯人' : '善人'}だ。`;
      case 'same': return `${a}と${b}は、${s.value ? '同じ立場' : '違う立場'}だ。`;
      case 'count': return `${list}の3匹のうち、犯人はちょうど${s.value}匹だ。`;
      case 'any': return s.value ? `${a}と${b}のうち、少なくとも1匹は犯人だ。` : `${a}と${b}は、両方とも善人だ。`;
      case 'both': return s.value ? `${a}と${b}は、両方とも犯人だ。` : `${a}と${b}のうち、少なくとも1匹は善人だ。`;
      case 'parity': return `${list}の3匹のうち、犯人の数は${s.value ? '奇数（1匹か3匹）' : '偶数（0匹か2匹）'}だ。`;
      case 'ordered': return s.value ? `${a}は犯人で、${b}は善人だ。` : `「${a}が善人」「${b}が犯人」の少なくとも一方が当てはまる。`;
      case 'majority': return `${list}の3匹のうち、犯人は${s.value ? '2匹以上' : '1匹以下'}だ。`;
    }
  }
  const initialTrust = 5;
  function judge(state: JudgmentState, index: number) {
    if (state.status !== 'playing' || state.resolved[index] !== null) return null;
    const correct = state.puzzle.answer[index] === true;
    const reward = correct ? (state.revealed[index] ? 1 : 2) : -2;
    state.resolved[index] = { correct, guess: true, reward };
    state.trust = Math.max(0, state.trust + reward);
    if (state.trust === 0) state.status = 'lost';
    else if (state.puzzle.answer.every((liar, i) => !liar || state.resolved[i] !== null)) state.status = 'won';
    return correct;
  }
  const api = { initialTrust, roles, caseStories, levels, generate, solve, evaluate, statementText, assignments, judge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
