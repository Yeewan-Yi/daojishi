import * as THREE from './vendor/three.module.js';
import { clampProgress, spherePoint, routePoint, routeTangent } from './globe-math.js';

const lightPalette = { ocean: '#e7eee3', land: '#b1c4a5', coast: '#a2b799', grid: '#b0c0a5', route: '#506f50', future: '#92a68b', halo: '#b8d0b2' };
const darkPalette = { ocean: '#243d33', land: '#66845d', coast: '#76946b', grid: '#637c5f', route: '#d2dfb7', future: '#8ca67b', halo: '#6f986e' };
const vector = values => new THREE.Vector3(...values);

function earthTexture(data, palette) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = palette.ocean; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = palette.land; ctx.strokeStyle = palette.coast; ctx.lineWidth = .6;
  for (const feature of data.features) {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const polygon of polygons) {
      ctx.beginPath();
      for (const ring of polygon) {
        ring.forEach(([lon, lat], index) => {
          const x = (lon + 180) / 360 * canvas.width, y = (90 - lat) / 180 * canvas.height;
          if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        });
        ctx.closePath();
      }
      ctx.fill('evenodd'); ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping; texture.offset.x = .3;
  texture.anisotropy = 4;
  return texture;
}

function makeAircraft() {
  const plane = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f6f7ed', roughness: .48, metalness: .12 });
  const wing = new THREE.MeshStandardMaterial({ color: '#d6e1d1', roughness: .65, metalness: .14 });
  const green = new THREE.MeshStandardMaterial({ color: '#55795c', roughness: .65 });
  const glass = new THREE.MeshStandardMaterial({ color: '#476b69', roughness: .2, metalness: .3 });
  function add(geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); plane.add(mesh); return mesh;
  }
  add(new THREE.CylinderGeometry(.014, .008, .16, 20), white, 0, 0, 0);
  add(new THREE.SphereGeometry(1, 20, 12), white, 0, .08, 0).scale.set(.014, .03, .014);
  add(new THREE.ConeGeometry(.009, .045, 16), white, 0, -.098, 0).rotation.z = Math.PI;
  function panel(points, material, depth = .003) {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
    return add(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .001, bevelSize: .001, bevelSegments: 1, steps: 1 }), material, 0, 0, 0);
  }
  panel([[-.01,.038],[-.112,-.024],[-.11,-.04],[-.01,-.012],[.01,-.012],[.11,-.04],[.112,-.024],[.01,.038]], wing);
  panel([[-.007,-.075],[-.05,-.1],[-.047,-.111],[0,-.095],[.047,-.111],[.05,-.1],[.007,-.075]], green);
  const fin = panel([[0,-.065],[.042,-.105],[0,-.108]], green);
  fin.rotation.y = -Math.PI / 2; fin.position.z = .008;
  add(new THREE.SphereGeometry(1, 12, 8), glass, 0, .075, .013).scale.set(.01, .014, .003);
  for (const side of [-1, 1]) {
    add(new THREE.CylinderGeometry(.009, .008, .035, 12), white, side * .048, -.006, -.01);
    const intake = add(new THREE.CircleGeometry(.0065, 12), glass, side * .048, .012, -.01);
    intake.rotation.x = -Math.PI / 2;
    add(new THREE.SphereGeometry(.004, 8, 6), green, side * .11, -.025, .003);
    for (let i = 0; i < 7; i++) add(new THREE.SphereGeometry(.0017, 6, 4), glass, side * .013, -.035 + i * .013, .005);
  }
  plane.scale.setScalar(1.18);
  return plane;
}

function gridGeometry() {
  const vertices = [];
  function line(points) { for (let i = 1; i < points.length; i++) vertices.push(...points[i - 1], ...points[i]); }
  for (let lat = -60; lat <= 60; lat += 30) line(Array.from({ length: 121 }, (_, i) => spherePoint(i * 3, lat, 1.003)));
  for (let lon = 0; lon < 180; lon += 30) line(Array.from({ length: 121 }, (_, i) => spherePoint(lon, i * 3 - 180, 1.003)));
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); return geometry;
}

