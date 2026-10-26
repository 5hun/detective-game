'use strict';
import { test } from 'node:test';
import assert = require('node:assert/strict');
const E: typeof DetectiveEngine = require('../engine.js') as typeof DetectiveEngine;

void test('stories never repeat during campaigns at every difficulty, even with identical seeds', () => {
  for (const level of Object.keys(E.levels) as Level[]) {
    for (const seed of [0, 1, 42, 4294967295]) {
      let history: number[] = [];
      for (let round = 1; round <= E.totalCases(level); round++) {
        const id = E.selectStory(seed, history);
        assert.ok(id >= 0 && id < E.caseStories.length);
        assert.ok(!history.includes(id));
        history.push(id);
        history = JSON.parse(JSON.stringify(history)) as number[];
      }
      assert.equal(new Set(history).size, E.totalCases(level));
    }
  }
  assert.throws(() => E.selectStory(0, E.caseStories.map((_, i) => i)), /No unused/);
});

void test('3,000 generated cases uniquely identify the actual answer and obey every role', () => {
  for (const [level, config] of (Object.entries(E.levels) as [Level, (typeof E.levels)[Level]][])) {
    for (let seed = 0; seed < 1000; seed++) {
      const p = E.generate(seed, level);
      assert.equal(p.people.length, config.n);
      assert.equal(new Set(p.people.map(v => v.id)).size, config.n);
      assert.equal(p.answer.filter(Boolean).length, config.k);
      // Independent exhaustive enumeration, instead of trusting the generator/solver.
      const solutions = [];
      for (let mask = 0; mask < 2 ** config.n; mask++) {
        const a = Array.from({ length: config.n }, (_, i) => Boolean(mask & (1 << i)));
        if (a.filter(Boolean).length !== config.k) continue;
        const valid = p.statements.every((s, i) => {
          const v = s.targets.map(t => a[t]);
          const count = v.filter(Boolean).length;
          const propositions = { single: v[0], same: v[0] === v[1], any: v.some(Boolean), both: v.every(Boolean), parity: Boolean(count % 2), ordered: v[0] && !v[1], majority: count >= 2 };
          const before = a.filter((liar, index) => liar && index < i).length;
          const after = a.filter((liar, index) => liar && index > i).length;
          const truth = s.type === 'balance' ? Math.sign(before - after) === s.value : s.type === 'allSame' ? (count === 0 || count === 3) === s.value : s.type === 'count' ? count === s.value : propositions[s.type] === s.value;
          return truth !== a[i];
        });
        if (valid) solutions.push(a);
      }
      assert.ok(solutions.some(a => a.every((liar, i) => liar === p.answer[i])), `${level} seed=${seed}`);
      assert.deepEqual(E.solve(p).map(a => JSON.stringify(a)).sort(), solutions.map(a => JSON.stringify(a)).sort());
      assert.equal(solutions.length, 1, `${level} seed=${seed}`);
      p.statements.forEach((s, i) => {
        assert.equal(s.type, p.people[i].type);
        assert.ok(!s.targets.includes(i));
        assert.equal(new Set(s.targets).size, s.targets.length);
        assert.ok(s.targets.every(t => t >= 0 && t < config.n));
        assert.equal(E.evaluate(s, p.answer), !p.answer[i] && i !== p.mistaken);
        assert.ok(E.statementText(s, p.people).endsWith('。'));
        assert.doesNotMatch(E.statementText(s, p.people), /ない|なかった|ません|ぬ|ではなく/);
      });
    }
  }
});
void test('same seed reproduces the case, different seeds vary it', () => {
  for (const level of Object.keys(E.levels) as Level[]) {
    assert.deepEqual(E.generate(4294967295, level), E.generate(4294967295, level));
    const cases = new Set(Array.from({ length: 100 }, (_, i) => JSON.stringify(E.generate(i, level).statements)));
    assert.ok(cases.size > 90);
  }
});
function state(level: Level = 'normal'): JudgmentState { const puzzle = E.generate(333, level); return { puzzle, revealed: puzzle.people.map(() => true), resolved: puzzle.people.map(() => null), trust: E.initialTrust, status: 'playing' }; }
void test('only criminals need judgment at every difficulty', () => {
  for (const level of Object.keys(E.levels) as Level[]) {
    const s = state(level);
    const criminals = s.puzzle.answer.flatMap((liar, i) => liar ? [i] : []);
    criminals.forEach((index, j) => {
      assert.equal(E.judge(s, index), true);
      assert.equal(s.trust, j === criminals.length - 1 ? 7 : 5);
      assert.equal(s.status, j === criminals.length - 1 ? 'won' : 'playing');
      assert.equal(E.judge(s, index), null);
    });
    assert.equal(s.resolved.filter(Boolean).length, criminals.length);
    assert.equal(E.judge(s, s.puzzle.answer.indexOf(false)), null);
  }
});
void test('three incorrect accusations lose and cannot be repeated', () => {
  const s = state('hard');
  const innocents = s.puzzle.answer.flatMap((liar, i) => liar ? [] : [i]);
  innocents.slice(0, 3).forEach((index, j) => {
    assert.equal(E.judge(s, index), false);
    assert.equal(s.trust, [3, 1, -1][j]);
    assert.equal(s.status, j === 2 ? 'lost' : 'playing');
    assert.equal(E.judge(s, index), null);
  });
  assert.equal(E.judge(s, s.puzzle.answer.indexOf(true)), null);
});
void test('correct accusation after testimony does not recover trust', () => {
  const s = state('hard');
  const innocents = s.puzzle.answer.flatMap((liar, i) => liar ? [] : [i]);
  E.judge(s, innocents[0]);
  E.judge(s, innocents[1]);
  E.judge(s, s.puzzle.answer.indexOf(true));
  assert.equal(s.trust, 1);
  E.judge(s, innocents[2]);
  assert.equal(s.status, 'lost');
  assert.equal(s.trust, -1);
});
void test('finding all criminals wins after an incorrect accusation', () => {
  const s = state();
  E.judge(s, s.puzzle.answer.indexOf(false));
  s.puzzle.answer.forEach((liar, i) => { if (liar) E.judge(s, i); });
  assert.equal(s.status, 'won');
  assert.equal(s.trust, 4);
});
void test('all statement polarities and count boundaries are evaluated correctly', () => {
  assert.equal(E.evaluate({ type:'count', targets:[0,1,2], value:0 }, [false,false,false]), true);
  assert.equal(E.evaluate({ type:'count', targets:[0,1,2], value:3 }, [true,true,true]), true);
  assert.equal(E.evaluate({ type:'ordered', targets:[0,1], value:false }, [true,true]), true);
  assert.equal(E.evaluate({ type:'ordered', targets:[0,1], value:false }, [true,false]), false);
  assert.equal(E.evaluate({ type:'both', targets:[0,1], value:false }, [true,false]), true);
  assert.equal(E.evaluate({ type:'parity', targets:[0,1,2], value:false }, [false,false,false]), true);
  assert.throws(() => E.generate(0, 'unknown' as Level));
});

