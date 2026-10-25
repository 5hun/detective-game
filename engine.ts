/* Pure, deterministic puzzle engine. true means criminal. No network or DOM needed. */
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
    { title: '消えたケーキ事件', description: '広場のパーティーに用意したケーキが、始まる前に食べられてしまいました。集まった動物たちの証言から、犯人を見つけましょう。', ending: '「ひと口だけ」のつもりが、気づけばお皿はからっぽに。ケーキを食べた犯人も手伝って、今度はみんなで大きなケーキを作りました。' },
    { title: '図書館の本事件', description: '図書館の大切な絵本が、だれかに隠されてしまいました。その場にいた動物たちの証言を聞いて、犯人を見つけましょう。', ending: '隠された絵本は、クッションの下で見つかりました。ひとりじめしたくなるほど面白いお話だったので、今日はみんなで読み聞かせの会を開きます。' },
    { title: '花だんの足あと事件', description: '公園の花だんが、だれかにふみあらされてしまいました。近くにいた動物たちの証言から、何があったのか調べましょう。', ending: '花だんを横切ったのは、近道をしようとしたからでした。踏んでしまった花を植え直し、遠回りの道にも小さな花を飾りました。' },
    { title: '金メダル事件', description: '運動会で渡すはずの金メダルが、だれかに持ち去られてしまいました。会場にいた動物たちの証言を聞いて、犯人を見つけましょう。', ending: '金メダルは、こっそり開かれた表彰式で使われていました。優勝したのは「朝、ちゃんと起きられたで賞」。本物のメダルは返して、葉っぱのメダルを作ることになりました。' },
    { title: 'お祭りのかざり事件', description: 'お祭りのために作ったかざりが、だれかにこわされてしまいました。準備に来ていた動物たちの証言から、犯人を見つけましょう。', ending: 'かざりを壊してしまったのは、準備の途中で遊び始めたからでした。正直に謝ってつなぎ直すと、前より少し長くて、にぎやかなかざりになりました。' },
    { title: '郵便局の手紙事件', description: '郵便局で仕分けた手紙が、だれかのいたずらでばらばらに。その場にいた動物たちの証言から、いたずらの犯人を見つけましょう。', ending: '手紙をばらばらにした犯人は、切手の絵を並べて眺めていました。手紙を元に戻したあと、郵便屋さんが使い終わった切手を少し分けてくれました。' },
    { title: '遠足のおべんとう事件', description: '遠足のお昼休み、おべんとうの中身がだれかに食べられてしまいました。一緒に来た動物たちの証言から、犯人を見つけましょう。', ending: 'おべんとうを食べた犯人のおなかは、もういっぱい。それでも、みんなに謝るときには、おなかの奥がきゅっと小さくなりました。帰ったら、おわびのおべんとうを作ります。' },
    { title: 'おもちゃ屋の積み木事件', description: 'お店に飾った大きな積み木のお城が、こわされてしまいました。遊びに来ていた動物たちの証言から、犯人を見つけましょう。', ending: 'お城を壊した犯人は、てっぺんにもう一つ積み木を載せようとしていました。今度はみんなで土台から作り直し、お店でいちばん大きなお城が完成しました。' },
    { title: '雪だるま事件', description: 'みんなで作った雪だるまの鼻が、持ち去られてしまいました。雪遊びをしていた動物たちの証言から、犯人を見つけましょう。', ending: '消えた鼻は、小さな雪うさぎの顔についていました。雪だるまに鼻を返してから、雪うさぎには木の実の鼻を探してあげました。' },
    { title: 'すっぱいレモネード事件', description: 'お店のレモネードに、だれかがレモンを追加しました。ひと口飲むと、みんな同じ顔になってしまいます。お店にいた動物たちの証言から、犯人を見つけましょう。', ending: '「もっとおいしくなるはず」と足したレモンは、少し多すぎたようです。はちみつと水で味を整えたら、今度はみんな、にっこり同じ顔になりました。' },
    { title: 'ものほし場の旗事件', description: 'ものほし場のハンカチが、全部つながれて長い旗になっていました。風になびいて、なんだかお祭りのようです。近くにいた動物たちの証言から、犯人を見つけましょう。', ending: 'ハンカチをつないだ犯人は、広場に大きな旗を飾りたかったのでした。持ち主に謝って一枚ずつ返すと、「次は古い布で作ろうよ」と、お祭りの相談が始まりました。' },
    { title: 'お茶会の席札事件', description: 'お茶会の席札が、「くいしんぼうさま」「ねぼすけさま」などに書き換えられていました。なぜか全員、迷わず座っています。お茶会に来た動物たちの証言から、犯人を見つけましょう。', ending: '席札を書き換えた犯人は、みんなを笑わせたかったようです。「次は自分の札だけね」と約束して、席札を元に戻しました。でも「くいしんぼうさま」の札だけは、おかわりのお皿の前に残りました。' }
  ];
  const levels = { easy: { n: 4, k: 1, label: 'かんたん' }, normal: { n: 5, k: 2, label: 'ふつう' }, hard: { n: 7, k: 3, label: 'むずかしい' } };
  function random(seed: number) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle<T>(a: readonly T[], rng: () => number): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  function selectStory(seed: number, used: readonly number[]): number {
    const available = caseStories.map((_, i) => i).filter(i => !used.includes(i));
    if (!available.length) throw new Error('No unused case stories');
    return available[(seed >>> 0) % available.length];
  }
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
  // For a fixed criminal assignment, every false innocent statement identifies
  // a mistaken animal. No additional hidden-role ambiguity remains.
  function fits(statements: Statement[], a: boolean[], mistakenCount: number) {
    let mistakes = 0;
    for (let i = 0; i < a.length; i++) {
      const truth = evaluate(statements[i], a);
      if (a[i] && truth) return false;
      if (!a[i] && !truth) mistakes++;
    }
    return mistakes === mistakenCount;
  }
  function solve(puzzle: Puzzle) { return assignments(puzzle.people.length, puzzle.k).filter(a => fits(puzzle.statements, a, puzzle.mistakenCount)); }
  function identity(puzzle: Puzzle, index: number) {
    return puzzle.answer[index] ? '犯人' : puzzle.mistaken === index ? '勘違いしている善人' : '善人';
  }
  const campaigns = {
    easy: [[4, 1], [5, 1], [6, 2]],
    normal: [[5, 2], [6, 2], [7, 3], [8, 3], [9, 4]],
    hard: [[7, 3], [8, 3], [9, 4], [9, 4], [10, 4], [10, 4], [10, 5]]
  };
  function totalCases(level: Level) { return campaigns[level].length; }
  function caseConfig(level: Level, round: number) {
    if (!Number.isInteger(round) || round < 1 || round > totalCases(level)) throw new Error('Invalid round');
    const [n, k] = campaigns[level][round - 1];
    return { n, k, mistakenCount: level === 'hard' && round >= 4 ? 1 : 0 };
  }
  // These seeds produce a unique first draw for every supported (n, k).
  // Tests exhaustively verify them; changing draw order requires rechecking this table.
  const fallbackSeeds: Record<string, number> = {
    '9,4,1': 0, '10,4,1': 2, '10,5,1': 2,
    '4,1': 0, '5,1': 0, '6,2': 0, '5,2': 0, '7,3': 1,
    '8,3': 0, '9,4': 0, '10,4': 0, '10,5': 1
  };
  const maxGenerationAttempts = 32;
  function generate(seed: number, level: Level = 'normal', round = 1, attemptLimit = maxGenerationAttempts): Puzzle {
    if (!levels[level]) throw new Error('Invalid difficulty');
    if (!Number.isInteger(attemptLimit) || attemptLimit < 0 || attemptLimit > maxGenerationAttempts) throw new Error('Invalid generation attempt limit');
    const rng = random(seed); const { n, k, mistakenCount } = caseConfig(level, round); const all = assignments(n, k);
    function draw(source: () => number) {
      const people = shuffle(roles, source).slice(0, n);
      const answer = all[Math.floor(source() * all.length)];
      const innocents = answer.flatMap((criminal, i) => criminal ? [] : [i]);
      const mistaken = mistakenCount ? innocents[Math.floor(source() * innocents.length)] : null;
      const statements = people.map((person, i) => {
        const valid = candidates(person.type, i, n).filter(s => evaluate(s, answer) === (!answer[i] && i !== mistaken));
        if (!valid.length) throw new Error('No valid statement for this role');
        return valid[Math.floor(source() * valid.length)];
      });
      return { people, answer, statements, mistaken };
    }
    function unique(candidate: ReturnType<typeof draw>) {
      // The chosen answer is valid by construction. Stop at the first other solution.
      return !all.some(a => a.some((value, i) => value !== candidate.answer[i]) &&
        fits(candidate.statements, a, mistakenCount));
    }
    let chosen: ReturnType<typeof draw> | undefined;
    for (let attempt = 0; attempt < attemptLimit; attempt++) {
      const candidate = draw(rng);
      if (unique(candidate)) { chosen = candidate; break; }
    }
    if (!chosen) {
      const fallbackSeed = fallbackSeeds[`${n},${k}${mistakenCount ? ",1" : ""}`];
      if (fallbackSeed === undefined) throw new Error('Missing unique fallback for this case configuration');
      chosen = draw(random(fallbackSeed));
      if (!unique(chosen)) throw new Error('Fallback testimony must have exactly one solution');
    }
    const { people, answer, statements, mistaken } = chosen;
    const testimonyCosts: number[] = people.map(() => 0);
    if (level === 'hard' && round >= 5) {
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
    return { seed: seed >>> 0, level, round, k, mistakenCount, mistaken, people, statements, testimonyCosts, answer };
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
  const api = { identity, totalCases, caseConfig, initialTrust, roles, caseStories, selectStory, levels, generate, solve, evaluate, statementText, assignments, judge, reveal };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
