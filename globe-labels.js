import * as THREE from './vendor/three.module.js';
import { aircraftBeacon, percentageParts, spherePoint, useAircraftLabel } from './globe-math.js';

export function mountSurfaceProgress(world, container) {
  const longitude = -18.3, latitude = 20, width = 54, height = 18, columns = 48, rows = 16;
  const positions = [], normals = [], uvs = [], indices = [];
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
    const normal = spherePoint(longitude + (x / columns - .5) * width, latitude + (.5 - y / rows) * height);
    normals.push(...normal); positions.push(...normal.map(value => value * 1.014)); uvs.push(x / columns, 1 - y / rows);
    if (x < columns && y < rows) { const a = y * (columns + 1) + x, b = a + 1, c = a + columns + 1, d = c + 1; indices.push(a, c, b, b, c, d); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 320;
  const context = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const mesh = new THREE.Mesh(geometry, material); world.add(mesh);
  const beacon = document.createElement('div'); beacon.className = 'flight-progress-beacon'; beacon.setAttribute('aria-hidden', 'true');
  beacon.innerHTML = '<svg viewBox="0 0 24 24"><path d="m12 2 2 8 7 5v2l-8-3v6l3 2v1l-4-1-4 1v-1l3-2v-6l-8 3v-2l7-5z"/></svg><span class="beacon-number"><span></span><span class="beacon-minor"></span><span class="beacon-sign">%</span></span>';
  container.append(beacon);
  const major = beacon.querySelector('.beacon-number>span'), minor = beacon.querySelector('.beacon-minor');
  const anchor = new THREE.Vector3(...spherePoint(longitude, latitude, 1.014));
  const normal = anchor.clone().normalize(), anchorWorld = new THREE.Vector3(), normalWorld = new THREE.Vector3(), toCamera = new THREE.Vector3(), planeWorld = new THREE.Vector3();
  let signature = '', fallback = false, fontsReady = false;
  document.fonts?.ready.then(() => { fontsReady = true; signature = ''; });
  function paint(progress, color) {
    const parts = percentageParts(progress), next = `${parts.text}:${color}:${fontsReady}`;
    if (next === signature) return;
    signature = next; context.clearRect(0, 0, canvas.width, canvas.height); context.fillStyle = color;
    const sizes = [136, 98, 98], texts = [parts.major, parts.minor, '%'];
    const widths = texts.map((text, i) => { context.font = `${sizes[i]}px "IBM Plex Mono",monospace`; return context.measureText(text).width; });
    let x = (1024 - widths.reduce((sum, value) => sum + value, 0)) / 2;
    texts.forEach((text, i) => { context.font = `${sizes[i]}px "IBM Plex Mono",monospace`; context.fillText(text, x, 190); x += widths[i]; });
    context.globalAlpha = .75; context.textAlign = 'center'; context.font = '36px "Youqi Han",KaiTi,serif'; context.fillText('航程已完成', 512, 265); context.textAlign = 'start'; context.globalAlpha = 1;
    texture.needsUpdate = true; major.textContent = parts.major; minor.textContent = parts.minor;
  }
  return {
    update({ camera, plane, progress, phase, scroll, color }) {
      paint(progress, color);
      const opacity = scroll < .18 ? 1 : 0, active = phase !== 'pending' && opacity > .001;
      mesh.visible = active;
      if (!active) { beacon.style.opacity = '0'; return; }
      world.updateMatrixWorld(true); camera.updateMatrixWorld();
      anchorWorld.copy(anchor).applyMatrix4(world.matrixWorld);
      normalWorld.copy(normal).transformDirection(world.matrixWorld); toCamera.copy(camera.position).sub(anchorWorld).normalize();
      const facing = normalWorld.dot(toCamera), projected = anchorWorld.clone().project(camera);
      fallback = useAircraftLabel(facing, fallback, Math.abs(projected.x) < .86 && Math.abs(projected.y) < .82);
      material.opacity = opacity * THREE.MathUtils.smoothstep(facing, .2, .48);
      beacon.style.opacity = fallback ? String(opacity) : '0'; beacon.dataset.active = String(fallback);
      if (!fallback) return;
      plane.getWorldPosition(planeWorld);
      const planeNormal = planeWorld.clone().normalize(), planeFacing = planeNormal.dot(toCamera.copy(camera.position).sub(planeWorld).normalize());
      const p = planeWorld.clone().project(camera), center = new THREE.Vector3().project(camera);
      const edge = new THREE.Vector3(1, 0, 0).project(camera), rect = container.getBoundingClientRect(), scale = rect.width / container.clientWidth;
      const width = container.clientWidth, height = container.clientHeight, half = innerWidth < 520 ? 80 : 104;
      const left = Math.max(half + 8, (12 - rect.left) / scale + half), right = Math.min(width - half - 8, (innerWidth - 12 - rect.left) / scale - half);
      const top = Math.max(24, (16 - rect.top) / scale + 24), bottom = Math.min(height - 24, (innerHeight - 16 - rect.top) / scale - 24);
      const position = aircraftBeacon({ x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 }, { x: (center.x + 1) * width / 2, y: (1 - center.y) * height / 2 }, Math.abs(edge.x - center.x) * width * .49, planeFacing > .08, { left, right: Math.max(left, right), top, bottom: Math.max(top, bottom) });
      beacon.style.left = `${position.x}px`; beacon.style.top = `${position.y}px`; beacon.style.color = color;
      beacon.dataset.occluded = String(planeFacing <= .08);
    },
    refresh() { signature = ''; },
    mesh
  };
}