void test('correct arrest before testimony does not recover trust', () => {
  const s = state('hard');
  const criminals = s.puzzle.answer.flatMap((liar, i) => liar ? [i] : []);
  s.revealed.fill(false);
  assert.equal(E.judge(s, criminals[0]), true);
  assert.equal(s.trust, 5);
  assert.equal(E.judge(s, criminals[0]), null);
  assert.equal(s.trust, 5);
  assert.equal(E.judge(s, criminals[1]), true);
  assert.equal(s.trust, 5);
});
void test('incorrect arrest before testimony still loses two trust', () => {
  const s = state();
  s.revealed.fill(false);
  assert.equal(E.judge(s, s.puzzle.answer.indexOf(false)), false);
  assert.equal(s.trust, 3);
});

void test('testimony mentions animals in number order while preserving ordered roles', () => {
  const statement: Statement = { type: 'ordered', targets: [1, 0], value: true };
  assert.equal(E.statementText(statement, E.roles), 'ゾウは善人で、ウサギは犯人だ。');
  assert.equal(E.evaluate(statement, [false, true]), true);
  assert.equal(E.evaluate(statement, [true, false]), false);
  statement.value = false;
  assert.equal(E.statementText(statement, E.roles), '「ゾウが犯人」「ウサギが善人」の少なくとも一方が当てはまる。');
  assert.equal(E.evaluate(statement, [false, true]), false);
  assert.equal(E.evaluate(statement, [true, false]), true);
  assert.deepEqual(statement.targets, [1, 0]);

  for (const person of E.roles.filter(p => p.type !== 'balance')) {
    const targets = ['count', 'parity', 'majority', 'allSame'].includes(person.type) ? [2, 1, 0] : person.type === 'single' ? [0] : [1, 0];
    for (const value of [false, true]) {
      if (person.type === 'balance') continue;
      const sample: Statement = person.type === 'count' ? { type: 'count', targets, value: 1 } : { type: person.type, targets, value };
      const text = E.statementText(sample, E.roles);
      const positions = [...targets].sort((a, b) => a - b).map(t => text.indexOf(E.roles[t].name));
      assert.ok(positions.every((position, i) => position >= 0 && (i === 0 || position > positions[i - 1])), text);
    }
  }
});

