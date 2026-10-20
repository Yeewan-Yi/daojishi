export const clampProgress = progress => Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));

export function spherePoint(longitude, latitude, radius = 1) {
  const lon = longitude * Math.PI / 180, lat = latitude * Math.PI / 180;
  return [radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon)];
}

export const ROUTE_RADIUS = 1.012;
export const AIRCRAFT_RADIUS = 1.065;

// Keep the ground track close to the surface, independently of aircraft altitude.
export function routePoint(progress, radius = ROUTE_RADIUS) {
  const angle = clampProgress(progress) * Math.PI;
  return [-.95 * Math.cos(angle) * radius, .95 * Math.sin(angle) * radius, Math.sqrt(1 - .95 ** 2) * radius];
}

export function advanceZoom(current, wheelDelta) {
  return clampProgress(current - wheelDelta / 650);
}

export function routeTangent(progress) {
  const angle = clampProgress(progress) * Math.PI;
  return [Math.sin(angle), Math.cos(angle), 0];
}
