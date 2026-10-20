export const clampProgress = progress => Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));

export function spherePoint(longitude, latitude, radius = 1) {
  const lon = longitude * Math.PI / 180, lat = latitude * Math.PI / 180;
  return [radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon)];
}

// A raised small-circle route stays on the same sphere at every progress value.
export function routePoint(progress, radius = 1.075) {
  const angle = clampProgress(progress) * Math.PI;
  return [-.95 * Math.cos(angle) * radius, .95 * Math.sin(angle) * radius, Math.sqrt(1 - .95 ** 2) * radius];
}

export function routeTangent(progress) {
  const angle = clampProgress(progress) * Math.PI;
  return [Math.sin(angle), Math.cos(angle), 0];
}
