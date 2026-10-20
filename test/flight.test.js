import test from 'node:test';
import assert from 'node:assert/strict';
import { flightPosition, flightStage, flightMarkup } from '../flight.js';
import { getCountdown } from '../countdown.js';

const event = { title: '一次飞行', start: '2026-10-01T00:00:00Z', end: '2026-10-11T00:00:00Z' };
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} should be ${expected}`);

test('main view and floating window each resolve their own globe and aircraft SVG references', () => {
  const allIds = new Set();
  for (const prefix of ['main', 'mini']) {
    const markup = flightMarkup(prefix);
    assert.ok(markup.includes('class="earth-land"'));
    assert.ok(!markup.includes('undefined'));
    assert.equal((markup.match(/<svg\b/g) || []).length, 1);
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    for (const id of ids) {
      assert.ok(!allIds.has(id), `duplicate SVG id: ${id}`);
      allIds.add(id);
    }
    for (const [, reference] of markup.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(reference), `unresolved SVG reference: ${reference}`);
  }
});

test('flight travels from departure through the hemisphere crown to arrival', () => {
  for (const [at, x, y, heading] of [[0,115,370,-90], [50,400,85,0], [100,685,370,90]]) {
    const point = flightPosition(at);
    closeTo(point.x, x); closeTo(point.y, y); closeTo(point.heading, heading);
  }
});

test('elapsed half of the actual countdown places the plane halfway along its route', () => {
  const value = getCountdown(event, Date.parse('2026-10-06T00:00:00Z'));
  const point = flightPosition(value.progress);
  closeTo(point.x,400); closeTo(point.y,85);
  assert.equal(value.phase,'active');
  assert.equal(flightStage(value.phase,value.progress).title,'已经飞过半程');
});

test('waiting and completed timers stay at their endpoints without looping', () => {
  const before = getCountdown(event,Date.parse('2026-09-01T00:00:00Z'));
  const after = getCountdown(event,Date.parse('2026-12-01T00:00:00Z'));
  closeTo(flightPosition(before.progress).x,115);
  closeTo(flightPosition(after.progress).x,685);
  assert.equal(flightStage(before.phase,before.progress).status,'等待起飞');
  assert.equal(flightStage(after.phase,after.progress).status,'已抵达');
});

test('the plane never leaves its route or flies backward as time advances', () => {
  let previous = 0;
  for (let progress=0;progress<=100;progress+=1) {
    const point=flightPosition(progress);
    assert.ok(point.x>=previous); previous=point.x;
    closeTo(Math.hypot(point.x-400,point.y-370),285);
    assert.ok(point.y<=370.00001);
  }
  assert.equal(flightPosition(-100).progress,0);
  assert.equal(flightPosition(500).progress,100);
  assert.equal(flightPosition(NaN).progress,0);
});
