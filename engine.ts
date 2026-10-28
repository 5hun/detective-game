/* Pure, deterministic puzzle engine. true means criminal. No network or DOM needed. */
var DetectiveEngine = (function () {
  'use strict';
  const tr = (
    message: string | TemplateStringsArray,
    ...values: unknown[]
  ): string => {
    if (typeof DetectiveI18n !== 'undefined')
      return DetectiveI18n.text(message, ...values);
    return typeof message === 'string'
      ? message
      : message.reduce(
          (text, part, i) => text + (i ? String(values[i - 1]) : '') + part,
          '',
        );
  };
  const roles: Person[] = [
    {
      id: 'elephant',
      get name() {
        return tr('ゾウ');
      },
      get rule() {
        return tr('ほかの1匹が犯人か善人かを証言する。');
      },
      type: 'single',
    },
    {
      id: 'rabbit',
      get name() {
        return tr('ウサギ');
      },
      get rule() {
        return tr('ほかの2匹が同じ立場か、違う立場かを証言する。');
      },
      type: 'same',
    },
    {
      id: 'owl',
      get name() {
        return tr('フクロウ');
      },
      get rule() {
        return tr('指定した3匹の中にいる犯人の数を証言する。');
      },
      type: 'count',
    },
    {
      id: 'cat',
      get name() {
        return tr('ネコ');
      },
      get rule() {
        return tr('指定した2匹に少なくとも1匹、犯人がいるかを証言する。');
      },
      type: 'any',
    },
    {
      id: 'wolf',
      get name() {
        return tr('オオカミ');
      },
      get rule() {
        return tr('指定した2匹が両方とも犯人かを証言する。');
      },
      type: 'both',
    },
    {
      id: 'bear',
      get name() {
        return tr('クマ');
      },
      get rule() {
        return tr('指定した3匹の犯人の数が奇数か偶数かを証言する。');
      },
      type: 'parity',
    },
    {
      id: 'pig',
      get name() {
        return tr('ブタ');
      },
      get rule() {
        return tr('「Aが犯人で、Bが善人」という組み合わせかを証言する。');
      },
      type: 'ordered',
    },
    {
      id: 'frog',
      get name() {
        return tr('カエル');
      },
      get rule() {
        return tr('指定した3匹の中に犯人が2匹以上いるかを証言する。');
      },
      type: 'majority',
    },
    {
      id: 'dog',
      get name() {
        return tr('イヌ');
      },
      get rule() {
        return tr(
          '自分より小さい番号と大きい番号で、犯人が多い側か同数かを証言する。自分は数に含めない。',
        );
      },
      type: 'balance',
    },
    {
      id: 'deer',
      get name() {
        return tr('シカ');
      },
      get rule() {
        return tr(
          '指定した3匹が全員同じ立場か、犯人と善人が混ざっているかを証言する。',
        );
      },
      type: 'allSame',
    },
  ];
  const caseStories = [
    {
      illustration: 'cake',
      get title() {
        return tr('消えたケーキ事件');
      },
      get description() {
        return tr(
          '広場のパーティーに用意したケーキが、始まる前に食べられてしまいました。集まった動物たちの証言から、犯人を見つけましょう。',
        );
      },
      get ending() {
        return tr(
          '「ひと口だけ」のつもりが、気づけばお皿はからっぽに。ケーキを食べた犯人も手伝って、今度はみんなで大きなケーキを作りました。',
        );
      },
    },
    {
      illustration: 'book',
      get title() {
        return tr('図書館の本事件');
      },
      get description() {
        return tr(
          '図書館の大切な絵本が、だれかに隠されてしまいました。その場にいた動物たちの証言を聞いて、犯人を見つけましょう。',
        );
      },
      get ending() {
        return tr(
          '隠された絵本は、クッションの下で見つかりました。ひとりじめしたくなるほど面白いお話だったので、今日はみんなで読み聞かせの会を開きます。',
        );
      },
    },
    {
      illustration: 'flowers',
      get title() {
        return tr('花だんの足あと事件');
      },
      get description() {
        return tr(
          '公園の花だんが、だれかにふみあらされてしまいました。近くにいた動物たちの証言から、何があったのか調べましょう。',
        );
      },
      get ending() {
        return tr(
          '花だんを横切ったのは、近道をしようとしたからでした。踏んでしまった花を植え直し、遠回りの道にも小さな花を飾りました。',
        );
      },
    },
    {
      illustration: 'medal',
      get title() {
        return tr('金メダル事件');
      },
      get description() {
        return tr(
          '運動会で渡すはずの金メダルが、だれかに持ち去られてしまいました。会場にいた動物たちの証言を聞いて、犯人を見つけましょう。',
        );
      },
      get ending() {
        return tr(
          '金メダルは、こっそり開かれた表彰式で使われていました。優勝したのは「朝、ちゃんと起きられたで賞」。本物のメダルは返して、葉っぱのメダルを作ることになりました。',
        );
      },
    },
    {
      illustration: 'festival',
      get title() {
        return tr('お祭りのかざり事件');
      },
      get description() {
        return tr(
          'お祭りのために作ったかざりが、だれかにこわされてしまいました。準備に来ていた動物たちの証言から、犯人を見つけましょう。',
        );
      },
      get ending() {
        return tr(
          'かざりを壊してしまったのは、準備の途中で遊び始めたからでした。正直に謝ってつなぎ直すと、前より少し長くて、にぎやかなかざりになりました。',
        );
      },
    },
    {
      illustration: 'letters',
      get title() {
        return tr('郵便局の手紙事件');
      },
      get description() {
        return tr(
          '郵便局で仕分けた手紙が、だれかのいたずらでばらばらに。その場にいた動物たちの証言から、いたずらの犯人を見つけましょう。',
        );
      },
      get ending() {
        return tr(
          '手紙をばらばらにした犯人は、切手の絵を並べて眺めていました。手紙を元に戻したあと、郵便屋さんが使い終わった切手を少し分けてくれました。',
        );
      },
    },
    {
      illustration: 'lunch',
      get title() {
        return tr('遠足のおべんとう事件');
      },
      get description() {
        return tr(
          '遠足のお昼休み、おべんとうの中身がだれかに食べられてしまいました。一緒に来た動物たちの証言から、犯人を見つけましょう。',
        );
      },
      get ending() {
        return tr(
          'おべんとうを食べた犯人のおなかは、もういっぱい。それでも、みんなに謝るときには、おなかの奥がきゅっと小さくなりました。帰ったら、おわびのおべんとうを作ります。',
        );
      },
    },
    {
      illustration: 'blocks',
      get title() {
        return tr('おもちゃ屋の積み木事件');
      },
      get description() {
        return tr(
          'お店に飾った大きな積み木のお城が、こわされてしまいました。遊びに来ていた動物たちの証言から、犯人を見つけましょう。',
        );
      },
      get ending() {
        return tr(
          'お城を壊した犯人は、てっぺんにもう一つ積み木を載せようとしていました。今度はみんなで土台から作り直し、お店でいちばん大きなお城が完成しました。',
        );
      },
    },
    {
      illustration: 'snowman',
      get title() {
        return tr('雪だるま事件');
      },
      get description() {
        return tr(
          'みんなで作った雪だるまの鼻が、持ち去られてしまいました。雪遊びをしていた動物たちの証言から、犯人を見つけましょう。',
        );
      },
      get ending() {
        return tr(
          '消えた鼻は、小さな雪うさぎの顔についていました。雪だるまに鼻を返してから、雪うさぎには木の実の鼻を探してあげました。',
        );
      },
    },
    {
      illustration: 'lemonade',
      get title() {
        return tr('すっぱいレモネード事件');
      },
      get description() {
        return tr(
          'お店のレモネードに、だれかがレモンを追加しました。ひと口飲むと、みんな同じ顔になってしまいます。お店にいた動物たちの証言から、犯人を見つけましょう。',
        );
      },
      get ending() {
        return tr(
          '「もっとおいしくなるはず」と足したレモンは、少し多すぎたようです。はちみつと水で味を整えたら、今度はみんな、にっこり同じ顔になりました。',
        );
      },
    },
    {
      illustration: 'flags',
      get title() {
        return tr('ものほし場の旗事件');
      },
      get description() {
        return tr(
          'ものほし場のハンカチが、全部つながれて長い旗になっていました。風になびいて、なんだかお祭りのようです。近くにいた動物たちの証言から、犯人を見つけましょう。',
        );
      },
      get ending() {
        return tr(
          'ハンカチをつないだ犯人は、広場に大きな旗を飾りたかったのでした。持ち主に謝って一枚ずつ返すと、「次は古い布で作ろうよ」と、お祭りの相談が始まりました。',
        );
      },
    },
    {
      illustration: 'tea',
      get title() {
        return tr('お茶会の席札事件');
      },
      get description() {
        return tr(
          'お茶会の席札が、「くいしんぼうさま」「ねぼすけさま」などに書き換えられていました。なぜか全員、迷わず座っています。お茶会に来た動物たちの証言から、犯人を見つけましょう。',
        );
      },
      get ending() {
        return tr(
          '席札を書き換えた犯人は、みんなを笑わせたかったようです。「次は自分の札だけね」と約束して、席札を元に戻しました。でも「くいしんぼうさま」の札だけは、おかわりのお皿の前に残りました。',
        );
      },
    },
  ];
  const levels = {
    easy: {
      n: 4,
      k: 1,
      get label() {
        return tr('かんたん');
      },
    },
    normal: {
      n: 5,
      k: 2,
      get label() {
        return tr('ふつう');
      },
    },
    hard: {
      n: 7,
      k: 3,
      get label() {
        return tr('むずかしい');
      },
    },
  };
  function random(seed: number) {
    let a = seed >>> 0;
    return () => {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle<T>(a: readonly T[], rng: () => number): T[] {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  }
  function selectStory(seed: number, used: readonly number[]): number {
    const available = caseStories
      .map((_, i) => i)
      .filter((i) => !used.includes(i));
    if (!available.length) throw new Error('No unused case stories');
    return available[(seed >>> 0) % available.length];
  }
  function combinations<T>(a: T[], n: number): T[][] {
    if (!n) return [[]];
    return a.flatMap((v, i) =>
      combinations(a.slice(i + 1), n - 1).map((rest) => [v, ...rest]),
    );
  }
  function assignments(n: number, k: number) {
    return combinations(
      Array.from({ length: n }, (_, i) => i),
      k,
    ).map((ids) => Array.from({ length: n }, (_, i) => ids.includes(i)));
  }
  function evaluate(s: Statement, a: boolean[]) {
    const values = s.targets.map((i) => a[i]);
    const count = values.filter(Boolean).length;
    switch (s.type) {
      case 'balance': {
        const missing = a.findIndex((_, i) => !s.targets.includes(i));
        const before = s.targets.filter((t) => t < missing && a[t]).length;
        const after = s.targets.filter((t) => t > missing && a[t]).length;
        return Math.sign(before - after) === s.value;
      }
      case 'allSame':
        return (count === 0 || count === 3) === s.value;
      case 'single':
        return values[0] === s.value;
      case 'same':
        return (values[0] === values[1]) === s.value;
      case 'count':
        return count === s.value;
      case 'any':
        return count >= 1 === s.value;
      case 'both':
        return (count === 2) === s.value;
      case 'parity':
        return (count % 2 === 1) === s.value;
      case 'ordered':
        return (values[0] && !values[1]) === s.value;
      case 'majority':
        return count >= 2 === s.value;
      default:
        throw new Error('Unknown statement type');
    }
  }
  function candidates(
    type: StatementType,
    speaker: number,
    n: number,
  ): Statement[] {
    const targets = Array.from({ length: n }, (_, i) => i).filter(
      (i) => i !== speaker,
    );
    if (type === 'balance')
      return [-1, 0, 1].map((value) => ({ type, targets, value }));
    const size =
      type === 'single'
        ? 1
        : ['count', 'parity', 'majority', 'allSame'].includes(type)
          ? 3
          : 2;
    let groups = combinations(targets, size);
    if (type === 'ordered')
      groups = groups.flatMap((g) => [g, [...g].reverse()]);
    if (type === 'count')
      return groups.flatMap((targets) =>
        [0, 1, 2, 3].map((value) => ({ type, targets, value })),
      );
    return groups.flatMap((targets) =>
      [false, true].map((value) => ({ type, targets, value })),
    );
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
  function solve(puzzle: Puzzle) {
    return assignments(puzzle.people.length, puzzle.k).filter((a) =>
      fits(puzzle.statements, a, puzzle.mistakenCount),
    );
  }
  function identity(puzzle: Puzzle, index: number) {
    return puzzle.answer[index]
      ? tr('犯人')
      : puzzle.mistaken === index
        ? tr('勘違いしている善人')
        : tr('善人');
  }
  const campaigns = {
    easy: [
      [4, 1],
      [5, 1],
      [6, 2],
    ],
    normal: [
      [5, 2],
      [6, 2],
      [7, 3],
      [8, 3],
      [9, 4],
    ],
    hard: [
      [7, 3],
      [8, 3],
      [9, 4],
      [9, 4],
      [10, 4],
      [10, 4],
      [10, 5],
    ],
  };
  function totalCases(level: Level) {
    return campaigns[level].length;
  }
  function caseConfig(level: Level, round: number) {
    if (!Number.isInteger(round) || round < 1 || round > totalCases(level))
      throw new Error('Invalid round');
    const [n, k] = campaigns[level][round - 1];
    return { n, k, mistakenCount: level === 'hard' && round >= 4 ? 1 : 0 };
  }
  // These seeds produce a unique first draw for every supported (n, k).
  // Tests exhaustively verify them; changing draw order requires rechecking this table.
  const fallbackSeeds: Record<string, number> = {
    '9,4,1': 0,
    '10,4,1': 2,
    '10,5,1': 2,
    '4,1': 0,
    '5,1': 0,
    '6,2': 0,
    '5,2': 0,
    '7,3': 1,
    '8,3': 0,
    '9,4': 0,
    '10,4': 0,
    '10,5': 1,
  };
  const maxGenerationAttempts = 32;
  function generate(
    seed: number,
    level: Level = 'normal',
    round = 1,
    attemptLimit = maxGenerationAttempts,
  ): Puzzle {
    if (!levels[level]) throw new Error('Invalid difficulty');
    if (
      !Number.isInteger(attemptLimit) ||
      attemptLimit < 0 ||
      attemptLimit > maxGenerationAttempts
    )
      throw new Error('Invalid generation attempt limit');
    const rng = random(seed);
    const { n, k, mistakenCount } = caseConfig(level, round);
    const all = assignments(n, k);
    function draw(source: () => number) {
      const people = shuffle(roles, source).slice(0, n);
      const answer = all[Math.floor(source() * all.length)];
      const innocents = answer.flatMap((criminal, i) => (criminal ? [] : [i]));
      const mistaken = mistakenCount
        ? innocents[Math.floor(source() * innocents.length)]
        : null;
      const statements = people.map((person, i) => {
        const valid = candidates(person.type, i, n).filter(
          (s) => evaluate(s, answer) === (!answer[i] && i !== mistaken),
        );
        if (!valid.length) throw new Error('No valid statement for this role');
        return valid[Math.floor(source() * valid.length)];
      });
      return { people, answer, statements, mistaken };
    }
    function unique(candidate: ReturnType<typeof draw>) {
      // The chosen answer is valid by construction. Stop at the first other solution.
      return !all.some(
        (a) =>
          a.some((value, i) => value !== candidate.answer[i]) &&
          fits(candidate.statements, a, mistakenCount),
      );
    }
    let chosen: ReturnType<typeof draw> | undefined;
    for (let attempt = 0; attempt < attemptLimit; attempt++) {
      const candidate = draw(rng);
      if (unique(candidate)) {
        chosen = candidate;
        break;
      }
    }
    if (!chosen) {
      const fallbackSeed =
        fallbackSeeds[`${n},${k}${mistakenCount ? ',1' : ''}`];
      if (fallbackSeed === undefined)
        throw new Error('Missing unique fallback for this case configuration');
      chosen = draw(random(fallbackSeed));
      if (!unique(chosen))
        throw new Error('Fallback testimony must have exactly one solution');
    }
    const { people, answer, statements, mistaken } = chosen;
    return {
      seed: seed >>> 0,
      level,
      round,
      k,
      mistakenCount,
      mistaken,
      people,
      statements,
      answer,
    };
  }
  function statementText(s: Statement, people: Person[]) {
    const names = [...s.targets]
      .sort((a, b) => a - b)
      .map((i) => people[i].name);
    const [a, b] = names;
    const list = names.join(tr('、'));
    switch (s.type) {
      case 'balance':
        return s.value === 0
          ? tr('私より小さい番号と大きい番号では、犯人の数が同じだ。')
          : tr`私より${s.value === 1 ? tr('小さい') : tr('大きい')}番号のほうが、犯人が多い。`;
      case 'allSame':
        return s.value
          ? tr`${list}の3匹は、全員同じ立場だ。`
          : tr`${list}の3匹には、犯人と善人が混ざっている。`;
      case 'single':
        return tr`${a}は${s.value ? tr('犯人') : tr('善人')}だ。`;
      case 'same':
        return tr`${a}と${b}は、${s.value ? tr('同じ立場') : tr('違う立場')}だ。`;
      case 'count':
        return tr`${list}の3匹のうち、犯人はちょうど${s.value}匹だ。`;
      case 'any':
        return s.value
          ? tr`${a}と${b}のうち、少なくとも1匹は犯人だ。`
          : tr`${a}と${b}は、両方とも善人だ。`;
      case 'both':
        return s.value
          ? tr`${a}と${b}は、両方とも犯人だ。`
          : tr`${a}と${b}のうち、少なくとも1匹は善人だ。`;
      case 'parity':
        return tr`${list}の3匹のうち、犯人の数は${s.value ? tr('奇数（1匹か3匹）') : tr('偶数（0匹か2匹）')}だ。`;
      case 'ordered': {
        // Keep each animal's role attached while ordering the clauses by number.
        const clauses = s.targets
          .map((target, i) => ({
            target,
            name: people[target].name,
            role: (i === 0) === s.value ? tr('犯人') : tr('善人'),
          }))
          .sort((a, b) => a.target - b.target);
        return s.value
          ? tr`${clauses[0].name}は${clauses[0].role}で、${clauses[1].name}は${clauses[1].role}だ。`
          : tr`「${clauses[0].name}が${clauses[0].role}」「${clauses[1].name}が${clauses[1].role}」の少なくとも一方が当てはまる。`;
      }
      case 'majority':
        return tr`${list}の3匹のうち、犯人は${s.value ? tr('2匹以上') : tr('1匹以下')}だ。`;
    }
  }
  const initialTrust = 3;
  const caseReward = 1;
  function judge(state: JudgmentState, index: number) {
    if (state.status !== 'playing' || state.resolved[index] !== null)
      return null;
    const correct = state.puzzle.answer[index] === true;
    const reward = correct ? 0 : -1;
    state.resolved[index] = { correct, guess: true, reward };
    state.trust += reward;
    if (state.trust < 0) state.status = 'lost';
    else if (
      state.puzzle.answer.every(
        (liar, i) => !liar || state.resolved[i] !== null,
      )
    ) {
      state.status = 'won';
      state.trust += caseReward;
    }
    return correct;
  }
  const api = {
    identity,
    totalCases,
    caseConfig,
    initialTrust,
    caseReward,
    roles,
    caseStories,
    selectStory,
    levels,
    generate,
    solve,
    evaluate,
    statementText,
    assignments,
    judge,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
