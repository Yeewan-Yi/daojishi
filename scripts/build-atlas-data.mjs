import fs from 'node:fs';
fs.mkdirSync('map-data',{recursive:true});fs.mkdirSync('test-results',{recursive:true});
for(const [path,url] of [['test-results/countries-10m.json','https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson'],['test-results/regions-10m.json','https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson'],['test-results/china-provinces.json','https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json']])if(!fs.existsSync(path)){const response=await fetch(url);if(!response.ok)throw Error('Map source unavailable: '+path);fs.writeFileSync(path,await response.text());}
const countries=JSON.parse(fs.readFileSync('test-results/countries-10m.json')).features;
const regions=JSON.parse(fs.readFileSync('test-results/regions-10m.json')).features;
const base=JSON.parse(fs.readFileSync('countries.geojson'));
const chinaIds=new Set(['CHN','TWN','HKG','MAC']);
const polygons=f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
const compact=coords=>Array.isArray(coords[0])?coords.map(compact):coords.map(x=>Math.round(x*1e5)/1e5);
const china=base.features.find(f=>f.properties.id==='CHN');
if(!china.properties.detailedEnclaves){china.geometry={type:'MultiPolygon',coordinates:[...polygons(china),...countries.filter(f=>['HKG','MAC'].includes(f.properties.ADM0_A3)).flatMap(polygons)]};china.properties.detailedEnclaves=true;}
for(const f of base.features.filter(f=>['TWN','HKG','MAC'].includes(f.properties.id)))china.geometry={type:'MultiPolygon',coordinates:[...polygons(china),...polygons(f)]};
base.features=base.features.filter(f=>!['TWN','HKG','MAC'].includes(f.properties.id));
for(const feature of base.features){
 const id=feature.properties.id;const raw=countries.filter(f=>(id==='CHN'?chinaIds.has(f.properties.ADM0_A3):f.properties.ADM0_A3===id));
 if(!raw.length)continue;
 feature.properties.iso2=raw[0].properties.ISO_A2.toLowerCase();
 const outline={type:'Feature',properties:{...feature.properties},geometry:{type:'MultiPolygon',coordinates:compact(raw.flatMap(polygons))}};
 const subdivisions=regions.filter(f=>id==='CHN'?chinaIds.has(f.properties.adm0_a3):f.properties.adm0_a3===id).map(f=>({type:'Feature',properties:{id:f.properties.adm1_code,name:f.properties.name_zh||f.properties.name,country:id,longitude:f.properties.longitude,latitude:f.properties.latitude},geometry:{type:f.geometry.type,coordinates:compact(f.geometry.coordinates)}}));
 if(id==='CHN'){
  const data=JSON.parse(fs.readFileSync('test-results/china-provinces.json'));
  subdivisions.splice(0,subdivisions.length,...data.features.filter(f=>/^\d{6}$/.test(String(f.properties.adcode))&&f.properties.adcode!==100000).map(f=>({type:'Feature',properties:{id:String(f.properties.adcode),name:f.properties.name,country:'CHN',longitude:f.properties.center?.[0],latitude:f.properties.center?.[1]},geometry:f.geometry})));
 }
 fs.writeFileSync(`map-data/${id}.json`,JSON.stringify({country:outline,regions:subdivisions}));
}
fs.writeFileSync('countries.geojson',JSON.stringify(base));
console.log('Prepared detailed country coastlines and regional polygons:',fs.readdirSync('map-data').length);
