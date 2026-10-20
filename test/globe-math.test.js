import test from 'node:test';
import assert from 'node:assert/strict';
import { AIRCRAFT_RADIUS, ROUTE_RADIUS, advanceZoom, clampProgress, nearestAngle, resetPose, routePoint, routeTangent, spherePoint } from '../globe-math.js';

const close = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} should equal ${expected}`);

test('ground track hugs the globe while the plane retains a separate constant altitude', () => {
  for (let i = 0; i <= 1000; i++) {
    const point = routePoint(i / 1000);
    close(Math.hypot(...point), ROUTE_RADIUS);
    close(Math.hypot(...routePoint(i / 1000, AIRCRAFT_RADIUS)), AIRCRAFT_RADIUS);
    assert.ok(point[2] > 0);
  }
  close(routePoint(0)[0], -routePoint(1)[0]);
  close(routePoint(.5)[0], 0);
  assert.ok(routePoint(.5)[1] > routePoint(0)[1]);
  assert.ok(ROUTE_RADIUS > 1 && ROUTE_RADIUS < 1.02);
  assert.ok(AIRCRAFT_RADIUS > ROUTE_RADIUS);
});

test('reverse scrolling increases zoom and forward scrolling restores it within limits', () => {
  close(advanceZoom(0, -325), .5);
  close(advanceZoom(.5, 325), 0);
  assert.equal(advanceZoom(.9, -1000), 1);
  assert.equal(advanceZoom(.1, 1000), 0);
  assert.equal(advanceZoom(.5, 0), .5);
});

test('reset takes at most half a turn even after many rotations in either direction', () => {
  const home = .32;
  for (const turns of [-100, -7, -1, 0, 1, 9, 100]) for (const offset of [-3.13, -.8, 0, .8, 3.13]) {
    const actual = home + turns * Math.PI * 2 + offset;
    const closest = nearestAngle(actual, home);
    close(closest, home + offset);
    close(Math.cos(actual), Math.cos(closest));
    close(Math.sin(actual), Math.sin(closest));
    assert.ok(Math.abs(closest - home) <= Math.PI);
    assert.deepEqual(resetPose(actual, -.6, home, .12, 1), { yaw: home, pitch: .12 });
  }
});

test('reset eases away and settles without overshoot, and can restart from its visible pose', () => {
  const from = .32 + 12 * Math.PI + 2;
  let previous = Infinity;
  for (let step = 0; step <= 100; step++) {
    const pose = resetPose(from, -.6, .32, .12, step / 100);
    const distance = Math.abs(pose.yaw - .32);
    assert.ok(distance <= previous + 1e-9);
    assert.ok(pose.yaw >= .32 && pose.yaw <= 2.32 + 1e-9);
    assert.ok(pose.pitch >= -.6 && pose.pitch <= .12);
    previous = distance;
  }
  assert.ok(2.32 - resetPose(from, -.6, .32, .12, .01).yaw < .0001);
  assert.ok(resetPose(from, -.6, .32, .12, .99).yaw - .32 < .0001);
  const visible = resetPose(from, -.6, .32, .12, .4);
  const restart = resetPose(visible.yaw, visible.pitch, .32, .12, 0);
  close(restart.yaw, visible.yaw); close(restart.pitch, visible.pitch);
});

test('the aircraft heading follows the route and is perpendicular to the surface normal', () => {
  for (let i = 0; i <= 100; i++) {
    const t = i / 100, point = routePoint(t, 1), tangent = routeTangent(t);
    close(Math.hypot(...tangent), 1);
    close(point.reduce((sum, v, j) => sum + v * tangent[j], 0), 0);
    if (t < 1) {
      const next = routePoint(t + .00001, 1);
      assert.ok(next.reduce((sum, v, j) => sum + (v - point[j]) * tangent[j], 0) > 0);
    }
  }
});

test('waiting, arrival and malformed values never move the plane beyond the endpoints', () => {
  assert.deepEqual(routePoint(-1), routePoint(0));
  assert.deepEqual(routePoint(2), routePoint(1));
  assert.deepEqual(routePoint(NaN), routePoint(0));
  assert.equal(clampProgress(Infinity), 0);
});

test('longitude and latitude map onto one sphere without a gap at the date line', () => {
  for (let lat = -90; lat <= 90; lat += 15) {
    const left = spherePoint(-180, lat), right = spherePoint(180, lat);
    left.forEach((v, i) => close(v, right[i]));
    close(Math.hypot(...left), 1);
  }
  close(spherePoint(0, 90)[1], 1);
  close(spherePoint(0, -90)[1], -1);
});
