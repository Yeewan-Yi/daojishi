import * as THREE from './vendor/three.module.js';
import {createFrameScheduler} from './shared/frame-scheduler.js';
import { AIRCRAFT_RADIUS, VIEW_RESET_DURATION, clampProgress, globeCameraDistance, detailZoomInput, detailMapFov, resetPose, spherePoint, routePoint, routeTangent } from './globe-math.js?v=20261022-album';
import { mountSurfaceProgress } from './globe-labels.js?v=20261022-album';
import { mountMemoryMap } from './memory-map.js?v=20261026-atlas-exit';

const lightPalette = { ocean: '#d8e5dd', land: '#a0b78f', coast: '#9aaf92', grid: '#b0c0a5', route: '#344d3b', future: '#637853', halo: '#b8d0b2' };
const darkPalette = { ocean: '#243b37', land: '#74886a', coast: '#7c9276', grid: '#66806e', route: '#a7bd91', future: '#596e57', halo: '#638a79' };
const vector = values => new THREE.Vector3(...values);

function canvasTexture(canvas, color = false) {
  const texture = new THREE.CanvasTexture(canvas);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping; texture.offset.x = .25;
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

export function makeAircraft() {
  const plane = new THREE.Group();
  plane.name = 'Youqi airliner';
  const ivory = new THREE.MeshPhysicalMaterial({ color: '#eeeadd', roughness: .38, metalness: .18, clearcoat: .28, clearcoatRoughness: .4 });
  const wingMaterial = new THREE.MeshStandardMaterial({ color: '#cbd1c1', roughness: .48, metalness: .27 });
  const green = new THREE.MeshStandardMaterial({ color: '#48634f', roughness: .43, metalness: .12 });
  const trim = new THREE.MeshStandardMaterial({ color: '#b2a47b', roughness: .4, metalness: .55 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#253d40', roughness: .16, metalness: .4, clearcoat: .65 });
  const dark = new THREE.MeshStandardMaterial({ color: '#202c2b', roughness: .72, metalness: .18 });
  const metal = new THREE.MeshStandardMaterial({ color: '#7e8c87', roughness: .32, metalness: .7 });
  function add(name, geometry, material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(x, y, z); plane.add(mesh); return mesh;
  }
  function lathe(name, profile, material, x = 0, y = 0, z = 0, segments = 32) {
    return add(name, new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments), material, x, y, z);
  }
  // A continuous rounded pressure hull, with a tapering tail instead of overlapping primitives.
  const hullProfile = [[0,-.127],[.002,-.122],[.0045,-.108],[.008,-.084],[.0118,-.06],[.014,-.025],[.0145,.036],[.014,.065],[.0125,.081],[.009,.096],[.005,.105],[0,.109]];
  const hullCurve = new THREE.CatmullRomCurve3(hullProfile.map(([r,y])=>new THREE.Vector3(r,y,0)));
  const hullSamples=hullCurve.getPoints(72).map(p=>[Math.max(0,p.x),p.y]);
  lathe('Fuselage', hullSamples, ivory).scale.z = .92;
  function hullRadius(y) {
    const next=hullSamples.findIndex(point=>point[1]>=y), a=hullSamples[Math.max(0,next-1)], b=hullSamples[Math.max(0,next)];
    return a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]||1);
  }
  function panel(name, points, material, depth = .0015, z = 0) {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .0006, bevelSize: .0006, bevelSegments: 2, steps: 1 });
    geometry.translate(0, 0, -depth / 2);
    return add(name, geometry, material, 0, 0, z);
  }
  function seam(name, points, material = trim, radius = .00045) {
    return add(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 20, radius, 5, false), material);
  }
  // Closed airfoil sections: cambered upper surface, fine trailing edge and rising tips.
  function wing(name, stations, side, material) {
    const vertices = [], indices = [], ring = 12;
    for (const [span, leading, trailing, height, thickness] of stations) {
      for (let i = 0; i < ring; i++) {
        const a = i / ring * Math.PI * 2;
        const chord = (1 - Math.cos(a)) / 2;
        vertices.push(side * span, leading + (trailing - leading) * chord, height + Math.sin(a) * thickness * (.85 - chord * .4));
      }
    }
    for (let s = 0; s < stations.length - 1; s++) for (let i = 0; i < ring; i++) {
      const a = s * ring + i, b = s * ring + (i + 1) % ring, c = b + ring, d = a + ring;
      indices.push(a,b,d,b,c,d);
    }
    for (let i = 1; i < ring - 1; i++) { indices.push(0,i+1,i); const last=(stations.length-1)*ring; indices.push(last,last+i,last+i+1); }
    if (side < 0) for (let i=0;i<indices.length;i+=3) [indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    return add(name,geometry,material);
  }
  const windowMatrices = [], fanMatrices = [], dummy = new THREE.Object3D();
  for (const side of [-1, 1]) {
    wing('Swept wing', [[.009,.033,-.027,-.003,.0035],[.038,.014,-.041,-.001,.0026],[.086,-.017,-.055,.004,.0015],[.119,-.04,-.061,.009,.0007]],side,wingMaterial);
    wing('Raised winglet', [[.116,-.038,-.061,.009,.001],[.122,-.047,-.063,.025,.0006],[.123,-.053,-.064,.029,.0002]],side,green);
    wing('Tailplane', [[.005,-.081,-.115,.003,.0018],[.037,-.101,-.123,.008,.001],[.052,-.115,-.126,.012,.0004]],side,wingMaterial);
    seam('Aileron seam', [[side*.049,-.038,.002],[side*.085,-.049,.006],[side*.11,-.057,.01]],green,.00035);
    seam('Wing leading edge', [[side*.017,.028,-.001],[side*.038,.014,.001],[side*.086,-.017,.005],[side*.118,-.04,.01]],trim,.0004);
    seam('Cabin stripe', [[side*.0078,.089,.006],[side*.0137,.06,.0045],[side*.0143,.01,.0045],[side*.0117,-.055,.0045],[side*.006,-.096,.0035]],green,.00065);
    for (let i=0;i<11;i++) {
      const y=.054-i*.0094, radius=Math.sqrt(hullRadius(y)**2-(.006/.92)**2)+.00025;
      dummy.position.set(side*radius,y,.006); dummy.rotation.set(0,side*.95,0); dummy.scale.set(.0009,.00165,.0005); dummy.updateMatrix(); windowMatrices.push(dummy.matrix.clone());
    }
    const cockpitPoints = [[side*.001,.094],[side*.007,.089],[side*.010,.077],[side*.002,.081]];
    const cockpitGeometry = new THREE.BufferGeometry(), glazing=[], glazingIndices=[], divisions=5;
    for(let row=0;row<=divisions;row++)for(let column=0;column<=divisions;column++) {
      const u=column/divisions,v=row/divisions;
      const interpolate=axis=>(1-v)*((1-u)*cockpitPoints[0][axis]+u*cockpitPoints[1][axis])+v*((1-u)*cockpitPoints[3][axis]+u*cockpitPoints[2][axis]);
      const x=interpolate(0),y=interpolate(1);
      glazing.push(x,y,Math.sqrt(Math.max(0,hullRadius(y)**2-x*x))*.92+.00025);
    }
    for(let row=0;row<divisions;row++)for(let column=0;column<divisions;column++) {
      const a=row*(divisions+1)+column,b=a+1,c=a+divisions+1,d=c+1;
      glazingIndices.push(...(side>0?[a,c,b,b,c,d]:[a,b,c,b,d,c]));
    }
    cockpitGeometry.setAttribute('position',new THREE.Float32BufferAttribute(glazing,3));
    cockpitGeometry.setIndex(glazingIndices);cockpitGeometry.computeVertexNormals();
    add('Cockpit glazing',cockpitGeometry,glass);
    // Pylons lead into open nacelles; a recessed fan and rear nozzle give real depth.
    add('Engine pylon',new THREE.BoxGeometry(.0035,.027,.009),wingMaterial,side*.046,-.003,-.007);
    const ex=side*.046, ey=.008, ez=-.017;
    lathe('Engine nacelle', [[.006,-.028],[.009,-.02],[.0105,.009],[.010,.018],[.0084,.019],[.0078,.016],[.0074,.005]],ivory,ex,ey,ez);
    lathe('Intake lip',[[.008,.0155],[.0083,.0187],[.009,.0192],[.010,.018],[.0103,.016]],metal,ex,ey,ez);
    lathe('Intake lining',[[.0077,.0155],[.0073,.004]],dark,ex,ey,ez);
    const fan=add('Fan cavity',new THREE.CircleGeometry(.0074,24),dark,ex,ey+.004,ez);fan.rotation.x=-Math.PI/2;
    add('Fan spinner',new THREE.ConeGeometry(.0022,.006,16),metal,ex,ey+.007,ez);
    for(let i=0;i<10;i++) {
      const a=i*Math.PI/5;
      dummy.position.set(ex+Math.sin(a)*.0045,ey+.0047,ez+Math.cos(a)*.0045);
      dummy.rotation.set(0,a,0);dummy.scale.set(1,1,1);dummy.updateMatrix();fanMatrices.push(dummy.matrix.clone());
    }
    lathe('Exhaust nozzle',[[.0055,-.019],[.0048,-.03],[.0038,-.03],[.0038,-.021]],metal,ex,ey,ez);
    const exhaust=add('Exhaust interior',new THREE.CircleGeometry(.0038,16),dark,ex,ey-.025,ez);exhaust.rotation.x=Math.PI/2;
    add('Wing navigation light',new THREE.SphereGeometry(.0012,8,6),new THREE.MeshStandardMaterial({color:side<0?'#a87867':'#6b967d',roughness:.35}),side*.122,-.054,.025);
  }
  const windows=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),glass,windowMatrices.length); windows.name='Cabin windows';windowMatrices.forEach((matrix,i)=>windows.setMatrixAt(i,matrix));plane.add(windows);
  const fans=new THREE.InstancedMesh(new THREE.BoxGeometry(.0012,.0005,.004),metal,fanMatrices.length);fans.name='Turbofan blades';fanMatrices.forEach((matrix,i)=>fans.setMatrixAt(i,matrix));plane.add(fans);
  const fin=panel('Vertical stabilizer',[[0,-.073],[.034,-.105],[.035,-.122],[0,-.116]],green,.0022);
  fin.rotation.y=-Math.PI/2;fin.position.z=.004;
  const emblem=panel('Tail brass inlay',[[.013,-.096],[.023,-.106],[.023,-.113],[.013,-.104]],trim,.0024);
  emblem.rotation.y=-Math.PI/2;emblem.position.z=.004;
  seam('Dorsal trim',[[0,.057,.0135],[0,.01,.0135],[0,-.055,.011],[0,-.08,.009]],trim,.0003);
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
  const camera = new THREE.PerspectiveCamera(35, 800 / 660, .005, 30);
  camera.position.set(0, .08, 4.4); camera.lookAt(0, .02, 0);
  const ambient = new THREE.HemisphereLight('#f6f7ed', '#759478', 2); scene.add(ambient);
  const sun = new THREE.DirectionalLight('#fff5df', 2.3); sun.position.set(-3, 4, 5); scene.add(sun);
  const rim = new THREE.DirectionalLight('#b3d2cc', 1.1); rim.position.set(3, 1, -2); scene.add(rim);
  const sphereMaterial = new THREE.MeshPhysicalMaterial({ roughness: .93, metalness: .015, ior: 1.33, specularIntensity: .18 });
  const initialTheme = document.documentElement.dataset.theme === 'dark' ? 1 : 0;
  const themeUniform = { value: initialTheme };
  const vectorMix={value:0},vectorOcean={value:new THREE.Color()};
  const details = surfaceMaps(data);
  const dayTexture = earthTexture(data, lightPalette, details), nightTexture = earthTexture(data, darkPalette, details);
  sphereMaterial.bumpMap = details.relief; sphereMaterial.bumpScale = .014;
  sphereMaterial.roughnessMap = details.roughness;
  sphereMaterial.map = dayTexture;
  sphereMaterial.onBeforeCompile = shader => {
    shader.uniforms.nightMap = { value: nightTexture };
    shader.uniforms.themeBlend = themeUniform;
    shader.uniforms.vectorMix=vectorMix;shader.uniforms.vectorOcean=vectorOcean;
    shader.fragmentShader = 'uniform sampler2D nightMap;uniform float themeBlend;uniform float vectorMix;uniform vec3 vectorOcean;\n' + shader.fragmentShader;
    const mapChunk = THREE.ShaderChunk.map_fragment.replace('vec4 sampledDiffuseColor = texture2D( map, vMapUv );', 'vec4 sampledDiffuseColor = mix(texture2D(map,vMapUv),texture2D(nightMap,vMapUv),themeBlend);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', mapChunk+'\ndiffuseColor.rgb=mix(diffuseColor.rgb,vectorOcean,vectorMix);');
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
  class FlightCurve extends THREE.Curve { getPoint(t, target = new THREE.Vector3()) { return target.set(...routePoint(t)); } }
  const futureGeometry = new THREE.TubeGeometry(new FlightCurve(),512,.0028,5,false);
  const dashIndices=[];
  for(let segment=0;segment<512;segment++)if(Math.floor(segment/4)%2===0)for(let i=segment*30;i<(segment+1)*30;i++)dashIndices.push(futureGeometry.index.array[i]);
  futureGeometry.setIndex(dashIndices);
  const futureMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: .8 });
  route.add(new THREE.Mesh(futureGeometry, futureMaterial));
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

  const homeYaw = 1.6, homePitch = .25;
  const dayColors = {}, nightColors = {}, palette = {};
  for (const key of Object.keys(lightPalette)) {
    dayColors[key] = new THREE.Color(lightPalette[key]); nightColors[key] = new THREE.Color(darkPalette[key]);
    palette[key] = dayColors[key].clone().lerp(nightColors[key], initialTheme);
  }
  let themeMix = initialTheme, themeFrom = initialTheme, themeTarget = initialTheme, themeStarted = 0;
  let progress = 0, phase = 'pending', scroll = 0, targetYaw = homeYaw, targetPitch = homePitch, yaw = homeYaw, pitch = homePitch;
  let drag = null, touched = false, dragging = false, zoomChanging = false, cameraZoom = 0, lastFrame = 0, visible = !document.hidden;
  const frames=createFrameScheduler(draw,{active:()=>visible&&canvas.dataset.contextLost!=='true'});
  let resetting = null, idleMix = 0;
  let selectedView = null, cameraDistance = 4.4, cameraFov = 35, detailZoom = 0, atlasFocusGuard = false;
  function zoomDetail(delta){
    if(!selectedView)return delta;
    const before=detailZoom,next=detailZoomInput(detailZoom,delta);detailZoom=next.zoom;
    if(before!==detailZoom)invalidate();
    return next.remaining;
  }
  const raycaster = new THREE.Raycaster();
  const memories = mountMemoryMap(world,container,{
    onFocus(view) {
      interruptReset(); selectedView = view; detailZoom = 0; atlasFocusGuard = true; touched = true;
      const center=vector(spherePoint(view.longitude,view.latitude)).applyAxisAngle(new THREE.Vector3(0,0,1),-.07);
      const turn = Math.PI * 2;
      targetYaw = yaw + ((-Math.atan2(center.x,center.z) - yaw + Math.PI) % turn + turn) % turn - Math.PI;
      targetPitch = Math.max(-1.4,Math.min(1.4,Math.asin(center.y)-Math.atan2(camera.position.y,view.distance)));
      container.dataset.rotated='true';
      window.dispatchEvent(new CustomEvent('journey-country-focus'));
      invalidate();
    },
    onExit() { reset({preserveZoom:true}); },
    onWrite(city) { window.dispatchEvent(new CustomEvent('journey-city-memory',{detail:{city}})); },
    onDetailZoom:zoomDetail,
    onChange:()=>invalidate()
  });
  memories.ready.then(invalidate);
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
    gridMaterial.opacity = THREE.MathUtils.lerp(.10,.085,themeMix)*(1-THREE.MathUtils.smoothstep(cameraZoom,.5,.9)*.8);
    sphereMaterial.roughness = .93 - themeMix * .04;
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.04, .88, themeMix);
    return t < 1 && Math.abs(themeMix - themeTarget) > .0001;
  }
  function positionPlane() {
    const normal = vector(routePoint(progress, 1)).normalize(), tangent = vector(routeTangent(progress));
    const bank = normal;
    const side = new THREE.Vector3().crossVectors(tangent, bank).normalize();
    plane.position.copy(vector(routePoint(progress, AIRCRAFT_RADIUS)));
    plane.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, tangent, bank));
    shadow.position.copy(normal.clone().multiplyScalar(1.006)); shadow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    trailGeometry.setDrawRange(0, Math.floor(progress * 512) * 36);
    route.visible = phase !== 'pending' && scroll < .5 && (!selectedView || cameraDistance>1.7);
    markers.forEach(marker => marker.dot.material.color.set(marker.progress <= progress ? palette.route : palette.future));
  }
  function draw(now) {
    if (!visible || canvas.dataset.contextLost === 'true') return;
    const themeMoving = updateTheme(now);
    const desiredDistance = selectedView ? THREE.MathUtils.lerp(selectedView.distance,1.04,detailZoom) + globeCameraDistance(cameraZoom) - globeCameraDistance(1) : globeCameraDistance(cameraZoom);
    const desiredFov=selectedView?detailMapFov(detailZoom):35;
    const distanceMoving = Math.abs(cameraDistance-desiredDistance) > .0001 || Math.abs(cameraFov-desiredFov)>.001;
    const settled = !resetting && !distanceMoving && Math.abs(yaw - targetYaw) + Math.abs(pitch - targetPitch) < .0002;
    if (!dragging && !zoomChanging && settled && !themeMoving && !motion.matches && now - lastFrame < 32) { invalidate(); return; }
    const delta = Math.min((now - lastFrame) / 1000 || .016, .1); lastFrame = now;
    const follow = 1 - Math.exp(-delta * 12);
    cameraDistance = motion.matches ? desiredDistance : cameraDistance + (desiredDistance-cameraDistance)*follow;
    cameraFov=motion.matches?desiredFov:cameraFov+(desiredFov-cameraFov)*follow;
    camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(cameraFov/2))*1.85));camera.updateProjectionMatrix();
    camera.position.z = cameraDistance;
    camera.lookAt(0,0,0);
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
    route.visible=phase!=='pending'&&scroll<.5&&(!selectedView||cameraDistance>1.7);
    memories.update({camera,zoom:cameraZoom,scroll,themeMix,detail:detailZoom});
    vectorMix.value=memories.surfaceMix;vectorOcean.value.set('#d8e5dd').lerp(new THREE.Color('#243b37'),themeMix);sphereMaterial.bumpScale=.014*(1-vectorMix.value);clouds.visible=vectorMix.value<.01;
    gridMaterial.opacity*=1-vectorMix.value;
    markers.forEach(marker=>marker.dot.scale.setScalar(marker.progress===1
      ? THREE.MathUtils.lerp(1,.06,THREE.MathUtils.smoothstep(cameraZoom,.42,.78))
      : 1-cameraZoom*.55));
    surfaceProgress.update({camera,plane,progress:progress*100,phase,scroll,color:palette.route.getStyle(),zoom:cameraZoom});
    renderer.render(scene, camera);
    zoomChanging = false;
    const moving = distanceMoving || Math.abs(yaw - targetYaw) + Math.abs(pitch - targetPitch) > .0002;
    if (((idle || moving || dragging || resetting || idleMix > .0002) && scroll < .98) || themeMoving) invalidate();
  }
  function invalidate() { frames.invalidate(); }
  function resize() {
    const width = container.clientWidth, height = container.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio || 1, innerWidth < 600 ? 1.5 : 1.8);
    if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
    // Overscan keeps the enlarged sphere continuous beyond the original widget bounds.
    const overscan=1.85;
    renderer.setSize(width*overscan, height*overscan, false);
    canvas.style.width=`${width*overscan}px`;canvas.style.height=`${height*overscan}px`;
    canvas.style.left=`${width*(1-overscan)/2}px`;canvas.style.top=`${height*(1-overscan)/2}px`;
    camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(35/2))*overscan));
    camera.aspect = width / height; camera.updateProjectionMatrix(); invalidate();
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
    if (Math.hypot(dx,dy) < 4 && !dragging) return;
    if (drag.touch && !dragging && (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2)) return;
    touched = true; dragging = true; canvas.classList.add('is-dragging');
    const scale = 4 / container.getBoundingClientRect().width * (selectedView?Math.max(.04,Math.min(1,(cameraDistance-1)/1.15))*cameraFov/35:1);
    targetYaw = drag.yaw + dx * scale; targetPitch = Math.max(-.75, Math.min(.8, drag.pitch + (drag.touch ? 0 : dy * scale * .7)));
    container.dataset.rotated = 'true'; invalidate();
  });
  function stopDrag() { drag = null; dragging = false; canvas.classList.remove('is-dragging'); }
  canvas.addEventListener('pointerup', event => {
    const click = drag && !dragging && Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<7;
    stopDrag();
    if (!click || scroll>.2) return;
    const rect=canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
    world.updateMatrixWorld(true);
    const hit=raycaster.intersectObject(sphere)[0];
    if(hit){const p=world.worldToLocal(hit.point).normalize();memories.pick(Math.atan2(p.x,p.z)*180/Math.PI,Math.asin(p.y)*180/Math.PI);}
  }); canvas.addEventListener('pointercancel', stopDrag); canvas.addEventListener('lostpointercapture', stopDrag);
  function interruptReset() {
    if (!resetting) return;
    resetting = null; targetYaw = yaw; targetPitch = pitch; touched = true;
  }
  function reset({ preserveZoom = false } = {}) {
    stopDrag();
    selectedView=null; atlasFocusGuard=false; memories.clear();
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
    else targetPitch = Math.max(-.75, Math.min(.8, targetPitch + (event.key === 'ArrowUp' ? -.12 : .12)));
    container.dataset.rotated = event.key === 'Home' ? 'false' : 'true'; invalidate();
  });
  canvas.addEventListener('blur', () => canvas.classList.remove('is-pointer-focus'));
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); canvas.dataset.contextLost = 'true'; frames.stop(); container.classList.remove('globe-3d'); document.body.classList.remove('has-globe-3d'); });
  canvas.addEventListener('webglcontextrestored', () => { delete canvas.dataset.contextLost; container.classList.add('globe-3d'); document.body.classList.add('has-globe-3d'); resize(); });
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (!visible) frames.stop(); else invalidate(); });
  motion.addEventListener('change', invalidate);
  new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  container.append(canvas); container.classList.add('globe-3d'); container.dataset.renderer = 'webgl';
  new ResizeObserver(resize).observe(container);
  theme(); positionPlane(); resize();
  return {
    zoomDetail,
    update(value) { progress = clampProgress(value.progress / 100); phase = value.phase; positionPlane(); invalidate(); },
    pending() { phase = 'pending'; positionPlane(); invalidate(); },
    setZoom(value) { const next = clampProgress(value); zoomChanging ||= Math.abs(next - cameraZoom) > .00001; cameraZoom = next; invalidate(); },
    setScroll(value) {
      scroll = value; canvas.tabIndex = scroll < .5 ? 0 : -1;
      if(scroll<.15)atlasFocusGuard=false;
      if(scroll>.25 && selectedView&&!atlasFocusGuard){selectedView=null;memories.clear();}
      container.dataset.interactive = scroll < .5 ? 'true' : 'false';
      const opacity = Math.max(0, 1 - scroll * 2);
      futureMaterial.opacity = opacity * .8; trailMaterial.opacity = opacity;
      route.visible = phase !== 'pending' && scroll < .5 && (!selectedView || cameraDistance>1.7);
      plane.traverse(node => { if (node.isMesh) { node.material.transparent = true; node.material.opacity = opacity; } });
      shadow.material.opacity = opacity; markers.forEach(marker => { marker.dot.material.opacity = opacity; }); invalidate();
    },
    reset
  };
}
