import * as THREE from './vendor/three.module.js';
import {JourneyClient,journeyLink,journeyContext,validCity,normalizedCity} from './journey-data.js?v=20261023-albums';
import {trailMark,memoryMark} from './symbols.js?v=20261022-album';
import {spherePoint} from './globe-math.js?v=20261022-album';

export const VISITED_CITIES = Object.freeze([
  Object.freeze({name:'南京',country:'CHN',longitude:118.7778,latitude:32.0617,offset:[-100,-38]}),
  Object.freeze({name:'绍兴',country:'CHN',longitude:120.57,latitude:30,offset:[18,15]})
]);
export const polygonsOf = feature => feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
export const COUNTRY_PICK_ZOOM = .86;
export const canPickCountry = (zoom, scroll=0,hasSelection=false) => (hasSelection||zoom >= COUNTRY_PICK_ZOOM) && scroll < .15;
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
  return {longitude,latitude,distance:Math.max(1.09,Math.min(3,1+Math.sin(extent)/Math.tan(THREE.MathUtils.degToRad(15))))};
}
// Tessellate before projecting so triangle interiors follow the curved surface too.
export function citySurfaceGeometry(feature,radius=1.011,maxEdge=.012) {
  const positions=[];
  function triangle(a,b,c){
    const ab=a.distanceTo(b),bc=b.distanceTo(c),ca=c.distanceTo(a),longest=Math.max(ab,bc,ca);
    // Split only the offending edge. Splitting all three edges introduced T-junctions
    // on adjacent triangles, exposing dark ocean cracks at high magnification.
    if(longest>maxEdge){if(longest===ab){const m=a.clone().add(b).normalize();triangle(a,m,c);triangle(m,b,c);}else if(longest===bc){const m=b.clone().add(c).normalize();triangle(a,b,m);triangle(a,m,c);}else{const m=c.clone().add(a).normalize();triangle(a,b,m);triangle(m,b,c);}return;}
    positions.push(...a.clone().multiplyScalar(radius).toArray(),...b.clone().multiplyScalar(radius).toArray(),...c.clone().multiplyScalar(radius).toArray());
  }
  for(const polygon of polygonsOf(feature)){
    const rings=polygon.map(ring=>ring.slice(0,-1).map(([x,y])=>new THREE.Vector2(x,y)));
    const points=rings.flat();
    for(const face of THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1))){
      triangle(...face.map(i=>new THREE.Vector3(...spherePoint(points[i].x,points[i].y))));
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const normals=new Float32Array(positions.length);for(let i=0;i<positions.length;i+=3){const length=Math.hypot(positions[i],positions[i+1],positions[i+2]);for(let j=0;j<3;j++)normals[i+j]=positions[i+j]/length;}geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));return geometry;
}
function cityOutlineGeometry(feature){
  const edges=polygonsOf(feature).flatMap(polygon=>polygon.flatMap(ring=>ring.slice(1).map((b,i)=>({a:ring[i],b}))));
  return borderGeometry(edges).scale(1.012/1.006,1.012/1.006,1.012/1.006);
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
export function mountMemoryMap(world,container,{onFocus,onExit,onWrite,onDetailZoom=()=>{},onChange=()=>{}}) {
  const group=new THREE.Group(),citiesGroup=new THREE.Group();world.add(group);group.add(citiesGroup);
  const material=new THREE.LineBasicMaterial({transparent:true,opacity:0,depthWrite:false});
  const selectedMaterial=new THREE.LineBasicMaterial({transparent:true,opacity:0,depthWrite:false});
  const regionMaterial=new THREE.LineBasicMaterial({transparent:true,opacity:0,depthWrite:false});
  const candidateMaterial=new THREE.LineBasicMaterial({transparent:true,opacity:0,depthWrite:false});
  const previewMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
  const previewEdgeMaterial=new THREE.LineBasicMaterial({transparent:true,opacity:0,depthWrite:false});
  const coastMaterial=new THREE.LineBasicMaterial({transparent:true,opacity:0,depthWrite:false});
  const landMaterial=new THREE.MeshStandardMaterial({color:'#a0b78f',transparent:true,opacity:0,roughness:.94,depthWrite:false,side:THREE.DoubleSide});
  const selectedLine=new THREE.LineSegments(new THREE.BufferGeometry(),selectedMaterial),regionLines=new THREE.LineSegments(new THREE.BufferGeometry(),regionMaterial),coast=new THREE.LineSegments(new THREE.BufferGeometry(),coastMaterial),detailedLand=new THREE.Mesh(new THREE.BufferGeometry(),landMaterial);group.add(selectedLine,regionLines,coast,detailedLand);
  const vectorMaterial=new THREE.MeshStandardMaterial({transparent:true,opacity:0,roughness:.94,depthWrite:false,side:THREE.DoubleSide}),vectorLand=new THREE.Mesh(new THREE.BufferGeometry(),vectorMaterial);vectorLand.renderOrder=2;group.add(vectorLand);let vectorReady=false,vectorPromise=null,surfaceMix=0;
  function prepareVectorLand(){if(vectorPromise)return vectorPromise;vectorPromise=fetch(new URL('./detail-land.geojson?v=20261022-album',import.meta.url)).then(r=>{if(!r.ok)throw Error('Detailed terrain unavailable');return r.json();}).then(data=>{disposeGeometry(vectorLand,citySurfaceGeometry({geometry:{type:'MultiPolygon',coordinates:data.features.flatMap(polygonsOf)}},1.002,.045));vectorReady=true;onChange();}).catch(()=>{vectorPromise=null;});return vectorPromise;}
  const candidateLines=new THREE.LineSegments(new THREE.BufferGeometry(),candidateMaterial),previewArea=new THREE.Mesh(new THREE.BufferGeometry(),previewMaterial),previewEdge=new THREE.LineSegments(new THREE.BufferGeometry(),previewEdgeMaterial);group.add(candidateLines,previewArea,previewEdge);let previewKey='';
  const patchCenter={value:new THREE.Vector3(0,0,1)},patchRadius={value:.08};
  function patchMaterial(){const m=new THREE.MeshStandardMaterial({transparent:true,opacity:0,roughness:.94,depthWrite:false,side:THREE.DoubleSide});m.onBeforeCompile=shader=>{shader.uniforms.patchCenter=patchCenter;shader.uniforms.patchRadius=patchRadius;shader.vertexShader='varying vec3 vPatchLocal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPatchLocal=position;');shader.fragmentShader='varying vec3 vPatchLocal;uniform vec3 patchCenter;uniform float patchRadius;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a *= 1.-smoothstep(patchRadius*.7,patchRadius,length(normalize(vPatchLocal)-patchCenter));\n#include <alphatest_fragment>');};m.customProgramCacheKey=()=> 'youqi-local-coast-v1';return m;}
  const patchOceanMaterial=patchMaterial(),patchLandMaterial=patchMaterial(),patchOcean=new THREE.Mesh(new THREE.BufferGeometry(),patchOceanMaterial),patchLand=new THREE.Mesh(new THREE.BufferGeometry(),patchLandMaterial);patchOcean.renderOrder=1;patchLand.renderOrder=2;group.add(patchOcean,patchLand);detailedLand.renderOrder=3;coast.renderOrder=4;regionLines.renderOrder=5;selectedLine.renderOrder=5;candidateLines.renderOrder=6;previewArea.renderOrder=7;previewEdge.renderOrder=8;

  let features=[],edges=[],cityFeatures=[],candidates=[],regions=[],selected=null,activeCity=null,selectedRegion=null,open=false,currentZoom=0,currentScroll=0,detailZoom=0,pins=[],countryLoad=0,cityLoad=0,busy=false,revision=0,syncing=false;
  let connectionError='';
  let context=journeyContext(),client=new JourneyClient(context);const dataCache=new Map(),searchCache=new Map();let lastSearch=0;
  const trigger=document.createElement('button');trigger.className='atlas-trigger icon-button nav-tool';trigger.type='button';trigger.innerHTML=trailMark+'<span class="nav-caption" aria-hidden="true">履痕</span><span class="atlas-count" hidden>—</span>';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','memory-atlas');trigger.setAttribute('aria-label','履痕');document.querySelector('.header-actions').append(trigger);
  const portal=document.createElement('a');portal.className='memory-portal';portal.href=journeyLink('memories.html');portal.innerHTML=memoryMark+'<span><b>拾光</b><small>收藏走过的时光</small></span><i aria-hidden="true">↗</i>';document.body.append(portal);const attribution=document.createElement('a');attribution.className='atlas-attribution';attribution.href='https://www.openstreetmap.org/copyright';attribution.target='_blank';attribution.rel='noopener noreferrer';attribution.textContent='© OpenStreetMap';attribution.hidden=true;document.body.append(attribution);
  const panel=document.createElement('aside');panel.id='memory-atlas';panel.className='memory-atlas';panel.inert=true;panel.setAttribute('aria-label','两个人的回忆地图');
  panel.innerHTML='<div class="atlas-heading"><span>履痕</span><div class="atlas-lens"><button type="button" aria-label="进一步放大地图">＋</button><button type="button" aria-label="缩小地图">−</button><button type="button" class="atlas-close" aria-label="关闭回忆地图">×</button></div></div><label class="atlas-country-picker"><span class="atlas-country-label">一起走过</span><select aria-label="选择国家"></select></label><label class="atlas-region-picker"><span>省 / 州 / 地区</span><select aria-label="选择省州地区"><option value="">全部地区</option></select></label><div class="atlas-location-tools"><label class="atlas-city-picker"><span>选择城市，留下履痕</span><select aria-label="选择城市"><option value="">先选择省州地区</option></select></label><form class="atlas-city-search" hidden><label for="atlas-city-query">寻找城市</label><div><input id="atlas-city-query" maxlength="80" placeholder="输入城市名称" autocomplete="off"><button type="submit" aria-label="搜索城市">⌕</button></div><select aria-label="城市搜索结果" hidden></select><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a></form></div><p class="atlas-error" role="status"></p><p class="atlas-summary"></p><div class="atlas-cities"></div><div class="atlas-city-detail" hidden><span class="atlas-detail-caption">在这一城</span><h3></h3><button type="button" class="atlas-mark"></button><a class="atlas-open-memories">翻开这一城的拾光 <span aria-hidden="true">↗</span></a></div>';
  document.body.append(panel);
  const picker=panel.querySelector('.atlas-country-picker select'),regionPicker=panel.querySelector('.atlas-region-picker select'),cityPicker=panel.querySelector('.atlas-city-picker select'),searchForm=panel.querySelector('.atlas-city-search'),searchResults=searchForm.querySelector('select'),list=panel.querySelector('.atlas-cities'),summary=panel.querySelector('.atlas-summary'),detail=panel.querySelector('.atlas-city-detail'),mark=panel.querySelector('.atlas-mark'),memoryLink=panel.querySelector('.atlas-open-memories'),error=panel.querySelector('.atlas-error');
  function setOpen(value){open=value;panel.classList.toggle('is-open',value);panel.inert=!value;trigger.setAttribute('aria-expanded',String(value));document.body.classList.toggle('atlas-open',value);}
  function disposeGeometry(object,geometry=new THREE.BufferGeometry()){object.geometry.dispose();object.geometry=geometry;}
  function installCities(next){
    for(const pin of pins){pin.label.remove();pin.fill.geometry.dispose();pin.fill.material.dispose();pin.outline.geometry.dispose();pin.outline.material.dispose();}citiesGroup.clear();cityFeatures=next.map(normalizedCity);attribution.hidden=!cityFeatures.some(f=>f.properties.id.startsWith('osm:'));pins=cityFeatures.map(makePin);trigger.querySelector('.atlas-count').textContent=cityFeatures.length;refreshCities();onChange();
  }
  function makePin(feature){const city=feature.properties,normal=new THREE.Vector3(...spherePoint(city.longitude,city.latitude));
    const fill=new THREE.Mesh(citySurfaceGeometry(feature),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));const outline=new THREE.LineSegments(cityOutlineGeometry(feature),new THREE.LineBasicMaterial({transparent:true,opacity:0,depthWrite:false}));citiesGroup.add(fill,outline);
    const label=document.createElement('button');label.type='button';label.className='memory-city-pin';label.textContent=city.name;label.setAttribute('aria-label',`${city.name}，我们共同去过`);label.style.setProperty('--pin-x',city.name==='南京'?'-100px':'20px');label.style.setProperty('--pin-y',city.name==='南京'?'-38px':'18px');container.append(label);label.addEventListener('pointerdown',e=>e.stopPropagation());label.onclick=()=>selectCity(feature);fill.renderOrder=7;outline.renderOrder=8;return {feature,normal,fill,outline,label};
  }
  function refreshCities(){
    const cities=cityFeatures.filter(f=>f.properties.country===selected?.properties.id);summary.textContent=selected?cities.length?`共同去过 ${cities.length} 座城市`:'点亮一城，留下一段共同回忆':'';list.replaceChildren();
    for(const f of cities){const button=document.createElement('button');button.type='button';button.className='atlas-city';button.dataset.city=f.properties.id;const name=document.createElement('span');name.textContent=f.properties.name;const arrow=document.createElement('span');arrow.textContent='↗';button.append(name,arrow);button.onclick=()=>selectCity(f);list.append(button);}refreshDetail();
  }
  function refreshDetail(){detail.hidden=!activeCity;const visited=activeCity&&cityFeatures.some(f=>f.properties.id===activeCity.properties.id);const nextPreview=activeCity&&!visited?activeCity.properties.id:'';if(previewKey!==nextPreview){previewKey=nextPreview;disposeGeometry(previewArea,nextPreview?citySurfaceGeometry(activeCity,1.01):new THREE.BufferGeometry());disposeGeometry(previewEdge,nextPreview?cityOutlineGeometry(activeCity):new THREE.BufferGeometry());}if(!activeCity)return;detail.querySelector('h3').textContent=activeCity.properties.name;mark.textContent=visited?'已点亮 · 取消点亮':'点亮这一城';mark.classList.toggle('is-lit',visited);mark.disabled=busy;mark.setAttribute('aria-pressed',String(visited));memoryLink.hidden=!visited;memoryLink.href=journeyLink('memories.html',activeCity.properties.id);for(const b of list.children)b.classList.toggle('is-active',b.dataset.city===activeCity.properties.id);}
  function focusFeature(feature){const view=countryView(feature);onFocus({...view,distance:feature.properties.country?Math.max(1.10,Math.min(1.65,view.distance)):view.distance});}
  function selectCity(feature){activeCity=normalizedCity(feature);const country=features.find(f=>f.properties.id===activeCity.properties.country);if(country&&selected?.properties.id!==country.properties.id)selectCountry(country,{keepCity:true});setOpen(true);refreshDetail();focusFeature(activeCity);}
  async function selectRegion(id){
    activeCity=null;refreshDetail();
    selectedRegion=regions.find(f=>f.properties.id===id)||null;candidates=[];disposeGeometry(candidateLines);cityPicker.replaceChildren(new Option('正在准备城市…',''));const generation=++cityLoad;searchResults.hidden=true;
    if(!selectedRegion){cityPicker.replaceChildren(new Option('先选择省州地区',''));searchForm.hidden=selected?.properties.id==='CHN';return;}
    focusFeature(selectedRegion);searchForm.hidden=selected?.properties.id==='CHN'&&id!=='710000';
    if(selected?.properties.id==='CHN'&&id!=='710000')try{const data=await loadData(`cities-${id}`);if(generation!==cityLoad)return;candidates=data.features.map(validCity);disposeGeometry(candidateLines,borderGeometry(sharedCountryEdges(candidates)));cityPicker.replaceChildren(new Option('选择要点亮的城市',''));for(const f of candidates)cityPicker.append(new Option(f.properties.name,f.properties.id));}catch{if(generation===cityLoad){error.textContent='城市地图暂未载入，请稍后重试。';cityPicker.replaceChildren(new Option('暂时无法载入城市',''));}}else cityPicker.replaceChildren(new Option('在下方搜索城市',''));
    onChange();
  }
  async function loadData(id){if(dataCache.has(id))return dataCache.get(id);const promise=fetch(new URL(`./map-data/${id}.json?v=20261022-album`,import.meta.url)).then(r=>{if(!r.ok)throw Error('地图暂不可用');return r.json();}).catch(e=>{dataCache.delete(id);throw e;});dataCache.set(id,promise);return promise;}
  async function selectCountry(feature,{keepCity=false}={}){
    prepareVectorLand();
    if(!feature)return;const generation=++countryLoad;selected=feature;regions=[];selectedRegion=null;candidates=[];cityLoad++;picker.value=feature.properties.id;regionPicker.replaceChildren(new Option('正在准备地区…',''));cityPicker.replaceChildren(new Option('先选择省州地区',''));if(!keepCity)activeCity=null;error.textContent=connectionError;searchResults.hidden=true;searchForm.hidden=feature.properties.id==='CHN';disposeGeometry(regionLines);disposeGeometry(candidateLines);disposeGeometry(patchOcean);disposeGeometry(patchLand);disposeGeometry(detailedLand);disposeGeometry(coast);disposeGeometry(selectedLine,borderGeometry(edges.filter(e=>e.owners.has(feature.properties.id))));setOpen(true);refreshCities();if(!keepCity)focusFeature(feature);
    try{const data=await loadData(feature.properties.id);if(generation!==countryLoad)return;regions=data.regions;regionPicker.replaceChildren(new Option('全部地区',''));for(const f of regions)regionPicker.append(new Option(f.properties.name,f.properties.id));disposeGeometry(regionLines,borderGeometry(sharedCountryEdges(regions)));disposeGeometry(coast,cityOutlineGeometry(data.country).scale(1.005/1.012,1.005/1.012,1.005/1.012));disposeGeometry(detailedLand,citySurfaceGeometry(data.country,1.002,.025));if(data.neighborhood){patchCenter.value.set(...spherePoint(...data.neighborhood.center));patchRadius.value=data.neighborhood.radius;disposeGeometry(patchOcean,citySurfaceGeometry(data.neighborhood.ocean,1.0008,.02));disposeGeometry(patchLand,citySurfaceGeometry(data.neighborhood.land,1.0015,.02));}onChange();}catch{if(generation===countryLoad){regionPicker.replaceChildren(new Option('地区暂未载入',''));error.textContent='详细地图暂未载入，已有履痕仍可查看。';}}
  }
  function close(){countryLoad++;cityLoad++;setOpen(false);selected=null;activeCity=null;selectedRegion=null;regions=[];onExit();}
  panel.querySelector('.atlas-close').onclick=close;panel.querySelector('[aria-label="进一步放大地图"]').onclick=()=>onDetailZoom(-140);panel.querySelector('[aria-label="缩小地图"]').onclick=()=>onDetailZoom(140);
  trigger.onclick=()=>{if(open)close();else selectCountry(features.find(f=>f.properties.id==='CHN'));};picker.onchange=()=>selectCountry(features.find(f=>f.properties.id===picker.value));regionPicker.onchange=()=>selectRegion(regionPicker.value);cityPicker.onchange=()=>{const f=candidates.find(f=>f.properties.id===cityPicker.value);if(f)selectCity(f);};
  mark.onclick=async()=>{if(!activeCity||busy)return;const feature=activeCity,visited=cityFeatures.some(f=>f.properties.id===feature.properties.id);busy=true;refreshDetail();error.textContent='';try{context=journeyContext();client=new JourneyClient(context);await client.mark(feature,!visited);installCities(await client.cities());window.dispatchEvent(new Event('journey-cities-changed'));}catch(e){error.textContent=e.message;}finally{busy=false;refreshDetail();}};
  searchForm.onsubmit=async e=>{
    e.preventDefault();const query=searchForm.querySelector('input').value.trim();if(!query||!selected)return;const iso=selectedRegion?.properties.id==='710000'?'tw':selected.properties.iso2;const key=`${selected.properties.id}:${selectedRegion?.properties.id||''}:${query}`;const country=selected,region=selectedRegion;error.textContent='正在寻找城市边界…';const submit=searchForm.querySelector('button');submit.disabled=true;
    try{let result=searchCache.get(key);if(!result){if(Date.now()-lastSearch<1500)throw Error('请稍等片刻再搜索。');lastSearch=Date.now();result=await client.searchCities(`${query} ${region?.properties.name||''}`,iso);searchCache.set(key,result);}if(selected?.properties.id!==country.properties.id)return;const matches=result.filter(r=>['Polygon','MultiPolygon'].includes(r.geojson?.type)&&!['country','state','province','region','continent'].includes(r.addresstype));candidates=matches.map(r=>validCity({type:'Feature',properties:{id:`osm:${r.osm_type}:${r.osm_id}`,name:r.name||query,country:country.properties.id,region:region?.properties.name||'',longitude:Number(r.lon),latitude:Number(r.lat)},geometry:r.geojson}));searchResults.replaceChildren(new Option(candidates.length?'选择城市边界':'未找到城市区域，请换一个名称',''));for(const f of candidates)searchResults.append(new Option(`${f.properties.name} · 城市区域`,f.properties.id));searchResults.hidden=false;error.textContent=candidates.length?'':'未找到可用的城市区域边界，请尝试城市全名。';}catch(err){error.textContent=err.message;}finally{submit.disabled=false;}
  };
  searchResults.onchange=()=>{const f=candidates.find(f=>f.properties.id===searchResults.value);if(f)selectCity(f);};
  addEventListener('keydown',e=>{if(e.key==='Escape'&&open&&!document.querySelector('dialog[open]')){e.stopImmediatePropagation();e.preventDefault();close();trigger.focus({preventScroll:true});}},true);
  async function syncCities(){if(syncing||document.hidden)return;syncing=true;try{const nextContext=journeyContext();if(JSON.stringify(nextContext)!==JSON.stringify(context)){context=nextContext;client=new JourneyClient(context);portal.href=journeyLink('memories.html');}const next=await client.cities(),signature=JSON.stringify(next);connectionError='';if(signature!==revision){revision=signature;installCities(next);}}catch(e){connectionError=e.message;if(open)error.textContent=e.message;if(!pins.length){try{const data=await fetch('./visited-cities.geojson').then(r=>r.json());installCities(data.features);}catch{}}}finally{syncing=false;}}
  addEventListener('journey-cities-changed',syncCities);addEventListener('storage',e=>{if(e.key?.startsWith('youqi.journey')||e.key?.startsWith('youqi.letters.identity'))syncCities();});setInterval(syncCities,12000);
  const countryReady=fetch(new URL('./countries.geojson?v=20261022-album',import.meta.url)).then(r=>{if(!r.ok)throw Error('Country map unavailable');return r.json();}).then(data=>{features=data.features;edges=sharedCountryEdges(features);group.add(new THREE.LineSegments(borderGeometry(edges),material));for(const f of [...features].sort((a,b)=>a.properties.name.localeCompare(b.properties.name,'zh')))picker.append(new Option(f.properties.name,f.properties.id));trigger.disabled=false;}).catch(()=>{trigger.disabled=true;trigger.title='地图暂未载入，刷新后重试';});trigger.disabled=true;
  const citiesReady=syncCities();
  return {
    get surfaceMix(){return surfaceMix;},
    ready:Promise.all([countryReady,citiesReady]),
    pick(longitude,latitude){if(!canPickCountry(currentZoom,currentScroll,!!selected))return false;const city=countryAt([...candidates,...cityFeatures],longitude,latitude);if(city){selectCity(city);return true;}const country=countryAt(features,longitude,latitude);if(selected&&country?.properties.id===selected.properties.id){const region=countryAt(regions,longitude,latitude);if(region){regionPicker.value=region.properties.id;selectRegion(region.properties.id);return true;}}if(country)selectCountry(country);return !!country;},
    clear(){countryLoad++;cityLoad++;selected=null;activeCity=null;selectedRegion=null;setOpen(false);},
    update({camera,zoom,scroll,themeMix,detail=0}){
      currentZoom=zoom;currentScroll=scroll;detailZoom=detail;
      const targetSurface=selected&&vectorReady?1:0;surfaceMix+=(targetSurface-surfaceMix)*.16;if(Math.abs(surfaceMix-targetSurface)<.002)surfaceMix=targetSurface;else onChange();vectorMaterial.color.set('#a0b78f').lerp(new THREE.Color('#74886a'),themeMix);vectorMaterial.opacity=surfaceMix;vectorLand.visible=surfaceMix>.001;
      const reveal=THREE.MathUtils.smoothstep(zoom,.65,.96)*(1-THREE.MathUtils.smoothstep(scroll,.05,.3));
      material.color.set('#465e4b').lerp(new THREE.Color('#8d9a80'),themeMix);material.opacity=reveal*THREE.MathUtils.lerp(.44,.24,themeMix);
      selectedMaterial.color.set('#56664b').lerp(new THREE.Color('#b39c71'),themeMix);selectedMaterial.opacity=selected?reveal*THREE.MathUtils.lerp(.58,.38,themeMix):0;
      const selectedReveal=selected?reveal:0;patchOceanMaterial.color.set('#d8e5dd').lerp(new THREE.Color('#243b37'),themeMix);patchLandMaterial.color.set('#a0b78f').lerp(new THREE.Color('#74886a'),themeMix);patchOceanMaterial.opacity=patchLandMaterial.opacity=selectedReveal;patchOcean.visible=patchLand.visible=selectedReveal>.01;landMaterial.color.set('#a0b78f').lerp(new THREE.Color('#74886a'),themeMix);landMaterial.opacity=selectedReveal;detailedLand.visible=selectedReveal>.01;
      coastMaterial.color.set('#6f8668').lerp(new THREE.Color('#879b7d'),themeMix);coastMaterial.opacity=selectedReveal*.5;
      // Once the complete vector surface is ready, retire all overlapping local
      // coast patches and raster edges together. Their differing sources caused halos.
      patchOcean.visible=patchLand.visible=detailedLand.visible=coast.visible=surfaceMix<.01;
      material.opacity*=1-surfaceMix;selectedMaterial.opacity*=1-surfaceMix;
      regionMaterial.color.set('#576d64').lerp(new THREE.Color('#a4b8b0'),themeMix);regionMaterial.opacity=selectedReveal*THREE.MathUtils.lerp(.34,.25,themeMix);candidateMaterial.color.copy(regionMaterial.color);candidateMaterial.opacity=selectedReveal*.2;previewMaterial.color.set('#7b9b99').lerp(new THREE.Color('#b1d0cc'),themeMix);previewMaterial.opacity=selectedReveal*.22;previewEdgeMaterial.color.copy(previewMaterial.color);previewEdgeMaterial.opacity=selectedReveal*.7;
      trigger.classList.add('is-visible');portal.classList.toggle('is-away',scroll>.2);attribution.style.opacity=scroll>.2?'0':'.6';panel.classList.toggle('is-away',scroll>.25);
      const lights=THREE.MathUtils.smoothstep(zoom,.42,.78)*(1-THREE.MathUtils.smoothstep(scroll,.05,.3));
      world.updateMatrixWorld(true);camera.updateMatrixWorld();
      for(const pin of pins){const emphasis=activeCity?.properties.id===pin.feature.properties.id?1:0;
        pin.fill.material.color.set('#b68a43').lerp(new THREE.Color('#e3be77'),themeMix);pin.fill.material.opacity=lights*THREE.MathUtils.lerp(.48+emphasis*.17,.55+emphasis*.17,themeMix);pin.outline.material.color.set('#82643a').lerp(new THREE.Color('#f3d69b'),themeMix);pin.outline.material.opacity=lights*(.72+emphasis*.2);pin.fill.visible=pin.outline.visible=lights>.01;
        const p=pin.normal.clone().multiplyScalar(1.014).applyMatrix4(citiesGroup.matrixWorld),facing=p.clone().normalize().dot(camera.position.clone().sub(p).normalize());p.project(camera);const visible=lights>.2&&facing>.15&&Math.abs(p.x)<.95&&Math.abs(p.y)<.8;pin.label.style.opacity=visible?String(lights):'0';pin.label.style.pointerEvents=visible?'auto':'none';pin.label.tabIndex=visible?0:-1;const viewport=container.querySelector('canvas.globe-canvas');pin.label.style.left=`${container.clientWidth/2+p.x*(viewport?.clientWidth||container.clientWidth)/2}px`;pin.label.style.top=`${container.clientHeight/2-p.y*(viewport?.clientHeight||container.clientHeight)/2}px`;
      }
    }
  };
}
