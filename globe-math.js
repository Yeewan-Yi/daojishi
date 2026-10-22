export const clampProgress = progress => Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));

export function spherePoint(longitude, latitude, radius = 1) {
  const lon = longitude * Math.PI / 180, lat = latitude * Math.PI / 180;
  return [radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon)];
}

export const ROUTE_RADIUS = 1.012;
export const AIRCRAFT_RADIUS = 1.065;
export const VIEW_RESET_DURATION = 800;

// Reveal borders and shared cities as the globe approaches, without changing scenes.
export const globeCameraDistance = zoom => 4.4 - clampProgress(zoom) * 2.25;

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

// City-center coordinates; take the opposite, longer arc of the same great circle.
// GeoNames Seattle and Nanjing (1799962), rounded for a city-scale illustration.
export const JOURNEY_CITIES = Object.freeze([
  Object.freeze({ name: '西雅图', longitude: -122.3321, latitude: 47.6062 }),
  Object.freeze({ name: '南京', longitude: 118.7778, latitude: 32.0617 })
]);
const departure = spherePoint(JOURNEY_CITIES[0].longitude, JOURNEY_CITIES[0].latitude);
const destination = spherePoint(JOURNEY_CITIES[1].longitude, JOURNEY_CITIES[1].latitude);
const shortAngle = Math.acos(Math.max(-1, Math.min(1, departure.reduce((sum, v, i) => sum + v * destination[i], 0))));
const routeAngle = Math.PI * 2 - shortAngle;
const routeDirection = destination.map((v, i) => -(v - departure[i] * Math.cos(shortAngle)) / Math.sin(shortAngle));

// Constant angular speed maps elapsed time to the same fraction of surface distance.
export function routePoint(progress, radius = ROUTE_RADIUS) {
  const angle = clampProgress(progress) * routeAngle;
  return departure.map((v, i) => (v * Math.cos(angle) + routeDirection[i] * Math.sin(angle)) * radius);
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
  const angle = clampProgress(progress) * routeAngle;
  return departure.map((v, i) => -v * Math.sin(angle) + routeDirection[i] * Math.cos(angle));
}
