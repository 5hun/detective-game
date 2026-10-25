/* Pure, deterministic puzzle engine. true means liar. No network or DOM needed. */
var DetectiveEngine = (function () {
  'use strict';
  const roles: Person[] = [
    { id: 'elephant', name: 'ゾウ', rule: 'ほかの1匹が犯人か善人かを証言する。', type: 'single' },
    { id: 'rabbit', name: 'ウサギ', rule: 'ほかの2匹が同じ立場か、違う立場かを証言する。', type: 'same' },
    { id: 'owl', name: 'フクロウ', rule: '指定した3匹の中にいる犯人の数を証言する。', type: 'count' },
    { id: 'cat', name: 'ネコ', rule: '指定した2匹に少なくとも1匹、犯人がいるかを証言する。', type: 'any' },
    { id: 'wolf', name: 'オオカミ', rule: '指定した2匹が両方とも犯人かを証言する。', type: 'both' },
    { id: 'bear', name: 'クマ', rule: '指定した3匹の犯人の数が奇数か偶数かを証言する。', type: 'parity' },
    { id: 'pig', name: 'ブタ', rule: '「Aが犯人で、Bが善人」という組み合わせかを証言する。', type: 'ordered' },
    { id: 'frog', name: 'カエル', rule: '指定した3匹の中に犯人が2匹以上いるかを証言する。', type: 'majority' },
    { id: 'dog', name: 'イヌ', rule: '自分より小さい番号と大きい番号で、犯人が多い側か同数かを証言する。自分は数に含めない。', type: 'balance' },
    { id: 'deer', name: 'シカ', rule: '指定した3匹が全員同じ立場か、犯人と善人が混ざっているかを証言する。', type: 'allSame' }
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
      case 'balance': {
        const missing = a.findIndex((_, i) => !s.targets.includes(i));
        const before = s.targets.filter(t => t < missing && a[t]).length;
        const after = s.targets.filter(t => t > missing && a[t]).length;
        return Math.sign(before - after) === s.value;
      }
      case 'allSame': return (count === 0 || count === 3) === s.value;
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
    if (type === 'balance') return [-1, 0, 1].map(value => ({ type, targets, value }));
    const size = type === 'single' ? 1 : ['count', 'parity', 'majority', 'allSame'].includes(type) ? 3 : 2;
    let groups = combinations(targets, size);
    if (type === 'ordered') groups = groups.flatMap(g => [g, [...g].reverse()]);
    if (type === 'count') return groups.flatMap(targets => [0, 1, 2, 3].map(value => ({ type, targets, value })));
    return groups.flatMap(targets => [false, true].map(value => ({ type, targets, value })));
  }
  function solve(puzzle: Puzzle) { return assignments(puzzle.people.length, puzzle.k).filter(a => puzzle.statements.every((s, i) => evaluate(s, a) === !a[i])); }
  const campaigns = {
    easy: [[4, 1], [5, 1], [6, 2]],
    normal: [[5, 2], [6, 2], [7, 3], [8, 3], [9, 4]],
    hard: [[7, 3], [8, 3], [9, 4], [9, 4], [10, 4], [10, 4], [10, 5]]
  };
  function totalCases(level: Level) { return campaigns[level].length; }
  function caseConfig(level: Level, round: number) {
    if (!Number.isInteger(round) || round < 1 || round > totalCases(level)) throw new Error('Invalid round');
    const [n, k] = campaigns[level][round - 1];
    return { n, k };
  }
  // These seeds produce a unique first draw for every supported (n, k).
  // Tests exhaustively verify them; changing draw order requires rechecking this table.
  const fallbackSeeds: Record<string, number> = {
    '4,1': 0, '5,1': 0, '6,2': 0, '5,2': 0, '7,3': 1,
    '8,3': 0, '9,4': 0, '10,4': 0, '10,5': 1
  };
  const maxGenerationAttempts = 32;
  function generate(seed: number, level: Level = 'normal', round = 1, attemptLimit = maxGenerationAttempts): Puzzle {
    if (!levels[level]) throw new Error('Invalid difficulty');
    if (!Number.isInteger(attemptLimit) || attemptLimit < 0 || attemptLimit > maxGenerationAttempts) throw new Error('Invalid generation attempt limit');
    const rng = random(seed); const { n, k } = caseConfig(level, round); const all = assignments(n, k);
    function draw(source: () => number) {
      const people = shuffle(roles, source).slice(0, n);
      const answer = all[Math.floor(source() * all.length)];
      const statements = people.map((person, i) => {
        const valid = candidates(person.type, i, n).filter(s => evaluate(s, answer) === !answer[i]);
        if (!valid.length) throw new Error('No valid statement for this role');
        return valid[Math.floor(source() * valid.length)];
      });
      return { people, answer, statements };
    }
    function unique(candidate: ReturnType<typeof draw>) {
      // The chosen answer is valid by construction. Stop at the first other solution.
      return !all.some(a => a.some((value, i) => value !== candidate.answer[i]) &&
        candidate.statements.every((s, i) => evaluate(s, a) === !a[i]));
    }
    let chosen: ReturnType<typeof draw> | undefined;
    for (let attempt = 0; attempt < attemptLimit; attempt++) {
      const candidate = draw(rng);
      if (unique(candidate)) { chosen = candidate; break; }
    }
    if (!chosen) {
      const fallbackSeed = fallbackSeeds[`${n},${k}`];
      if (fallbackSeed === undefined) throw new Error('Missing unique fallback for this case configuration');
      chosen = draw(random(fallbackSeed));
      if (!unique(chosen)) throw new Error('Fallback testimony must have exactly one solution');
    }
    const { people, answer, statements } = chosen;
    const testimonyCosts: number[] = people.map(() => 0);
    if (level === 'hard' && round >= 4) {
      const twoRate = (round - 4) * 0.05;
      let paid = 0;
      let twos = 0;
      for (const i of shuffle(people.map((_, i) => i), rng)) {
        const roll = rng();
        let cost = roll < twoRate ? 2 : roll < twoRate + 0.2 ? 1 : 0;
        if (cost === 2 && twos >= (round === 5 ? 1 : 2)) cost = 1;
        if (paid >= 4) cost = 0;
        testimonyCosts[i] = cost;
        if (cost) paid++;
        if (cost === 2) twos++;
      }
      if (!paid) testimonyCosts[Math.floor(rng() * n)] = 1;
    }
    return { seed: seed >>> 0, level, round, k, people, statements, testimonyCosts, answer };
  }
  function statementText(s: Statement, people: Person[]) {
    const names = [...s.targets].sort((a, b) => a - b).map(i => people[i].name); const [a, b] = names; const list = names.join('、');
    switch (s.type) {
      case 'balance': return s.value === 0 ? '私より小さい番号と大きい番号では、犯人の数が同じだ。' : `私より${s.value === 1 ? '小さい' : '大きい'}番号のほうが、犯人が多い。`;
      case 'allSame': return s.value ? `${list}の3匹は、全員同じ立場だ。` : `${list}の3匹には、犯人と善人が混ざっている。`;
      case 'single': return `${a}は${s.value ? '犯人' : '善人'}だ。`;
      case 'same': return `${a}と${b}は、${s.value ? '同じ立場' : '違う立場'}だ。`;
      case 'count': return `${list}の3匹のうち、犯人はちょうど${s.value}匹だ。`;
      case 'any': return s.value ? `${a}と${b}のうち、少なくとも1匹は犯人だ。` : `${a}と${b}は、両方とも善人だ。`;
      case 'both': return s.value ? `${a}と${b}は、両方とも犯人だ。` : `${a}と${b}のうち、少なくとも1匹は善人だ。`;
      case 'parity': return `${list}の3匹のうち、犯人の数は${s.value ? '奇数（1匹か3匹）' : '偶数（0匹か2匹）'}だ。`;
      case 'ordered': {
        // Keep each animal's role attached while ordering the clauses by number.
        const clauses = s.targets.map((target, i) => ({ target, name: people[target].name, role: (i === 0) === s.value ? '犯人' : '善人' }))
          .sort((a, b) => a.target - b.target);
        return s.value ? `${clauses[0].name}は${clauses[0].role}で、${clauses[1].name}は${clauses[1].role}だ。`
          : `${clauses.map(c => `「${c.name}が${c.role}」`).join('')}の少なくとも一方が当てはまる。`;
      }
      case 'majority': return `${list}の3匹のうち、犯人は${s.value ? '2匹以上' : '1匹以下'}だ。`;
    }
  }
  function reveal(state: JudgmentState, index: number) {
    if (state.status !== 'playing' || !Number.isInteger(index) || index < 0 || index >= state.puzzle.people.length || state.revealed[index]) return false;
    const cost = state.puzzle.testimonyCosts[index];
    if (state.trust < cost) return false;
    state.trust -= cost;
    state.revealed[index] = true;
    return true;
  }
  const initialTrust = 5;
  function judge(state: JudgmentState, index: number) {
    if (state.status !== 'playing' || state.resolved[index] !== null) return null;
    const correct = state.puzzle.answer[index] === true;
    const reward = correct ? (state.revealed[index] ? 0 : 1) : -2;
    state.resolved[index] = { correct, guess: true, reward };
    state.trust += reward;
    if (state.trust < 0) state.status = 'lost';
    else if (state.puzzle.answer.every((liar, i) => !liar || state.resolved[i] !== null)) {
      state.status = 'won';
      state.trust += 1;
    }
    return correct;
  }
  const api = { totalCases, caseConfig, initialTrust, roles, caseStories, levels, generate, solve, evaluate, statementText, assignments, judge, reveal };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