void test('affirmative wording preserves the meaning of complementary statements', () => {
  const cases: { type: 'any' | 'both' | 'ordered'; text: string; truth: (a: boolean, b: boolean) => boolean }[] = [
    { type: 'any', text: 'ゾウとウサギは、両方とも善人だ。', truth: (a, b) => !a && !b },
    { type: 'both', text: 'ゾウとウサギのうち、少なくとも1匹は善人だ。', truth: (a, b) => !a || !b },
    { type: 'ordered', text: '「ゾウが善人」「ウサギが犯人」の少なくとも一方が当てはまる。', truth: (a, b) => !a || b }
  ];
  for (const { type, text, truth } of cases) {
    const statement: Statement = { type, targets: [0, 1], value: false };
    assert.equal(E.statementText(statement, E.roles), text);
    for (const a of [false, true]) {
      for (const b of [false, true]) {
        assert.equal(E.evaluate(statement, [a, b]), truth(a, b), `${type}: ${a}, ${b}`);
      }
    }
  }
});

void test('bounded generation falls back to verified unique cases for every campaign configuration', () => {
  for (const level of Object.keys(E.levels) as Level[]) {
    for (let round = 1; round <= E.totalCases(level); round++) {
      for (const seed of [0, 1, 333, 4294967295]) {
        const p = E.generate(seed, level, round, 0);
        assert.deepEqual(E.solve(p), [p.answer]);
        assert.equal(p.seed, seed);
        assert.equal(p.level, level);
        assert.equal(p.round, round);
        assert.deepEqual(p, E.generate(seed, level, round, 0));
        p.statements.forEach((s, i) => {
          assert.equal(s.type, p.people[i].type);
          assert.ok(!s.targets.includes(i));
          assert.equal(E.evaluate(s, p.answer), !p.answer[i] && i !== p.mistaken);
        });
      }
    }
  }
  for (const limit of [-1, 33, 1.5, NaN, Infinity]) {
    assert.throws(() => E.generate(0, 'normal', 1, limit));
  }
});

void test('a one-attempt budget retries ambiguous draws using the unique fallback', () => {
  // The original first draw for easy seed 7 is ambiguous: one attempt must use the fallback.
  const limited = E.generate(7, 'easy', 1, 1);
  const fallback = E.generate(7, 'easy', 1, 0);
  assert.deepEqual(limited, fallback);
  const retried = E.generate(7, 'easy');
  assert.deepEqual(E.solve(retried), [retried.answer]);
  assert.notDeepEqual(retried.statements, fallback.statements);
  for (let seed = 0; seed < 100; seed++) {
    const p = E.generate(seed, 'easy', 1, 1);
    assert.deepEqual(E.solve(p), [p.answer]);
  }
});

void test('difficulty-specific campaigns grow in size and preserve valid testimony at every starting level', () => {
  for (const level of Object.keys(E.levels) as Level[]) {
    let previous = E.caseConfig(level, 1);
    for (let round = 1; round <= E.totalCases(level); round++) {
      const config = E.caseConfig(level, round);
      assert.ok(config.n >= previous.n && config.k >= previous.k);
      assert.ok(config.k < config.n);
      for (let seed = 0; seed < 100; seed++) {
        const p = E.generate(seed, level, round);
        assert.equal(p.round, round);
        assert.equal(p.people.length, config.n);
        assert.equal(p.answer.filter(Boolean).length, config.k);
        assert.ok(p.statements.every((statement, i) => E.evaluate(statement, p.answer) === (!p.answer[i] && i !== p.mistaken)));
        assert.deepEqual(E.solve(p), [p.answer]);
      }
      previous = config;
    }
  }
  for (const round of [0, 6, 1.5, NaN]) assert.throws(() => E.generate(1, 'normal', round));
});


