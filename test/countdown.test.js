import test from 'node:test';
import assert from 'node:assert/strict';
import { getCountdown, countdownDelay, validateCountdown, encodeShare, decodeShare, defaultCountdown, toLocalInput } from '../countdown.js';

const value = { title: '下一次见面 ✨', start: '2026-10-20T02:00:00.000Z', end: '2026-10-22T02:00:00.000Z' };
test('before the start, count down to start and hold progress at zero', () => {
  assert.deepEqual(getCountdown(value, Date.parse('2026-10-19T01:59:59Z')), { phase: 'upcoming', days: 1, hours: 0, minutes: 0, seconds: 1, progress: 0 });
});
test('start boundary and mid-period progress', () => {
  assert.equal(getCountdown(value, Date.parse(value.start)).phase, 'active');
  const mid = getCountdown(value, Date.parse('2026-10-21T02:00:00Z'));
  assert.equal(mid.days, 1); assert.equal(mid.progress, 50);
});
test('end boundary and sleep recovery never show negative time', () => {
  for (const now of [Date.parse(value.end), Date.parse(value.end) + 5000000]) {
    assert.deepEqual(getCountdown(value, now), { phase: 'ended', days: 0, hours: 0, minutes: 0, seconds: 0, progress: 100 });
  }
});
test('round fractional seconds up instead of displaying zero early', () => {
  assert.equal(getCountdown(value, Date.parse(value.end) - 1).seconds, 1);
});

test('extra renders inside a visible second cannot move the percentage', () => {
  const now = Date.parse(value.start) + 1234000;
  const snapshot = getCountdown(value, now);
  for (const offset of [1, 16, 400, 999]) assert.deepEqual(getCountdown(value, now + offset), snapshot);
  const next = getCountdown(value, now + 1000);
  assert.notEqual(next.seconds, snapshot.seconds);
  assert.ok(next.progress > snapshot.progress);
});

test('fractional target timestamps schedule and sample the same countdown boundary', () => {
  const fractional = { ...value, end: '2026-10-22T02:00:00.375Z' };
  const boundary = Date.parse(fractional.end) - 10000;
  assert.deepEqual(getCountdown(fractional, boundary - 999), getCountdown(fractional, boundary - 1));
  assert.equal(countdownDelay(fractional, boundary - 250), 265);
  assert.equal(countdownDelay(fractional, boundary), 1015);
  assert.equal(getCountdown(fractional, boundary).seconds, 10);
  assert.equal(getCountdown(fractional, boundary - 1).seconds, 11);
});
test('share roundtrip preserves Chinese, emoji and absolute times', () => {
  const token = encodeShare(value);
  assert.match(token, /^[a-zA-Z0-9_-]+$/);
  assert.deepEqual(decodeShare(token), value);
});
test('reject broken, oversized, or invalid sharing payloads', () => {
  for (const token of ['hello', '@@', 'A'.repeat(2049), btoa('{}'), btoa('{"title":"ok","start":"2026-01-02","end":"2026-01-01"}')]) assert.throws(() => decodeShare(token));
});
test('validate title, dates, ordering and bounded duration', () => {
  assert.throws(() => validateCountdown({ ...value, title: ' ' }));
  assert.throws(() => validateCountdown({ ...value, title: 'x'.repeat(41) }));
  assert.throws(() => validateCountdown({ ...value, start: 'invalid' }));
  assert.throws(() => validateCountdown({ ...value, end: value.start }));
  assert.throws(() => validateCountdown({ ...value, end: '2226-01-01' }));
  assert.equal(validateCountdown({ ...value, title: '  等待  ' }).title, '等待');
});
test('same instant represented in different zones produces same countdown', () => {
  const zoned = { ...value, start: '2026-10-20T10:00:00+08:00', end: '2026-10-22T10:00:00+08:00' };
  assert.deepEqual(validateCountdown(zoned), value);
});
test('default countdown works across year boundaries and local input roundtrips', () => {
  const initial = defaultCountdown(new Date('2026-12-31T20:30:05Z'));
  assert.ok(Date.parse(initial.end) > Date.parse(initial.start));
  assert.equal(new Date(toLocalInput(initial.start)).getTime(), Date.parse(initial.start));
});
