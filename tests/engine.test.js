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
function state() { const puzzle = E.generate(333, 'normal'); return { puzzle, resolved: puzzle.people.map(() => null), lives: 3, status: 'playing' }; }
test('correct judgments resolve one person immediately and win with lives remaining', () => {
  const s = state();
  s.puzzle.answer.forEach((answer, i) => assert.equal(E.judge(s, i, answer), true));
  assert.equal(s.status, 'won'); assert.equal(s.lives, 3);
  assert.equal(E.judge(s, 0, true), null);
});
test('wrong judgment reveals identity once; third mistake ends game', () => {
  const s = state();
  assert.equal(E.judge(s, 0, !s.puzzle.answer[0]), false);
  assert.equal(s.lives, 2); assert.equal(s.status, 'playing');
  assert.equal(E.judge(s, 0, s.puzzle.answer[0]), null); assert.equal(s.lives, 2);
  E.judge(s, 1, !s.puzzle.answer[1]); E.judge(s, 2, !s.puzzle.answer[2]);
  assert.equal(s.lives, 0); assert.equal(s.status, 'lost');
  assert.equal(E.judge(s, 3, s.puzzle.answer[3]), null);
});
test('last incorrect judgment wins only when a life remains', () => {
  const s = state();
  for (let i = 0; i < 4; i++) E.judge(s, i, s.puzzle.answer[i]);
  E.judge(s, 4, !s.puzzle.answer[4]);
  assert.equal(s.status, 'won'); assert.equal(s.lives, 2);
  const t = state();
  for (let i = 0; i < 5; i++) E.judge(t, i, i % 2 === 0 ? !t.puzzle.answer[i] : t.puzzle.answer[i]);
  assert.equal(t.status, 'lost'); assert.equal(t.lives, 0);
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
