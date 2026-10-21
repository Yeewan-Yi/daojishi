export const clampProgress = progress => Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));

export function spherePoint(longitude, latitude, radius = 1) {
  const lon = longitude * Math.PI / 180, lat = latitude * Math.PI / 180;
  return [radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon)];
}

export const ROUTE_RADIUS = 1.012;
export const AIRCRAFT_RADIUS = 1.065;
export const VIEW_RESET_DURATION = 800;

// Sphere near its center, hyperbolic sheet outside: no hard rim or pole clamp.
export function trackballPoint(x, y) {
  const distance = Math.hypot(x, y);
  const z = distance < Math.SQRT1_2 ? Math.sqrt(1 - distance * distance) : .5 / distance;
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}
// A small increase over the original 1.08 approach; zoom never changes the scene style.
export const globeCameraDistance = zoom => 4.4 - clampProgress(zoom) * 1.23;

export function easeViewReset(progress) {
  const t = clampProgress(progress);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function dampProgress(current, target, delta, rate = 9) {
  const next = current + (target - current) * (1 - Math.exp(-Math.max(0, delta) * rate));
  return Math.abs(next - target) < .0001 ? target : next;
}

export function percentageParts(progress) {
  const text = (clampProgress(progress / 100) * 100).toFixed(7);
  return { text, major: text.slice(0, -5), minor: text.slice(-5) };
}

// Keep the ground track close to the surface, independently of aircraft altitude.
export function routePoint(progress, radius = ROUTE_RADIUS) {
  const angle = clampProgress(progress) * Math.PI;
  return [-.95 * Math.cos(angle) * radius, .95 * Math.sin(angle) * radius, Math.sqrt(1 - .95 ** 2) * radius];
}

export function advanceZoom(current, wheelDelta) {
  return clampProgress(current - wheelDelta / 650);
}

function explorationStep(current, delta, elapsed) {
  const distance = Math.min(160, Math.abs(delta));
  const interval = Math.max(8, Math.min(120, elapsed));
  const limit = interval >= 32 ? .22 : interval / 1000 * (delta < 0 ? 1.8 : 2.4);
  return Math.min(distance / (delta < 0 ? 550 + current * 450 : 500), limit);
}

export function advanceExploration(current, delta, elapsed = 40) {
  const step = explorationStep(current, delta, elapsed);
  return clampProgress(current + (delta < 0 ? step : -step));
}

export function explorationInput(current, delta, elapsed = 40) {
  const step = explorationStep(current, delta, elapsed);
  const zoom = advanceExploration(current, delta, elapsed);
  // Hand the unused part of the very same gesture back to the document.
  const scroll = delta > 0 && step > 0 && zoom === 0 ? delta * Math.max(0, 1 - current / step) : 0;
  return { zoom, scroll };
}

export function useAircraftLabel(facing, previous, inside = true) {
  return !inside || facing < (previous ? .66 : .48);
}

export function aircraftBeacon(point, center, radius, visible, bounds) {
  let { x, y } = point;
  if (!visible) {
    const dx = x - center.x, dy = y - center.y, length = Math.hypot(dx, dy) || 1;
    x = center.x + dx / length * radius; y = center.y + dy / length * radius;
  }
  return { x: Math.max(bounds.left, Math.min(bounds.right, x + 30)), y: Math.max(bounds.top, Math.min(bounds.bottom, y - 30)) };
}

export function nearestAngle(angle, reference) {
  const turn = Math.PI * 2;
  return reference + ((angle - reference + Math.PI) % turn + turn) % turn - Math.PI;
}

// Equivalent orientations use the closest revolution; ease in and out without overshoot.
export function resetPose(fromYaw, fromPitch, homeYaw, homePitch, progress) {
  const t = clampProgress(progress);
  if (t === 1) return { yaw: homeYaw, pitch: homePitch };
  const eased = easeViewReset(t);
  const startYaw = nearestAngle(fromYaw, homeYaw);
  const startPitch = nearestAngle(fromPitch, homePitch);
  return { yaw: startYaw + (homeYaw - startYaw) * eased, pitch: startPitch + (homePitch - startPitch) * eased };
}

export function routeTangent(progress) {
  const angle = clampProgress(progress) * Math.PI;
  return [Math.sin(angle), Math.cos(angle), 0];
}
