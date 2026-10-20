import test from 'node:test';
import assert from 'node:assert/strict';
import { clampProgress, routePoint, routeTangent, spherePoint } from '../globe-math.js';

const close = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} should equal ${expected}`);

test('the 3D plane stays at the same altitude over the entire spherical journey', () => {
  for (let i = 0; i <= 1000; i++) {
    const point = routePoint(i / 1000);
    close(Math.hypot(...point), 1.075);
    assert.ok(point[2] > 0);
  }
  close(routePoint(0)[0], -routePoint(1)[0]);
  close(routePoint(.5)[0], 0);
  assert.ok(routePoint(.5)[1] > routePoint(0)[1]);
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
