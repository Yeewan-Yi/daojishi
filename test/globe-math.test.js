import test from 'node:test';
import assert from 'node:assert/strict';
import { AIRCRAFT_RADIUS, ROUTE_RADIUS, advanceZoom, advanceExploration, explorationInput, aircraftBeacon, clampProgress, dampProgress, easeViewReset, globeCameraDistance, nearestAngle, percentageParts, resetPose, routePoint, routeTangent, spherePoint, useAircraftLabel } from '../globe-math.js';

const close = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} should equal ${expected}`);

test('the gesture that finishes shrinking immediately hands its unused distance to page scrolling', () => {
  assert.deepEqual(explorationInput(.5, 100), {zoom:.3, scroll:0});
  const boundary = explorationInput(.1, 100);
  close(boundary.zoom, 0); close(boundary.scroll, 50);
  assert.deepEqual(explorationInput(0, 100), {zoom:0, scroll:100});
  assert.equal(explorationInput(0, -100).scroll, 0);
  let zoom = 1, distance = 0;
  for (let i = 0; i < 10; i++) { const next = explorationInput(zoom, 120); zoom = next.zoom; distance += next.scroll; }
  assert.equal(zoom, 0); assert.ok(distance > 500);
});

test('ground track hugs the globe while the plane retains a separate constant altitude', () => {
  for (let i = 0; i <= 1000; i++) {
    const point = routePoint(i / 1000);
    close(Math.hypot(...point), ROUTE_RADIUS);
    close(Math.hypot(...routePoint(i / 1000, AIRCRAFT_RADIUS)), AIRCRAFT_RADIUS);
  }
  spherePoint(-122.3321, 47.6062, ROUTE_RADIUS).forEach((value,i)=>close(routePoint(0)[i],value));
  spherePoint(118.7778, 32.0617, ROUTE_RADIUS).forEach((value,i)=>close(routePoint(1)[i],value));
  assert.ok(routePoint(.5)[2] > .4, 'the long arc must pass the opposite side of the globe');
  assert.ok(routePoint(.5)[1] < -.5, 'the reverse direction must traverse the southern hemisphere');
  assert.ok(ROUTE_RADIUS > 1 && ROUTE_RADIUS < 1.02);
  assert.ok(AIRCRAFT_RADIUS > ROUTE_RADIUS);
});

test('the reversed journey travels the long arc at constant surface speed and still reaches Nanjing', () => {
  const angle = (a,b) => Math.acos(Math.max(-1,Math.min(1,a.reduce((sum,v,i)=>sum+v*b[i],0))));
  const shortLength = angle(routePoint(0,1),routePoint(1,1));
  const length = Math.PI * 2 - shortLength;
  assert.ok(length > Math.PI && length > shortLength * 2);
  for(let i=0;i<100;i++) close(angle(routePoint(i/100,1),routePoint((i+1)/100,1)),length/100,1e-10);
  close(angle(routePoint(0,1),routePoint(.5,1)),length/2);
  const firstStep = routePoint(.01,1);
  assert.ok(firstStep[1] < routePoint(0,1)[1], 'departure must head away from the former North Pacific route');
});

test('reverse scrolling increases zoom and forward scrolling restores it within limits', () => {
  close(advanceZoom(0, -325), .5);
  close(advanceZoom(.5, 325), 0);
  assert.equal(advanceZoom(.9, -1000), 1);
  assert.equal(advanceZoom(.1, 1000), 0);
  assert.equal(advanceZoom(.5, 0), .5);
});

test('a single wheel flick cannot fully zoom, while sustained wheel and trackpad input can', () => {
  const flick = advanceExploration(0,-2000,40);
  assert.ok(flick > 0 && flick < .24);
  let deliberate = 0;
  for(let i=0;i<7;i++) deliberate=advanceExploration(deliberate,-120,40);
  assert.equal(deliberate,1);
  let trackpad=0;
  for(let i=0;i<100;i++)trackpad=advanceExploration(trackpad,-20,10);
  assert.equal(trackpad,1);
  assert.ok(advanceExploration(.5,120,40)<.5);
  assert.equal(advanceExploration(0,1000,40),0);
});

test('surface progress switches before the limb and uses hysteresis to avoid flicker', () => {
  assert.equal(useAircraftLabel(.9,false),false);
  assert.equal(useAircraftLabel(.47,false),true);
  assert.equal(useAircraftLabel(.6,true),true);
  assert.equal(useAircraftLabel(.67,true),false);
  assert.equal(useAircraftLabel(-.5,false),true);
  assert.equal(useAircraftLabel(.9,false,false),true);
});

test('aircraft labels remain in view even when the aircraft passes behind the globe', () => {
  const bounds={left:80,right:720,top:30,bottom:570},center={x:400,y:300};
  for(const visible of [true,false])for(const point of [{x:-200,y:-900},{x:3000,y:1000},{x:400,y:300}]) {
    const label=aircraftBeacon(point,center,240,visible,bounds);
    assert.ok(label.x>=bounds.left && label.x<=bounds.right);
    assert.ok(label.y>=bounds.top && label.y<=bounds.bottom);
    assert.ok(Number.isFinite(label.x+label.y));
  }
});

test('simple zoom approaches continuously with a slightly larger bounded maximum', () => {
  close(globeCameraDistance(0), 4.4); close(globeCameraDistance(1), 3.17);
  close(globeCameraDistance(2), 3.17); close(globeCameraDistance(-1), 4.4);
  for (let i=1;i<=100;i++) assert.ok(globeCameraDistance(i/100)<globeCameraDistance((i-1)/100));
});

test('percentage rounds to seven decimals and keeps the first two decimals full size', () => {
  assert.deepEqual(percentageParts(2.49952618), { text: '2.4995262', major: '2.49', minor: '95262' });
  assert.deepEqual(percentageParts(0), { text: '0.0000000', major: '0.00', minor: '00000' });
  assert.deepEqual(percentageParts(100), { text: '100.0000000', major: '100.00', minor: '00000' });
  assert.equal(percentageParts(99.99999999).text, '100.0000000');
  assert.equal(percentageParts(-1).text, '0.0000000');
});

test('scroll damping converges without overshoot and behaves the same at different frame rates', () => {
  const follow = fps => { let current = 0; for(let i=0;i<fps/2;i++) current=dampProgress(current,1,1/fps); return current; };
  close(follow(30),follow(60));close(follow(60),follow(120));
  assert.ok(follow(60)>.98 && follow(60)<1);
  let current = .9;
  for(let i=0;i<120;i++) {const next=dampProgress(current,0,1/60);assert.ok(next<=current && next>=0);current=next;}
  assert.equal(current,0);
  close(easeViewReset(0),0);close(easeViewReset(1),1);
  close(easeViewReset(.3),1-easeViewReset(.7));
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

test('reset wraps both axes after crossing the poles many times without changing the visible pose', () => {
  const homeYaw = .32, homePitch = .12;
  for (const turns of [-100, -9, -1, 1, 7, 100]) for (const offset of [-3.13, -.8, 0, .8, 3.13]) {
    const fromYaw = homeYaw - turns * Math.PI * 2 - offset;
    const fromPitch = homePitch + turns * Math.PI * 2 + offset;
    const start = resetPose(fromYaw, fromPitch, homeYaw, homePitch, 0);
    close(Math.cos(start.pitch), Math.cos(fromPitch));
    close(Math.sin(start.pitch), Math.sin(fromPitch));
    close(start.pitch, homePitch + offset);
    let previous = Infinity;
    for (let step = 0; step <= 100; step++) {
      const pose = resetPose(fromYaw, fromPitch, homeYaw, homePitch, step / 100);
      const distance = Math.abs(pose.pitch - homePitch);
      assert.ok(distance <= Math.PI && distance <= previous + 1e-9);
      previous = distance;
    }
    const halfway = resetPose(fromYaw, fromPitch, homeYaw, homePitch, .5);
    const restart = resetPose(halfway.yaw, halfway.pitch, homeYaw, homePitch, 0);
    close(restart.yaw, halfway.yaw); close(restart.pitch, halfway.pitch);
    assert.deepEqual(resetPose(fromYaw, fromPitch, homeYaw, homePitch, 1), {yaw:homeYaw, pitch:homePitch});
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