export async function mountGlobe(container) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
  catch { return null; }
  let data;
  try {
    const response = await fetch(new URL('./land.geojson', import.meta.url));
    if (!response.ok) throw new Error('Map unavailable');
    data = await response.json();
  } catch { renderer.dispose(); return null; }

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 600 ? 1.5 : 1.8));
  renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.04;
  const canvas = renderer.domElement;
  canvas.className = 'globe-canvas'; canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '可交互三维地球，拖动或方向键旋转，Home 键复位');
  const scene = new THREE.Scene(), world = new THREE.Group(); scene.add(world);
  const camera = new THREE.PerspectiveCamera(35, 800 / 660, .1, 30);
  camera.position.set(0, .08, 4.4); camera.lookAt(0, .02, 0);
  scene.add(new THREE.HemisphereLight('#f6f7ed', '#759478', 2));
  const sun = new THREE.DirectionalLight('#fff5df', 2.3); sun.position.set(-3, 4, 5); scene.add(sun);
  const rim = new THREE.DirectionalLight('#b3d2cc', 1.1); rim.position.set(3, 1, -2); scene.add(rim);
  const sphereMaterial = new THREE.MeshStandardMaterial({ roughness: .95, metalness: .025 });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), sphereMaterial); world.add(sphere);
  const gridMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: .17, depthWrite: false });
  world.add(new THREE.LineSegments(gridGeometry(), gridMaterial));

  const atmosphere = new THREE.ShaderMaterial({
    uniforms: { glow: { value: new THREE.Color(lightPalette.halo) } }, transparent: true, depthWrite: false, side: THREE.BackSide,
    vertexShader: 'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
    fragmentShader: 'uniform vec3 glow;varying vec3 n;varying vec3 v;void main(){float a=pow(1.-abs(dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(glow,a*.17);}'
  });
  world.add(new THREE.Mesh(new THREE.SphereGeometry(1.035, 64, 40), atmosphere));

  const route = new THREE.Group(); world.add(route);
  const futureVertices = [];
  for (let i = 0; i < 200; i += 2) futureVertices.push(...routePoint(i / 200), ...routePoint((i + .85) / 200));
  const futureGeometry = new THREE.BufferGeometry(); futureGeometry.setAttribute('position', new THREE.Float32BufferAttribute(futureVertices, 3));
  const futureMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: .8 });
  route.add(new THREE.LineSegments(futureGeometry, futureMaterial));
  class FlightCurve extends THREE.Curve { getPoint(t, target = new THREE.Vector3()) { return target.set(...routePoint(t)); } }
  const trailGeometry = new THREE.TubeGeometry(new FlightCurve(), 512, .005, 6, false);
  trailGeometry.setDrawRange(0, 0);
  const trailMaterial = new THREE.MeshBasicMaterial({ transparent: true }); route.add(new THREE.Mesh(trailGeometry, trailMaterial));
  const markers = [];
  for (const progress of [0, .25, .5, .75, 1]) {
    const material = new THREE.MeshBasicMaterial({ transparent: true });
    const dot = new THREE.Mesh(new THREE.SphereGeometry(progress === 0 || progress === 1 ? .016 : .009, 12, 8), material);
    dot.position.copy(vector(routePoint(progress))); route.add(dot); markers.push({ progress, dot });
  }
  const plane = makeAircraft(); route.add(plane);
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext('2d'), shadowGradient = shadowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  shadowGradient.addColorStop(0, '#193d2c40'); shadowGradient.addColorStop(1, '#193d2c00'); shadowContext.fillStyle = shadowGradient; shadowContext.fillRect(0, 0, 64, 64);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.075, 32), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
  route.add(shadow);

  const homeYaw = .32, homePitch = .12;
  let palette, progress = 0, phase = 'pending', scroll = 0, targetYaw = homeYaw, targetPitch = homePitch, yaw = homeYaw, pitch = homePitch;
  let drag = null, touched = false, dragging = false, frame = 0, lastFrame = 0, visible = !document.hidden;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  function theme() {
    palette = document.documentElement.dataset.theme === 'dark' ? darkPalette : lightPalette;
    const previous = sphereMaterial.map; sphereMaterial.map = earthTexture(data, palette); previous?.dispose(); sphereMaterial.needsUpdate = true;
    gridMaterial.color.set(palette.grid); futureMaterial.color.set(palette.future); trailMaterial.color.set(palette.route); atmosphere.uniforms.glow.value.set(palette.halo);
    markers.forEach(marker => marker.dot.material.color.set(marker.progress <= progress ? palette.route : palette.future));
    invalidate();
  }
  function positionPlane() {
    const normal = vector(routePoint(progress, 1)).normalize(), tangent = vector(routeTangent(progress));
    const bank = normal.clone().multiplyScalar(.68).add(new THREE.Vector3(0, 0, .32)).normalize();
    const side = new THREE.Vector3().crossVectors(tangent, bank).normalize();
    plane.position.copy(vector(routePoint(progress)));
    plane.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, tangent, bank));
    shadow.position.copy(normal.clone().multiplyScalar(1.006)); shadow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    trailGeometry.setDrawRange(0, Math.floor(progress * 512) * 36);
    route.visible = phase !== 'pending' && scroll < .5;
    markers.forEach(marker => marker.dot.material.color.set(marker.progress <= progress ? palette.route : palette.future));
  }
  function draw(now) {
    frame = 0;
    if (!visible || canvas.dataset.contextLost === 'true') return;
    const settled = Math.abs(yaw - targetYaw) + Math.abs(pitch - targetPitch) < .0002;
    if (!dragging && settled && !motion.matches && now - lastFrame < 32) { frame = requestAnimationFrame(draw); return; }
    const delta = Math.min((now - lastFrame) / 1000 || .016, .1); lastFrame = now;
    const follow = 1 - Math.exp(-delta * 12);
    yaw = motion.matches ? targetYaw : yaw + (targetYaw - yaw) * follow;
    pitch = motion.matches ? targetPitch : pitch + (targetPitch - pitch) * follow;
    const idle = !touched && !motion.matches && scroll < .9;
    world.rotation.set(pitch + (idle ? Math.sin(now / 19000) * .012 : 0), yaw + (idle ? Math.sin(now / 23000) * .026 : 0), -.07);
    renderer.render(scene, camera);
    const moving = Math.abs(yaw - targetYaw) + Math.abs(pitch - targetPitch) > .0002;
    if ((idle || moving || dragging) && scroll < .98) frame = requestAnimationFrame(draw);
  }
  function invalidate() { if (!frame && visible) frame = requestAnimationFrame(draw); }
  function resize() {
    const width = container.clientWidth, height = container.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio || 1, innerWidth < 600 ? 1.5 : 1.8);
    if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); invalidate();
  }
  canvas.addEventListener('pointerdown', event => {
    if (scroll > .5 || event.button && event.pointerType === 'mouse') return;
    canvas.classList.add('is-pointer-focus');
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: targetYaw, pitch: targetPitch, touch: event.pointerType !== 'mouse' };
    dragging = false; canvas.setPointerCapture(event.pointerId);
    if (!drag.touch) canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (drag.touch && !dragging && (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2)) return;
    touched = true; dragging = true; canvas.classList.add('is-dragging');
    const scale = 4 / container.getBoundingClientRect().width;
    targetYaw = drag.yaw + dx * scale; targetPitch = Math.max(-.75, Math.min(.8, drag.pitch + (drag.touch ? 0 : dy * scale * .7)));
    container.dataset.rotated = 'true'; invalidate();
  });
  function stopDrag() { drag = null; dragging = false; canvas.classList.remove('is-dragging'); }
  canvas.addEventListener('pointerup', stopDrag); canvas.addEventListener('pointercancel', stopDrag); canvas.addEventListener('lostpointercapture', stopDrag);
  function reset() { targetYaw = homeYaw; targetPitch = homePitch; touched = false; delete container.dataset.rotated; invalidate(); }
  canvas.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key)) return;
    canvas.classList.remove('is-pointer-focus');
    event.preventDefault(); touched = true;
    if (event.key === 'Home') reset();
    else if (event.key === 'ArrowLeft') targetYaw -= .18;
    else if (event.key === 'ArrowRight') targetYaw += .18;
    else targetPitch = Math.max(-.75, Math.min(.8, targetPitch + (event.key === 'ArrowUp' ? -.12 : .12)));
    container.dataset.rotated = event.key === 'Home' ? 'false' : 'true'; invalidate();
  });
  canvas.addEventListener('blur', () => canvas.classList.remove('is-pointer-focus'));
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); canvas.dataset.contextLost = 'true'; container.classList.remove('globe-3d'); document.body.classList.remove('has-globe-3d'); });
  canvas.addEventListener('webglcontextrestored', () => { delete canvas.dataset.contextLost; container.classList.add('globe-3d'); document.body.classList.add('has-globe-3d'); resize(); });
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (!visible) { cancelAnimationFrame(frame); frame = 0; } else invalidate(); });
  motion.addEventListener('change', invalidate);
  new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  container.append(canvas); container.classList.add('globe-3d'); container.dataset.renderer = 'webgl';
  new ResizeObserver(resize).observe(container);
  theme(); positionPlane(); resize();
  return {
    update(value) { progress = clampProgress(value.progress / 100); phase = value.phase; positionPlane(); invalidate(); },
    pending() { phase = 'pending'; positionPlane(); invalidate(); },
    setScroll(value) {
      scroll = value; canvas.tabIndex = scroll < .5 ? 0 : -1;
      container.dataset.interactive = scroll < .5 ? 'true' : 'false';
      const opacity = Math.max(0, 1 - scroll * 2);
      futureMaterial.opacity = opacity * .8; trailMaterial.opacity = opacity;
      route.visible = phase !== 'pending' && scroll < .5;
      plane.traverse(node => { if (node.isMesh) { node.material.transparent = true; node.material.opacity = opacity; } });
      shadow.material.opacity = opacity; markers.forEach(marker => { marker.dot.material.opacity = opacity; }); invalidate();
    },
    reset
  };
}
