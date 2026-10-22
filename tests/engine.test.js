'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

test('3,000 generated cases have exactly one solution and obey every role', () => {
  for (const [level, config] of Object.entries(E.levels)) {
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
      });
    }
  }
});
test('same seed reproduces the case, different seeds vary it', () => {
  for (const level of Object.keys(E.levels)) {
    assert.deepEqual(E.generate(4294967295, level), E.generate(4294967295, level));
    const cases = new Set(Array.from({ length: 100 }, (_, i) => JSON.stringify(E.generate(i, level).statements)));
    assert.ok(cases.size > 90);
  }
});
function state(level = 'normal') { const puzzle = E.generate(333, level); return { puzzle, resolved: puzzle.people.map(() => null), trust: E.initialTrust, status: 'playing' }; }
test('correct judgments add trust exactly once and finish with ten trust', () => {
  const s = state();
  assert.equal(s.trust, 5);
  s.puzzle.answer.forEach((answer, i) => {
    assert.equal(E.judge(s, i, answer), true);
    assert.equal(s.trust, 6 + i);
    assert.equal(E.judge(s, i, answer), null);
    assert.equal(s.trust, 6 + i);
  });
  assert.equal(s.status, 'won');
  assert.equal(s.trust, 10);
});
test('incorrect judgments deduct two, clamp to zero, and stop after the third mistake', () => {
  const s = state('hard');
  for (let i = 0; i < 3; i++) {
    assert.equal(E.judge(s, i, !s.puzzle.answer[i]), false);
    assert.equal(s.trust, [3, 1, 0][i]);
    assert.equal(s.status, i === 2 ? 'lost' : 'playing');
    assert.equal(E.judge(s, i, s.puzzle.answer[i]), null);
  }
  assert.equal(E.judge(s, 3, s.puzzle.answer[3]), null);
  assert.equal(s.trust, 0);
});
test('correct answers recover trust and losses also occur at exactly zero', () => {
  const s = state();
  E.judge(s, 0, !s.puzzle.answer[0]);
  E.judge(s, 1, !s.puzzle.answer[1]);
  assert.equal(s.trust, 1);
  E.judge(s, 2, s.puzzle.answer[2]);
  assert.equal(s.trust, 2);
  E.judge(s, 3, !s.puzzle.answer[3]);
  assert.equal(s.status, 'lost');
  assert.equal(s.trust, 0);
  const t = state();
  for (let i = 0; i < 4; i++) E.judge(t, i, t.puzzle.answer[i]);
  E.judge(t, 4, !t.puzzle.answer[4]);
  assert.equal(t.status, 'won');
  assert.equal(t.trust, 7);
});
test('final wrong judgment loses when it exhausts trust', () => {
  const s = state('easy');
  E.judge(s, 0, !s.puzzle.answer[0]);
  E.judge(s, 1, s.puzzle.answer[1]);
  E.judge(s, 2, !s.puzzle.answer[2]);
  E.judge(s, 3, !s.puzzle.answer[3]);
  assert.equal(s.trust, 0);
  assert.equal(s.status, 'lost');
});
test('all statement polarities and count boundaries are evaluated correctly', () => {
  assert.equal(E.evaluate({ type:'count', targets:[0,1,2], value:0 }, [false,false,false]), true);
  assert.equal(E.evaluate({ type:'count', targets:[0,1,2], value:3 }, [true,true,true]), true);
  assert.equal(E.evaluate({ type:'ordered', targets:[0,1], value:false }, [true,true]), true);
  assert.equal(E.evaluate({ type:'ordered', targets:[0,1], value:false }, [true,false]), false);
  assert.equal(E.evaluate({ type:'both', targets:[0,1], value:false }, [true,false]), true);
  assert.equal(E.evaluate({ type:'parity', targets:[0,1,2], value:false }, [false,false,false]), true);
  assert.throws(() => E.generate(0, 'unknown'));
});
