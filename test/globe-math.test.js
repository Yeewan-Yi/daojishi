import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, PerspectiveCamera, Vector3 } from '../vendor/three.module.js';
import { AIRCRAFT_RADIUS, ROUTE_RADIUS, SURVEY_TICK_RADIUS, SURVEY_TILT, advanceZoom, advanceExploration, aircraftBeacon, clampProgress, dampProgress, easeViewReset, explorationCameraDistance, explorationProgress, nearestAngle, percentageParts, resetPose, routePoint, routeTangent, spherePoint, useAircraftLabel } from '../globe-math.js';

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

test('an accidental large wheel event cannot enter immersion, but deliberate sustained input can', () => {
  const flick = advanceExploration(0,-2000,40);
  assert.ok(flick < .24); assert.equal(explorationProgress(flick),0);
  let deliberate = 0;
  for(let i=0;i<7;i++) deliberate=advanceExploration(deliberate,-120,40);
  assert.equal(deliberate,1);assert.equal(explorationProgress(deliberate),1);
  let trackpad=0;
  for(let i=0;i<100;i++)trackpad=advanceExploration(trackpad,-20,10);
  assert.equal(trackpad,1);
  assert.ok(advanceExploration(.5,120,40)<.5);
  assert.equal(advanceExploration(0,1000,40),0);
  assert.equal(explorationProgress(.24),0);
  assert.equal(explorationProgress(.9),1);
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

test('the complete outer survey scale fits within the canvas at every exploration zoom', () => {
  const camera=new PerspectiveCamera(35,800/660,.1,30),tilt=new Euler(...SURVEY_TILT);
  for(let step=0;step<=20;step++){
    const zoom=step/20;
    camera.position.set(0,.08,explorationCameraDistance(zoom));camera.lookAt(0,.02,0);camera.updateMatrixWorld();
    for(let i=0;i<720;i++){
      const a=i/720*Math.PI*2,p=new Vector3(Math.cos(a)*SURVEY_TICK_RADIUS,Math.sin(a)*SURVEY_TICK_RADIUS,0).applyEuler(tilt).project(camera);
      assert.ok(Math.abs(p.x)<.98 && Math.abs(p.y)<.98,`scale clipped at zoom ${zoom}: ${p.x}, ${p.y}`);
    }
  }
});

test('percentage rounds to five decimals and separates only the final three digits', () => {
  assert.deepEqual(percentageParts(2.499526), { text: '2.49953', major: '2.49', minor: '953' });
  assert.deepEqual(percentageParts(0), { text: '0.00000', major: '0.00', minor: '000' });
  assert.deepEqual(percentageParts(100), { text: '100.00000', major: '100.00', minor: '000' });
  assert.equal(percentageParts(99.999999).text, '100.00000');
  assert.equal(percentageParts(-1).text, '0.00000');
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
