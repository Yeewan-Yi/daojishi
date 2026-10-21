import * as THREE from './vendor/three.module.js';
import { AIRCRAFT_RADIUS, VIEW_RESET_DURATION, clampProgress, globeCameraDistance, resetPose, spherePoint, routePoint, routeTangent } from './globe-math.js?v=20261021-free-orbit';
import { mountSurfaceProgress } from './globe-labels.js?v=20261021-clear';

const lightPalette = { ocean: '#d8e5dd', land: '#a0b78f', coast: '#9aaf92', grid: '#b0c0a5', route: '#506f50', future: '#92a68b', halo: '#b8d0b2' };
const darkPalette = { ocean: '#243b37', land: '#74886a', coast: '#7c9276', grid: '#66806e', route: '#a7bd91', future: '#596e57', halo: '#638a79' };
const vector = values => new THREE.Vector3(...values);

function canvasTexture(canvas, color = false) {
  const texture = new THREE.CanvasTexture(canvas);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping; texture.offset.x = .3;
  texture.anisotropy = 8;
  return texture;
}

// Coherent spherical fields keep the date line and both poles free of seams.
function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const u = fade(x - ix), v = fade(y - iy), w = fade(z - iz);
  const hash = (a,b,c) => {
    let h = Math.imul(a,374761393) ^ Math.imul(b,668265263) ^ Math.imul(c,2147483647);
    h = Math.imul(h ^ h >>> 13,1274126177);
    return ((h ^ h >>> 16) >>> 0) / 4294967295;
  };
  const mix = (a,b,t) => a + (b-a)*t;
  const plane = k => mix(mix(hash(ix,iy,k),hash(ix+1,iy,k),u),mix(hash(ix,iy+1,k),hash(ix+1,iy+1,k),u),v);
  return mix(plane(iz),plane(iz+1),w);
}
function field(x,y,z) {
  return noise3(x,y,z)*.55 + noise3(x*2.03+17,y*2.03,z*2.03)*.27 + noise3(x*4.07,y*4.07+23,z*4.07)*.13 + noise3(x*8.11,y*8.11,z*8.11+9)*.05;
}
function surfaceMaps(data) {
  const width = 1024, height = 512;
  const create = () => { const c=document.createElement('canvas');c.width=width;c.height=height;return c; };
  const mask = create(), ctx = mask.getContext('2d');
  ctx.fillStyle='#fff';
  for (const feature of data.features) {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const polygon of polygons) {
      ctx.beginPath();
      for (const ring of polygon) {
        ring.forEach(([lon,lat],i)=>{const x=(lon+180)/360*width,y=(90-lat)/180*height;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
        ctx.closePath();
      }
      ctx.fill('evenodd');
    }
  }
  const land = ctx.getImageData(0,0,width,height).data;
  const relief=create(), roughness=create(), clouds=create(), tint=create();
  const rctx=relief.getContext('2d'), qctx=roughness.getContext('2d'), cctx=clouds.getContext('2d'), tctx=tint.getContext('2d');
  const r=rctx.createImageData(width,height),q=qctx.createImageData(width,height),c=cctx.createImageData(width,height),t=tctx.createImageData(width,height);
  for(let y=0;y<height;y++) {
    const lat=(.5-y/(height-1))*Math.PI, cos=Math.cos(lat), sy=Math.sin(lat);
    for(let x=0;x<width;x++) {
      const lon=x/(width-1)*Math.PI*2, sx=cos*Math.cos(lon), sz=cos*Math.sin(lon), i=(y*width+x)*4;
      const ground=land[i+3]/255, broad=field(sx*3.8+4,sy*3.8,sz*3.8);
      const ridge=Math.pow(1-Math.abs(noise3(sx*19,sy*19,sz*19)*2-1),3);
      const elevation=(broad*.8+ridge*.2), h=92+ground*(20+elevation*72);
      r.data[i]=r.data[i+1]=r.data[i+2]=h;r.data[i+3]=255;
      q.data[i]=q.data[i+1]=q.data[i+2]=152+ground*(82+elevation*18);q.data[i+3]=255;
      t.data[i]=t.data[i+1]=t.data[i+2]=180+elevation*75;t.data[i+3]=ground*255;
      const vapor=field(sx*4.2+31,sy*5.6+7,sz*4.2+11);
      const wisps=Math.max(0,Math.min(1,(vapor-.51)*5));
      c.data[i]=239;c.data[i+1]=243;c.data[i+2]=231;c.data[i+3]=Math.pow(wisps,1.5)*155;
    }
  }
  rctx.putImageData(r,0,0);qctx.putImageData(q,0,0);cctx.putImageData(c,0,0);tctx.putImageData(t,0,0);
  return {relief:canvasTexture(relief),roughness:canvasTexture(roughness),clouds:canvasTexture(clouds,true),tint,mask};
}
function earthTexture(data, palette, details) {
  const canvas = document.createElement('canvas');
  canvas.width = innerWidth < 600 ? 2048 : 4096; canvas.height = canvas.width / 2;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = palette.ocean; ctx.fillRect(0,0,canvas.width,canvas.height);
  // Draw coastlines at the final resolution; never enlarge the relief mask into the color map.
  ctx.fillStyle=palette.land;
  for(const feature of data.features) {
    const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
    for(const polygon of polygons){ctx.beginPath();for(const ring of polygon){ring.forEach(([lon,lat],i)=>{const x=(lon+180)/360*canvas.width,y=(90-lat)/180*canvas.height;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();}ctx.fill('evenodd');}
  }
  ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.12;ctx.drawImage(details.tint,0,0,canvas.width,canvas.height);
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.strokeStyle=palette.coast;ctx.lineWidth=canvas.width/2048*.65;ctx.globalAlpha=.65;
  for(const feature of data.features) {
    const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
    for(const polygon of polygons){ctx.beginPath();for(const ring of polygon){ring.forEach(([lon,lat],i)=>{const x=(lon+180)/360*canvas.width,y=(90-lat)/180*canvas.height;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();}ctx.stroke();}
  }
  return canvasTexture(canvas,true);
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

  renderer.setPixelRatio(Math.min(2, Math.max(1.5, devicePixelRatio || 1)));
  renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.04;
  const canvas = renderer.domElement;
  canvas.className = 'globe-canvas'; canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '可交互三维地球，拖动或方向键旋转，Home 键复位');
  const scene = new THREE.Scene(), world = new THREE.Group(); scene.add(world);
  const camera = new THREE.PerspectiveCamera(35, 800 / 660, .1, 30);
  camera.position.set(0, .08, 4.4); camera.lookAt(0, .02, 0);
  const ambient = new THREE.HemisphereLight('#f6f7ed', '#759478', 2); scene.add(ambient);
  const sun = new THREE.DirectionalLight('#fff5df', 2.3); sun.position.set(-3, 4, 5); scene.add(sun);
  const rim = new THREE.DirectionalLight('#b3d2cc', 1.1); rim.position.set(3, 1, -2); scene.add(rim);
  const sphereMaterial = new THREE.MeshPhysicalMaterial({ roughness: .93, metalness: .015, ior: 1.33, specularIntensity: .18 });
  const initialTheme = document.documentElement.dataset.theme === 'dark' ? 1 : 0;
  const themeUniform = { value: initialTheme };
  const details = surfaceMaps(data);
  const dayTexture = earthTexture(data, lightPalette, details), nightTexture = earthTexture(data, darkPalette, details);
  sphereMaterial.bumpMap = details.relief; sphereMaterial.bumpScale = .014;
  sphereMaterial.roughnessMap = details.roughness;
  sphereMaterial.map = dayTexture;
  sphereMaterial.onBeforeCompile = shader => {
    shader.uniforms.nightMap = { value: nightTexture };
    shader.uniforms.themeBlend = themeUniform;
    shader.fragmentShader = 'uniform sampler2D nightMap;uniform float themeBlend;\n' + shader.fragmentShader;
    const mapChunk = THREE.ShaderChunk.map_fragment.replace('vec4 sampledDiffuseColor = texture2D( map, vMapUv );', 'vec4 sampledDiffuseColor = mix(texture2D(map,vMapUv),texture2D(nightMap,vMapUv),themeBlend);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', mapChunk);
  };
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), sphereMaterial); world.add(sphere);
  const gridMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: .10, depthWrite: false });
  world.add(new THREE.LineSegments(gridGeometry(), gridMaterial));

  const cloudMaterial = new THREE.MeshStandardMaterial({map:details.clouds,transparent:true,depthWrite:false,roughness:1,opacity:.18});
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.008,80,48),cloudMaterial);world.add(clouds);
  const atmosphere = new THREE.ShaderMaterial({
    uniforms: {glow:{value:new THREE.Color(lightPalette.halo)},strength:{value:.24},sunDirection:{value:sun.position.clone().normalize()}},
    transparent:true,depthWrite:false,side:THREE.BackSide,
    vertexShader:'varying vec3 n;varying vec3 v;varying vec3 worldNormal;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);worldNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*p;}',
    fragmentShader:'uniform vec3 glow;uniform float strength;uniform vec3 sunDirection;varying vec3 n;varying vec3 v;varying vec3 worldNormal;void main(){float edge=pow(1.-abs(dot(normalize(n),normalize(v))),3.5);float daylight=smoothstep(-.4,.7,dot(normalize(worldNormal),sunDirection));gl_FragColor=vec4(glow,edge*strength*(.22+.78*daylight));}'
  });
  world.add(new THREE.Mesh(new THREE.SphereGeometry(1.022,96,64),atmosphere));

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
  const surfaceProgress = mountSurfaceProgress(world, container);
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext('2d'), shadowGradient = shadowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  shadowGradient.addColorStop(0, '#193d2c40'); shadowGradient.addColorStop(1, '#193d2c00'); shadowContext.fillStyle = shadowGradient; shadowContext.fillRect(0, 0, 64, 64);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.075, 32), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
  route.add(shadow);

  const homeYaw = .32, homePitch = .12;
  const dayColors = {}, nightColors = {}, palette = {};
  for (const key of Object.keys(lightPalette)) {
    dayColors[key] = new THREE.Color(lightPalette[key]); nightColors[key] = new THREE.Color(darkPalette[key]);
    palette[key] = dayColors[key].clone().lerp(nightColors[key], initialTheme);
  }
  let themeMix = initialTheme, themeFrom = initialTheme, themeTarget = initialTheme, themeStarted = 0;
  let progress = 0, phase = 'pending', scroll = 0, targetYaw = homeYaw, targetPitch = homePitch, yaw = homeYaw, pitch = homePitch;
  let drag = null, touched = false, dragging = false, zoomChanging = false, cameraZoom = 0, frame = 0, lastFrame = 0, visible = !document.hidden;
  let resetting = null, idleMix = 0;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  function theme() {
    themeFrom = themeMix;
    themeTarget = document.documentElement.dataset.theme === 'dark' ? 1 : 0;
    themeStarted = performance.now();
    invalidate();
  }
  function updateTheme(now) {
    const t = motion.matches ? 1 : Math.min(1, (now - themeStarted) / 550);
    themeMix = THREE.MathUtils.lerp(themeFrom, themeTarget, t * t * (3 - 2 * t));
    themeUniform.value = themeMix;
    for (const key of Object.keys(palette)) palette[key].copy(dayColors[key]).lerp(nightColors[key], themeMix);
    gridMaterial.color.copy(palette.grid); futureMaterial.color.copy(palette.future); trailMaterial.color.copy(palette.route); atmosphere.uniforms.glow.value.copy(palette.halo);
    markers.forEach(marker => marker.dot.material.color.copy(marker.progress <= progress ? palette.route : palette.future));
    ambient.intensity = THREE.MathUtils.lerp(1.65, .68, themeMix);
    // A warm upper-left sun and a weaker cool rim reveal the night-side shape.
    sun.intensity = THREE.MathUtils.lerp(2.15, 2.35, themeMix); rim.intensity = THREE.MathUtils.lerp(.85, .42, themeMix);
    sun.position.set(-3 - themeMix * .8, 4 - themeMix, 5 - themeMix * 1.4);
    sun.color.set('#fff7e9').lerp(new THREE.Color('#f0ecdc'),themeMix);
    rim.position.set(3 + themeMix * .2, 1 - themeMix * .6, -2 + themeMix * .8);
    atmosphere.uniforms.strength.value = .28 + themeMix * .07;
    atmosphere.uniforms.sunDirection.value.copy(sun.position).normalize();
    cloudMaterial.opacity = THREE.MathUtils.lerp(.035,.018,themeMix);
    gridMaterial.opacity = THREE.MathUtils.lerp(.10,.085,themeMix);
    sphereMaterial.roughness = .93 - themeMix * .04;
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.04, .88, themeMix);
    return t < 1 && Math.abs(themeMix - themeTarget) > .0001;
  }
  function positionPlane() {
    const normal = vector(routePoint(progress, 1)).normalize(), tangent = vector(routeTangent(progress));
    const bank = normal.clone().multiplyScalar(.68).add(new THREE.Vector3(0, 0, .32)).normalize();
    const side = new THREE.Vector3().crossVectors(tangent, bank).normalize();
    plane.position.copy(vector(routePoint(progress, AIRCRAFT_RADIUS)));
    plane.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, tangent, bank));
    shadow.position.copy(normal.clone().multiplyScalar(1.006)); shadow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    trailGeometry.setDrawRange(0, Math.floor(progress * 512) * 36);
    route.visible = phase !== 'pending' && scroll < .5;
    markers.forEach(marker => marker.dot.material.color.set(marker.progress <= progress ? palette.route : palette.future));
  }
  function draw(now) {
    frame = 0;
    if (!visible || canvas.dataset.contextLost === 'true') return;
    const themeMoving = updateTheme(now);
    const settled = !resetting && Math.abs(yaw - targetYaw) + Math.abs(pitch - targetPitch) < .0002;
    if (!dragging && !zoomChanging && settled && !themeMoving && !motion.matches && now - lastFrame < 32) { frame = requestAnimationFrame(draw); return; }
    const delta = Math.min((now - lastFrame) / 1000 || .016, .1); lastFrame = now;
    const follow = 1 - Math.exp(-delta * 12);
    if (resetting) {
      const t = motion.matches ? 1 : Math.min(1, (now - resetting.started) / VIEW_RESET_DURATION);
      ({ yaw, pitch } = resetPose(resetting.yaw, resetting.pitch, homeYaw, homePitch, t));
      if (t === 1) { resetting = null; touched = false; }
    } else {
      yaw = motion.matches ? targetYaw : yaw + (targetYaw - yaw) * follow;
      pitch = motion.matches ? targetPitch : pitch + (targetPitch - pitch) * follow;
    }
    const idle = !touched && !motion.matches && scroll < .9;
    idleMix = motion.matches ? 0 : idleMix + ((idle ? 1 : 0) - idleMix) * follow;
    world.rotation.set(pitch + Math.sin(now / 19000) * .012 * idleMix, yaw + Math.sin(now / 23000) * .026 * idleMix, -.07);
    surfaceProgress.update({camera,plane,progress:progress*100,phase,scroll,color:palette.route.getStyle()});
    renderer.render(scene, camera);
    zoomChanging = false;
    const moving = Math.abs(yaw - targetYaw) + Math.abs(pitch - targetPitch) > .0002;
    if (((idle || moving || dragging || resetting || idleMix > .0002) && scroll < .98) || themeMoving) frame = requestAnimationFrame(draw);
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
    interruptReset();
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
    // Keep angles continuous across the poles and date line; only reset wraps them.
    targetYaw = drag.yaw + dx * scale; targetPitch = drag.pitch + dy * scale * .7;
    container.dataset.rotated = 'true'; invalidate();
  });
  function stopDrag() { drag = null; dragging = false; canvas.classList.remove('is-dragging'); }
  canvas.addEventListener('pointerup', stopDrag); canvas.addEventListener('pointercancel', stopDrag); canvas.addEventListener('lostpointercapture', stopDrag);
  function interruptReset() {
    if (!resetting) return;
    resetting = null; targetYaw = yaw; targetPitch = pitch; touched = true;
  }
  function reset({ preserveZoom = false } = {}) {
    stopDrag();
    resetting = { yaw: world.rotation.y, pitch: world.rotation.x, started: performance.now() };
    // Preserve the last rendered pose, including its subtle idle motion.
    ({ yaw, pitch } = resetPose(resetting.yaw, resetting.pitch, homeYaw, homePitch, 0));
    targetYaw = homeYaw; targetPitch = homePitch; touched = true; idleMix = 0;
    delete container.dataset.rotated;
    window.dispatchEvent(new CustomEvent('journey-view-reset', { detail: { started: resetting.started, preserveZoom } }));
    invalidate();
  }
  canvas.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key)) return;
    canvas.classList.remove('is-pointer-focus');
    event.preventDefault();
    if (event.key !== 'Home') interruptReset();
    touched = true;
    if (event.key === 'Home') reset({preserveZoom:cameraZoom>.1});
    else if (event.key === 'ArrowLeft') targetYaw -= .18;
    else if (event.key === 'ArrowRight') targetYaw += .18;
    else targetPitch += event.key === 'ArrowUp' ? -.12 : .12;
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
    setZoom(value) { const next = clampProgress(value); zoomChanging ||= Math.abs(next - cameraZoom) > .00001; cameraZoom = next; camera.position.z = globeCameraDistance(next); invalidate(); },
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
