export const clampProgress = progress => Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));

export function spherePoint(longitude, latitude, radius = 1) {
  const lon = longitude * Math.PI / 180, lat = latitude * Math.PI / 180;
  return [radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon)];
}

export const ROUTE_RADIUS = 1.012;
export const AIRCRAFT_RADIUS = 1.065;
export const VIEW_RESET_DURATION = 800;

export function easeViewReset(progress) {
  const t = clampProgress(progress);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function dampProgress(current, target, delta, rate = 9) {
  const next = current + (target - current) * (1 - Math.exp(-Math.max(0, delta) * rate));
  return Math.abs(next - target) < .0001 ? target : next;
}

export function percentageParts(progress) {
  const text = (clampProgress(progress / 100) * 100).toFixed(5);
  return { text, major: text.slice(0, -3), minor: text.slice(-3) };
}

// Keep the ground track close to the surface, independently of aircraft altitude.
export function routePoint(progress, radius = ROUTE_RADIUS) {
  const angle = clampProgress(progress) * Math.PI;
  return [-.95 * Math.cos(angle) * radius, .95 * Math.sin(angle) * radius, Math.sqrt(1 - .95 ** 2) * radius];
}

export function advanceZoom(current, wheelDelta) {
  return clampProgress(current - wheelDelta / 650);
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
  return { yaw: startYaw + (homeYaw - startYaw) * eased, pitch: fromPitch + (homePitch - fromPitch) * eased };
}

export function routeTangent(progress) {
  const angle = clampProgress(progress) * Math.PI;
  return [Math.sin(angle), Math.cos(angle), 0];
}
