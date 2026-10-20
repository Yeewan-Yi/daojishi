import test from 'node:test';
import assert from 'node:assert/strict';
import { formatClockParts } from '../flip-clock.js';
import { getCountdown } from '../countdown.js';

test('flip display preserves long day counts and pads the other units', () => {
  assert.deepEqual(formatClockParts({days:1425,hours:4,minutes:0,seconds:9}),['1425','04','00','09']);
});
test('loading displays placeholders rather than a fabricated time', () => {
  assert.deepEqual(formatClockParts({}),['—','—','—','—']);
});
test('minute rollover changes minutes and seconds without changing other units', () => {
  const event={start:'2026-10-20T00:00:00Z',end:'2026-10-21T00:00:00Z'};
  const before=formatClockParts(getCountdown(event,Date.parse(event.end)-61000));
  const after=formatClockParts(getCountdown(event,Date.parse(event.end)-60000));
  assert.deepEqual(before,['00','00','01','01']);
  assert.deepEqual(after,['00','00','01','00']);
  const next=formatClockParts(getCountdown(event,Date.parse(event.end)-59000));
  assert.deepEqual(next,['00','00','00','59']);
});