void test('paid testimony appears only in later hard cases with bounded costs', () => {
  const paidRoles = new Set<string>();
  for (const level of ['easy', 'normal', 'hard'] as Level[]) {
    for (let round = 1; round <= E.totalCases(level); round++) {
      for (let seed = 0; seed < 100; seed++) {
        const p = E.generate(seed, level, round);
        assert.equal(p.testimonyCosts.length, p.people.length);
        if (level === 'hard' && round >= 5) {
          assert.ok(p.testimonyCosts.filter(Boolean).length >= 1);
          assert.ok(p.testimonyCosts.filter(Boolean).length <= 4);
          assert.ok(p.testimonyCosts.filter(c => c === 2).length <= (round === 4 ? 0 : round === 5 ? 1 : 2));
        }
        p.testimonyCosts.forEach((cost, i) => {
          assert.ok(cost === 0 || cost === 1 || cost === 2);
          if (level !== 'hard' || round < 5) assert.equal(cost, 0);
          if (cost) paidRoles.add(p.people[i].id);
        });
      }
    }
  }
  assert.equal(paidRoles.size, E.roles.length);
});

void test('paid testimony allows zero funds, rejects insufficient funds, and charges once', () => {
  for (const cost of [1, 2]) {
    const s = state('hard');
    s.revealed.fill(false);
    s.puzzle.testimonyCosts[0] = cost;
    s.puzzle.testimonyCosts[1] = 0;
    s.puzzle.testimonyCosts[2] = 1;
    s.trust = cost - 1;
    assert.equal(E.reveal(s, 0), false);
    assert.equal(s.revealed[0], false);
    s.trust = cost;
    assert.equal(E.reveal(s, 0), true);
    assert.equal(s.trust, 0);
    assert.equal(s.status, 'playing');
    assert.equal(E.reveal(s, 0), false);
    assert.equal(E.reveal(s, 2), false);
    assert.equal(E.reveal(s, 1), true);
    assert.equal(s.trust, 0);
    s.status = 'won';
    assert.equal(E.reveal(s, 3), false);
    assert.equal(E.reveal(s, -1), false);
  }
});

void test('zero funds allow continued investigation and case completion', () => {
  const s = state('hard');
  s.trust = 2;
  E.judge(s, s.puzzle.answer.indexOf(false));
  assert.equal(s.trust, 0);
  assert.equal(s.status, 'playing');
  s.puzzle.answer.forEach((liar, i) => { if (liar) E.judge(s, i); });
  assert.equal(s.status, 'won');
  assert.equal(s.trust, 1);
});

void test('an incorrect accusation at zero funds ends the investigation', () => {
  const s = state();
  s.trust = 0;
  E.judge(s, s.puzzle.answer.indexOf(false));
  assert.equal(s.trust, -2);
  assert.equal(s.status, 'lost');
});

void test('mistaken innocents have a unique identity under independent role enumeration', () => {
  for (const round of [4, 5, 6, 7]) {
    for (let seed = 0; seed < 150; seed++) {
      const p = E.generate(seed, 'hard', round);
      assert.equal(p.mistakenCount, 1);
      assert.equal(p.answer[p.mistaken!], false);
      if (round === 4) assert.ok(p.testimonyCosts.every(c => c === 0));
      const solutions: { answer: boolean[]; mistaken: number }[] = [];
      for (let mask = 0; mask < 2 ** p.people.length; mask++) {
        const a = p.people.map((_, i) => Boolean(mask & (1 << i)));
        if (a.filter(Boolean).length !== p.k) continue;
        const truths = p.statements.map(s => E.evaluate(s, a));
        for (let m = 0; m < a.length; m++) {
          if (!a[m] && truths.every((truth, i) => truth === (!a[i] && i !== m)))
            solutions.push({ answer: a, mistaken: m });
        }
      }
      assert.deepEqual(solutions, [{ answer: p.answer, mistaken: p.mistaken }]);
      assert.deepEqual(E.generate(seed, 'hard', round), p);
    }
  }
});

void test('accusing a mistaken innocent costs two and criminals alone complete the case', () => {
  const p = E.generate(0, 'hard', 4);
  const s: JudgmentState = { puzzle: p, trust: 5, status: 'playing',
    resolved: p.people.map(() => null), revealed: p.people.map(() => true) };
  assert.equal(E.judge(s, p.mistaken!), false);
  assert.equal(s.trust, 3);
  assert.equal(s.status, 'playing');
  assert.equal(E.identity(p, p.mistaken!), '勘違いしている善人');
  p.answer.forEach((criminal, i) => { if (criminal) E.judge(s, i); });
  assert.equal(s.status, 'won');
  assert.equal(s.trust, 4);
  assert.equal(E.evaluate({ type: 'single', targets: [p.mistaken!], value: false }, p.answer), true);
});
