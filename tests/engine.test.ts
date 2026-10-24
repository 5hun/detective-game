'use strict';
import { test } from 'node:test';
import assert = require('node:assert/strict');
const E: typeof DetectiveEngine = require('../engine.js');

test('3,000 generated cases include the actual answer and obey every role', () => {
  for (const [level, config] of (Object.entries(E.levels) as [Level, (typeof E.levels)[Level]][])) {
    let ambiguousCases = 0;
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
      if (solutions.length > 1) ambiguousCases++;
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
    assert.ok(ambiguousCases > 0, `${level} should allow ambiguous testimony`);
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
      assert.equal(s.trust, j === criminals.length - 1 ? 6 : 5);
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
    assert.equal(s.trust, [3, 1, -1][j]);
    assert.equal(s.status, j === 2 ? 'lost' : 'playing');
    assert.equal(E.judge(s, index), null);
  });
  assert.equal(E.judge(s, s.puzzle.answer.indexOf(true)), null);
});
test('correct accusation after testimony does not recover trust', () => {
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
test('finding all criminals wins after an incorrect accusation', () => {
  const s = state();
  E.judge(s, s.puzzle.answer.indexOf(false));
  s.puzzle.answer.forEach((liar, i) => { if (liar) E.judge(s, i); });
  assert.equal(s.status, 'won');
  assert.equal(s.trust, 4);
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

test('correct arrest before hearing that testimony earns one trust', () => {
  const s = state('hard');
  const criminals = s.puzzle.answer.flatMap((liar, i) => liar ? [i] : []);
  s.revealed[criminals[0]] = false;
  assert.equal(E.judge(s, criminals[0]), true);
  assert.equal(s.trust, 6);
  assert.equal(E.judge(s, criminals[0]), null);
  assert.equal(s.trust, 6);
  assert.equal(E.judge(s, criminals[1]), true);
  assert.equal(s.trust, 6);
});
test('incorrect arrest before testimony still loses two trust', () => {
  const s = state();
  s.revealed.fill(false);
  assert.equal(E.judge(s, s.puzzle.answer.indexOf(false)), false);
  assert.equal(s.trust, 3);
});

test('affirmative wording preserves the meaning of complementary statements', () => {
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

test('ambiguous cases judge the fixed truth even when an alternative fits testimony', () => {
  for (const level of Object.keys(E.levels) as Level[]) {
    const s = state(level);
    for (let seed = 0; seed < 1000; seed++) {
      s.puzzle = E.generate(seed, level);
      if (E.solve(s.puzzle).length > 1) break;
    }
    const alternative = E.solve(s.puzzle).find(a => a.some((liar, i) => liar !== s.puzzle.answer[i]));
    assert.ok(alternative, `${level} should have an alternative`);
    const innocent = alternative.findIndex((liar, i) => liar && !s.puzzle.answer[i]);
    assert.equal(E.judge(s, innocent), false);
    assert.equal(s.trust, 3);
    assert.equal(s.status, 'playing');
    s.puzzle.answer.forEach((liar, i) => { if (liar) E.judge(s, i); });
    assert.equal(s.status, 'won');
  }
});


test('difficulty-specific campaigns grow in size and preserve valid testimony at every starting level', () => {
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
        assert.ok(p.statements.every((statement, i) => E.evaluate(statement, p.answer) !== p.answer[i]));
        assert.ok(E.solve(p).some(a => a.every((value, i) => value === p.answer[i])));
      }
      previous = config;
    }
  }
  for (const round of [0, 6, 1.5, NaN]) assert.throws(() => E.generate(1, 'normal', round));
});


test('paid testimony appears only in later hard cases with bounded costs', () => {
  const paidRoles = new Set<string>();
  for (const level of ['easy', 'normal', 'hard'] as Level[]) {
    for (let round = 1; round <= E.totalCases(level); round++) {
      for (let seed = 0; seed < 100; seed++) {
        const p = E.generate(seed, level, round);
        assert.equal(p.testimonyCosts.length, p.people.length);
        if (level === 'hard' && round >= 4) {
          assert.ok(p.testimonyCosts.filter(Boolean).length >= 1);
          assert.ok(p.testimonyCosts.filter(Boolean).length <= 4);
          assert.ok(p.testimonyCosts.filter(c => c === 2).length <= (round === 4 ? 0 : round === 5 ? 1 : 2));
        }
        p.testimonyCosts.forEach((cost, i) => {
          assert.ok(cost === 0 || cost === 1 || cost === 2);
          if (level !== 'hard' || round < 4) assert.equal(cost, 0);
          if (cost) paidRoles.add(p.people[i].id);
        });
      }
    }
  }
  assert.equal(paidRoles.size, E.roles.length);
});

test('paid testimony allows zero funds, rejects insufficient funds, and charges once', () => {
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

test('zero funds allow continued investigation and case completion', () => {
  const s = state('hard');
  s.trust = 2;
  E.judge(s, s.puzzle.answer.indexOf(false));
  assert.equal(s.trust, 0);
  assert.equal(s.status, 'playing');
  s.puzzle.answer.forEach((liar, i) => { if (liar) E.judge(s, i); });
  assert.equal(s.status, 'won');
  assert.equal(s.trust, 1);
});

test('an incorrect accusation at zero funds ends the investigation', () => {
  const s = state();
  s.trust = 0;
  E.judge(s, s.puzzle.answer.indexOf(false));
  assert.equal(s.trust, -2);
  assert.equal(s.status, 'lost');
});
