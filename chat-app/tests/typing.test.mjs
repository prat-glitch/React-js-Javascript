import test from 'node:test';
import assert from 'node:assert/strict';
import { createTypingSession, typingLabel } from '../lib/typing.js';

function clock() {
  let time = 0, next = 0;
  const timers = new Map();
  return {
    now: () => time,
    setTimer: (callback, delay) => { timers.set(++next, { at: time + delay, callback }); return next; },
    clearTimer: (id) => timers.delete(id),
    advance(ms) {
      const until = time + ms;
      while (true) {
        const due = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        time = due[1].at; timers.delete(due[0]); due[1].callback();
      }
      time = until;
    },
  };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('typing starts immediately, throttles bursts, renews during typing and stops after idle', async () => {
  const c = clock(), sent = [];
  const session = createTypingSession({ ...c, publish: (value) => sent.push(value) });
  session.activity(true); await flush();
  assert.deepEqual(sent, [true]);
  for (let i = 0; i < 19; i++) { c.advance(100); session.activity(true); }
  await flush(); assert.deepEqual(sent, [true]);
  c.advance(100); session.activity(true); await flush();
  assert.deepEqual(sent, [true, true]);
  c.advance(2999); await flush(); assert.deepEqual(sent, [true, true]);
  c.advance(1); await flush(); assert.deepEqual(sent, [true, true, false]);
  session.activity(true); await flush(); assert.equal(sent.at(-1), true);
  session.dispose(); await flush(); assert.equal(sent.at(-1), false);
});

test('clearing, sending, blur and disposal stop activity without duplicate stops', async () => {
  const c = clock(), sent = [];
  const session = createTypingSession({ ...c, publish: (value) => sent.push(value) });
  session.activity(false); await flush(); assert.deepEqual(sent, []);
  session.activity(true); session.activity(false); session.stop();
  c.advance(5000); await flush(); assert.deepEqual(sent, [true, false]);
  session.activity(true); session.dispose(); session.activity(true);
  c.advance(5000); await flush(); assert.deepEqual(sent, [true, false, true, false]);
});

test('slow and failed requests cannot reorder a stop or affect later sessions', async () => {
  const sent = []; let release;
  const session = createTypingSession({ publish: async (value) => {
    sent.push(value);
    if (value) await new Promise((resolve) => { release = resolve; });
    else throw new Error('offline');
  } });
  session.activity(true); await flush(); session.stop();
  await flush(); assert.deepEqual(sent, [true]);
  release(); await flush(); assert.deepEqual(sent, [true, false]);
  session.dispose();
  const next = createTypingSession({ publish: (value) => sent.push(value) });
  next.activity(true); next.dispose(); await flush();
  assert.deepEqual(sent, [true, false, true, false]);
});

test('typing labels handle one, two and several members', () => {
  assert.equal(typingLabel([]), '');
  assert.equal(typingLabel(['Alice']), 'Alice is typing…');
  assert.equal(typingLabel(['Alice', 'Bob']), 'Alice and Bob are typing…');
  assert.equal(typingLabel(['Alice', 'Bob', 'Cara']), 'Alice, Bob and 1 other are typing…');
  assert.equal(typingLabel(['Alice', 'Bob', 'Cara', 'Dan']), 'Alice, Bob and 2 others are typing…');
});
