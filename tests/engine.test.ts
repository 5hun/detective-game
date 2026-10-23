'use strict';
import { test } from 'node:test';
import assert = require('node:assert/strict');
const E: typeof DetectiveEngine = require('../engine.js');

test('3,000 generated cases have exactly one solution and obey every role', () => {
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
          const truth = s.type === 'count' ? count === s.value : propositions[s.type] === s.value;
          return truth !== a[i];
        });
        if (valid) solutions.push(a);
      }
      assert.deepEqual(solutions, [p.answer], `${level} seed=${seed}`);
      p.statements.forEach((s, i) => {
        assert.equal(s.type, p.people[i].type);
        assert.ok(!s.targets.includes(i));
        assert.equal(new Set(s.targets).size, s.targets.length);
        assert.ok(s.targets.every(t => t >= 0 && t < config.n));
        assert.equal(E.evaluate(s, p.answer), !p.answer[i]);
        assert.ok(E.statementText(s, p.people).endsWith('。'));
        assert.doesNotMatch(E.statementText(s, p.people), /ない|なかった|ません|ぬ|ではなく/);
      });
    }
  }
});
test('same seed reproduces the case, different seeds vary it', () => {
  for (const level of Object.keys(E.levels) as Level[]) {
    assert.deepEqual(E.generate(4294967295, level), E.generate(4294967295, level));
    const cases = new Set(Array.from({ length: 100 }, (_, i) => JSON.stringify(E.generate(i, level).statements)));
    assert.ok(cases.size > 90);
  }
});
function state(level: Level = 'normal'): JudgmentState { const puzzle = E.generate(333, level); return { puzzle, revealed: puzzle.people.map(() => true), resolved: puzzle.people.map(() => null), trust: E.initialTrust, status: 'playing' }; }
test('only criminals need judgment at every difficulty', () => {
  for (const level of Object.keys(E.levels) as Level[]) {
    const s = state(level);
    const criminals = s.puzzle.answer.flatMap((liar, i) => liar ? [i] : []);
    criminals.forEach((index, j) => {
      assert.equal(E.judge(s, index), true);
      assert.equal(s.trust, 6 + j);
      assert.equal(s.status, j === criminals.length - 1 ? 'won' : 'playing');
      assert.equal(E.judge(s, index), null);
    });
    assert.equal(s.resolved.filter(Boolean).length, criminals.length);
    assert.equal(E.judge(s, s.puzzle.answer.indexOf(false)), null);
  }
});
test('three incorrect accusations lose and cannot be repeated', () => {
  const s = state('hard');
  const innocents = s.puzzle.answer.flatMap((liar, i) => liar ? [] : [i]);
  innocents.slice(0, 3).forEach((index, j) => {
    assert.equal(E.judge(s, index), false);
    assert.equal(s.trust, [3, 1, 0][j]);
    assert.equal(s.status, j === 2 ? 'lost' : 'playing');
    assert.equal(E.judge(s, index), null);
  });
  assert.equal(E.judge(s, s.puzzle.answer.indexOf(true)), null);
});
test('correct accusation recovers trust and a later mistake exhausts it exactly', () => {
  const s = state('hard');
  const innocents = s.puzzle.answer.flatMap((liar, i) => liar ? [] : [i]);
  E.judge(s, innocents[0]);
  E.judge(s, innocents[1]);
  E.judge(s, s.puzzle.answer.indexOf(true));
  assert.equal(s.trust, 2);
  E.judge(s, innocents[2]);
  assert.equal(s.status, 'lost');
  assert.equal(s.trust, 0);
});
test('finding all criminals wins after an incorrect accusation', () => {
  const s = state();
  E.judge(s, s.puzzle.answer.indexOf(false));
  s.puzzle.answer.forEach((liar, i) => { if (liar) E.judge(s, i); });
  assert.equal(s.status, 'won');
  assert.equal(s.trust, 3 + s.puzzle.k);
});
test('all statement polarities and count boundaries are evaluated correctly', () => {
  assert.equal(E.evaluate({ type:'count', targets:[0,1,2], value:0 }, [false,false,false]), true);
  assert.equal(E.evaluate({ type:'count', targets:[0,1,2], value:3 }, [true,true,true]), true);
  assert.equal(E.evaluate({ type:'ordered', targets:[0,1], value:false }, [true,true]), true);
  assert.equal(E.evaluate({ type:'ordered', targets:[0,1], value:false }, [true,false]), false);
  assert.equal(E.evaluate({ type:'both', targets:[0,1], value:false }, [true,false]), true);
  assert.equal(E.evaluate({ type:'parity', targets:[0,1,2], value:false }, [false,false,false]), true);
  assert.throws(() => E.generate(0, 'unknown' as Level));
});

test('correct arrest before hearing that testimony earns two trust', () => {
  const s = state('hard');
  const criminals = s.puzzle.answer.flatMap((liar, i) => liar ? [i] : []);
  s.revealed[criminals[0]] = false;
  assert.equal(E.judge(s, criminals[0]), true);
  assert.equal(s.trust, 7);
  assert.equal(E.judge(s, criminals[0]), null);
  assert.equal(s.trust, 7);
  assert.equal(E.judge(s, criminals[1]), true);
  assert.equal(s.trust, 8);
});
test('incorrect arrest before testimony still loses two trust', () => {
  const s = state();
  s.revealed.fill(false);
  assert.equal(E.judge(s, s.puzzle.answer.indexOf(false)), false);
  assert.equal(s.trust, 3);
});

test('affirmative wording preserves the meaning of complementary statements', () => {
  const cases: { type: 'any' | 'both' | 'ordered'; text: string; truth: (a: boolean, b: boolean) => boolean }[] = [
    { type: 'any', text: 'キツネとウサギは、両方とも善人だ。', truth: (a, b) => !a && !b },
    { type: 'both', text: 'キツネとウサギのうち、少なくとも1匹は善人だ。', truth: (a, b) => !a || !b },
    { type: 'ordered', text: '「キツネが善人」「ウサギが犯人」の少なくとも一方が当てはまる。', truth: (a, b) => !a || b }
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
