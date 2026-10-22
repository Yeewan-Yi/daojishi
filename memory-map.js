import * as THREE from './vendor/three.module.js';
import {spherePoint} from './globe-math.js?v=20261022-light-frontiers';

export const VISITED_CITIES = Object.freeze([
  Object.freeze({name:'南京',country:'CHN',longitude:118.7778,latitude:32.0617,offset:[-62,-30]}),
  Object.freeze({name:'绍兴',country:'CHN',longitude:120.57,latitude:30,offset:[18,15]})
]);
export const polygonsOf = feature => feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
export const COUNTRY_PICK_ZOOM = .86;
export const canPickCountry = (zoom, scroll=0) => zoom >= COUNTRY_PICK_ZOOM && scroll < .15;
// Retain geographic detail without drawing the same frontier twice or tracing coasts.
export function sharedCountryEdges(features) {
  const edges=new Map();
  const key=point=>`${point[0].toFixed(5)},${point[1].toFixed(5)}`;
  for(const feature of features)for(const polygon of polygonsOf(feature))for(const ring of polygon)for(let i=1;i<ring.length;i++){
    const a=ring[i-1],b=ring[i],ka=key(a),kb=key(b);
    if(ka===kb)continue;
    const id=ka<kb?`${ka}/${kb}`:`${kb}/${ka}`;
    const edge=edges.get(id);
    if(edge)edge.owners.add(feature.properties.id);
    else edges.set(id,{a,b,owners:new Set([feature.properties.id])});
  }
  return [...edges.values()].filter(edge=>edge.owners.size>1);
}
function inRing(longitude,latitude,ring) {
  let previous=ring[0][0], xs=[previous];
  for(let i=1;i<ring.length;i++) {let next=ring[i][0];while(next-previous>180)next-=360;while(next-previous< -180)next+=360;xs.push(next);previous=next;}
  const center=(Math.min(...xs)+Math.max(...xs))/2;
  const x=longitude+Math.round((center-longitude)/360)*360;
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const yi=ring[i][1],yj=ring[j][1];
    if((yi>latitude)!==(yj>latitude)&&x<(xs[j]-xs[i])*(latitude-yi)/(yj-yi)+xs[i])inside=!inside;
  }
  return inside;
}
export function countryAt(features,longitude,latitude) {
  return features.find(feature=>polygonsOf(feature).some(polygon=>inRing(longitude,latitude,polygon[0])&&!polygon.slice(1).some(hole=>inRing(longitude,latitude,hole)))) || null;
}
export function countryView(feature) {
  const longitude=feature.properties.longitude,latitude=feature.properties.latitude;
  const center=new THREE.Vector3(...spherePoint(longitude,latitude));
  // Ignore distant overseas fragments when fitting the principal territory.
  const points=polygonsOf(feature).flatMap(polygon=>polygon[0]).map(([lon,lat])=>new THREE.Vector3(...spherePoint(lon,lat)));
  const angles=points.map(p=>center.angleTo(p)).filter(a=>a<Math.PI/2).sort((a,b)=>a-b);
  const extent=angles[Math.floor((angles.length-1)*.94)]||.15;
  return {longitude,latitude,distance:Math.max(1.38,Math.min(3,1+Math.sin(extent)/Math.tan(THREE.MathUtils.degToRad(15))))};
}
function borderGeometry(edges) {
  const positions=[];
  for(const edge of edges) {
    const a=new THREE.Vector3(...spherePoint(...edge.a,1.006)),b=new THREE.Vector3(...spherePoint(...edge.b,1.006));
    const steps=Math.max(1,Math.ceil(a.angleTo(b)/.025));
    let previous=a;
    for(let step=1;step<=steps;step++){const next=a.clone().lerp(b,step/steps).normalize().multiplyScalar(1.006);positions.push(...previous.toArray(),...next.toArray());previous=next;}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));return geometry;
}
const icon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 21 7v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10"/><path d="m8 6 4-2 4 2-4 2z"/></svg>';
export function mountMemoryMap(world,container,{onFocus,onExit,onWrite}) {
  const group=new THREE.Group();world.add(group);
  const material=new THREE.LineBasicMaterial({color:'#6c7a59',transparent:true,opacity:0,depthWrite:false});
  const selectedMaterial=new THREE.LineBasicMaterial({color:'#bc9d60',transparent:true,opacity:0,depthWrite:false});
  const selectedLine=new THREE.LineSegments(new THREE.BufferGeometry(),selectedMaterial);group.add(selectedLine);
  let features=[],edges=[],selected=null,activeCity=null,open=false,currentZoom=0,currentScroll=0;
  const trigger=document.createElement('button');trigger.className='atlas-trigger';trigger.type='button';trigger.innerHTML=icon+'<span>履痕</span><span class="atlas-count">2</span>';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','memory-atlas');document.body.append(trigger);
  const panel=document.createElement('aside');panel.id='memory-atlas';panel.className='memory-atlas';panel.inert=true;panel.setAttribute('aria-label','两个人的回忆地图');
  panel.innerHTML='<div class="atlas-heading"><span>履痕</span><button type="button" class="atlas-close" aria-label="关闭回忆地图">×</button></div><label class="atlas-country-picker"><span class="atlas-country-label">一起走过</span><select aria-label="选择国家"></select></label><p class="atlas-summary"></p><div class="atlas-cities"></div><div class="atlas-city-detail" hidden><span class="atlas-detail-caption">留给我们</span><h3></h3><button type="button" class="atlas-write">写下这座城市的回忆 <span aria-hidden="true">↗</span></button></div>';
  document.body.append(panel);
  const picker=panel.querySelector('select'),list=panel.querySelector('.atlas-cities'),summary=panel.querySelector('.atlas-summary'),detail=panel.querySelector('.atlas-city-detail');
  function setOpen(value){open=value;panel.classList.toggle('is-open',value);panel.inert=!value;trigger.setAttribute('aria-expanded',String(value));document.body.classList.toggle('atlas-open',value);}
  function showCity(city){activeCity=city;detail.hidden=false;detail.querySelector('h3').textContent=city.name;for(const button of list.children)button.classList.toggle('is-active',button.dataset.city===city.name);}
  function selectCountry(feature,city=null){
    if(!feature)return;
    selected=feature;picker.value=feature.properties.id;activeCity=null;detail.hidden=true;
    const cities=VISITED_CITIES.filter(c=>c.country===feature.properties.id);
    summary.textContent=cities.length?`共同去过 ${cities.length} 座城市`:'下一段共同回忆，留给这里';
    list.replaceChildren();
    for(const item of cities){const button=document.createElement('button');button.type='button';button.className='atlas-city';button.dataset.city=item.name;button.innerHTML='<span class="atlas-city-star" aria-hidden="true">✧</span><span></span><span aria-hidden="true">↗</span>';button.children[1].textContent=item.name;button.addEventListener('click',()=>{showCity(item);onFocus({...item,distance:1.65});});list.append(button);}
    selectedLine.geometry.dispose();selectedLine.geometry=borderGeometry(edges.filter(edge=>edge.owners.has(feature.properties.id)));setOpen(true);if(city)showCity(city);
    onFocus(city?{...city,distance:1.65}:countryView(feature));
  }
  function close(){setOpen(false);selected=null;activeCity=null;onExit();}
  panel.querySelector('.atlas-close').addEventListener('click',close);
  trigger.addEventListener('click',()=>{if(open){close();return;}selectCountry(features.find(f=>f.properties.id==='CHN'));});
  picker.addEventListener('change',()=>selectCountry(features.find(f=>f.properties.id===picker.value)));
  panel.querySelector('.atlas-write').addEventListener('click',()=>{if(!activeCity)return;const city=activeCity.name;setOpen(false);onWrite(city);});
  addEventListener('keydown',event=>{if(event.key==='Escape'&&open){event.stopImmediatePropagation();event.preventDefault();close();trigger.focus({preventScroll:true});}},true);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;const ctx=glowCanvas.getContext('2d');const gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'#f8dfaa');gradient.addColorStop(.22,'#e8be79b0');gradient.addColorStop(1,'#e8be7900');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const glowTexture=new THREE.CanvasTexture(glowCanvas);
  const pins=VISITED_CITIES.map(city=>{
    const normal=new THREE.Vector3(...spherePoint(city.longitude,city.latitude));
    const dot=new THREE.Mesh(new THREE.SphereGeometry(.005,12,8),new THREE.MeshBasicMaterial({color:'#f7d39a',transparent:true}));dot.position.copy(normal).multiplyScalar(1.012);group.add(dot);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,transparent:true,depthWrite:false}));glow.position.copy(normal).multiplyScalar(1.018);glow.scale.set(.055,.055,1);group.add(glow);
    const label=document.createElement('button');label.type='button';label.className='memory-city-pin';label.textContent=city.name;label.setAttribute('aria-label',`${city.name}，我们共同去过`);label.style.setProperty('--pin-x',`${city.offset[0]}px`);label.style.setProperty('--pin-y',`${city.offset[1]}px`);container.append(label);
    label.addEventListener('pointerdown',event=>event.stopPropagation());label.addEventListener('click',()=>selectCountry(features.find(f=>f.properties.id===city.country),city));
    return {city,normal,dot,glow,label};
  });
  const ready=fetch(new URL('./countries.geojson?v=20261022-light-frontiers',import.meta.url)).then(response=>{if(!response.ok)throw Error('Country map unavailable');return response.json();}).then(data=>{
    features=data.features;edges=sharedCountryEdges(features);group.add(new THREE.LineSegments(borderGeometry(edges),material));
    for(const feature of [...features].sort((a,b)=>a.properties.name.localeCompare(b.properties.name,'zh'))){const option=document.createElement('option');option.value=feature.properties.id;option.textContent=feature.properties.name;picker.append(option);}
    trigger.disabled=false;
  }).catch(()=>{trigger.disabled=true;trigger.title='国界地图暂未载入，刷新后重试';});
  trigger.disabled=true;
  return {
    ready,
    pick(longitude,latitude){if(!canPickCountry(currentZoom,currentScroll))return false;const country=countryAt(features,longitude,latitude);if(country)selectCountry(country);return !!country;},
    clear(){selected=null;activeCity=null;setOpen(false);},
    update({camera,zoom,scroll,themeMix}){
      currentZoom=zoom;currentScroll=scroll;
      const reveal=THREE.MathUtils.smoothstep(zoom,.65,.96)*(1-THREE.MathUtils.smoothstep(scroll,.05,.3));
      material.color.set('#465e4b').lerp(new THREE.Color('#8d9a80'),themeMix);material.opacity=reveal*THREE.MathUtils.lerp(.44,.24,themeMix);
      selectedMaterial.color.set('#56664b').lerp(new THREE.Color('#b39c71'),themeMix);selectedMaterial.opacity=selected?reveal*THREE.MathUtils.lerp(.58,.38,themeMix):0;
      trigger.classList.toggle('is-visible',scroll<.2);panel.classList.toggle('is-away',scroll>.25);
      const lights=THREE.MathUtils.smoothstep(zoom,.42,.78)*(1-THREE.MathUtils.smoothstep(scroll,.05,.3));
      world.updateMatrixWorld(true);camera.updateMatrixWorld();
      for(const pin of pins){
        pin.dot.material.color.set('#a97635').lerp(new THREE.Color('#f7d39a'),themeMix);
        pin.dot.material.opacity=lights;pin.glow.material.opacity=lights*.8;pin.dot.visible=pin.glow.visible=lights>.01;
        const p=pin.dot.getWorldPosition(new THREE.Vector3());const facing=p.clone().normalize().dot(camera.position.clone().sub(p).normalize());p.project(camera);
        const visible=lights>.2&&facing>.15&&Math.abs(p.x)<.95&&Math.abs(p.y)<.8;
        pin.label.style.opacity=visible?String(lights):'0';pin.label.style.pointerEvents=visible?'auto':'none';pin.label.tabIndex=visible?0:-1;
        const viewport=container.querySelector('canvas.globe-canvas');
        pin.label.style.left=`${container.clientWidth/2+p.x*(viewport?.clientWidth||container.clientWidth)/2}px`;pin.label.style.top=`${container.clientHeight/2-p.y*(viewport?.clientHeight||container.clientHeight)/2}px`;
      }
    }
  };
}
