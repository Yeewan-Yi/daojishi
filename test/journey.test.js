import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {validCity,normalizedCity,validMediaPage,validCommentsPage,JourneyClient} from '../journey-data.js';
import {countryAt,sharedCountryEdges,citySurfaceGeometry,canPickCountry} from '../memory-map.js';
import {detailZoomInput} from '../globe-math.js';
import {spherePoint} from '../globe-math.js';
const defaults=JSON.parse(fs.readFileSync(new URL('../visited-cities.geojson',import.meta.url))).features;
test('an active city map remains selectable independently of the overview zoom threshold',()=>{assert.equal(canPickCountry(.4,0,true),true);assert.equal(canPickCountry(.4,0,false),false);assert.equal(canPickCountry(1,.5,true),false);});

test('magnified land triangles share complete edges without exposing interior ocean cracks',()=>{
 const ring=[[-8,-5],[7,-5],[7,6],[-8,6],[-8,-5]],g=citySurfaceGeometry({geometry:{type:'Polygon',coordinates:[ring]}},1,.03),p=g.attributes.position,edges=new Map();
 const point=i=>[p.getX(i),p.getY(i),p.getZ(i)],key=v=>v.map(x=>x.toFixed(6)).join(',');
 for(let i=0;i<p.count;i+=3)for(const [a,b] of [[i,i+1],[i+1,i+2],[i+2,i]]){const x=point(a),y=point(b),id=[key(x),key(y)].sort().join('/');const e=edges.get(id)||{x,y,count:0};e.count++;edges.set(id,e);}
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
 const borders=ring.slice(1).map((b,i)=>cross(spherePoint(...ring[i]),spherePoint(...b)));
 for(const edge of edges.values())if(edge.count===1)assert.ok(borders.some(n=>Math.abs(dot(n,edge.x))<1e-6&&Math.abs(dot(n,edge.y))<1e-6),'Only the outside shore can have an unpaired mesh edge');
 g.dispose();
});
test('default city areas and all selectable Chinese city polygons are valid, with stable IDs',()=>{
 for(const feature of defaults)assert.ok(normalizedCity(feature).properties.id.startsWith('cn:'));
 const paths=fs.readdirSync(new URL('../map-data',import.meta.url)).filter(n=>/^cities-\d{6}\.json$/.test(n));let total=0;
 for(const path of paths){const data=JSON.parse(fs.readFileSync(new URL('../map-data/'+path,import.meta.url)));for(const feature of data.features){validCity(feature);total++;}}
 assert.ok(total>350);
});
test('invalid, open, oversized and non-geographic city boundaries cannot be saved',()=>{
 const feature=normalizedCity(defaults[0]);assert.throws(()=>validCity({...feature,properties:{...feature.properties,longitude:Infinity}}));assert.throws(()=>validCity({...feature,properties:{...feature.properties,id:'../../private'}}));assert.throws(()=>validCity({...feature,geometry:{type:'Point',coordinates:[118,32]}}));assert.throws(()=>validCity({...feature,geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[0,1],[2,2]]]}}));
});
test('China selection includes Taiwan, Hong Kong and Macau without a second country entry',()=>{
 const countries=JSON.parse(fs.readFileSync(new URL('../countries.geojson',import.meta.url))).features;
 assert.ok(!countries.some(f=>['TWN','HKG','MAC'].includes(f.properties.id)));
 for(const [x,y] of [[121.5654,25.033],[114.1694,22.3193],[113.5439,22.1987]])assert.equal(countryAt(countries,x,y)?.properties.id,'CHN');
 const china=JSON.parse(fs.readFileSync(new URL('../map-data/CHN.json',import.meta.url)));assert.ok(china.regions.some(f=>f.properties.name==='台湾省'));assert.ok(sharedCountryEdges(china.regions).length>1000);
});
test('small country close views use detailed vector geometry rather than enlarged raster pixels',()=>{
 for(const id of ['SGP','MLT']){const data=JSON.parse(fs.readFileSync(new URL(`../map-data/${id}.json`,import.meta.url))),geometry=citySurfaceGeometry(data.country,1.002,.025);assert.ok(geometry.attributes.position.count>90);assert.ok(data.regions.length>0);geometry.dispose();}
});
test('deep map zoom consumes only its own distance and returns leftover reverse input to page zoom',()=>{
 assert.deepEqual(detailZoomInput(0,-450),{zoom:.5,remaining:0});assert.deepEqual(detailZoomInput(1,-450),{zoom:1,remaining:0});assert.deepEqual(detailZoomInput(.2,280),{zoom:0,remaining:100});assert.deepEqual(detailZoomInput(0,80),{zoom:0,remaining:80});
});
test('memory and comment history reject corrupt server responses before rendering',()=>{
 assert.deepEqual(validMediaPage({items:[],cursor:null}),{items:[],cursor:null});assert.throws(()=>validMediaPage({items:[],cursor:-1}));assert.throws(()=>validMediaPage({items:[{id:'bad'}],cursor:null}));assert.throws(()=>validCommentsPage({items:[{id:'bad'}],cursor:null}));
});
test('journey operations keep personal capabilities in request bodies and never in an endpoint URL',async()=>{
 const calls=[],cloud={rpc:async(name,payload)=>{calls.push({name,payload});return {saved:true};}};
 const room={id:'10000000-0000-4000-8000-000000000001',token:'a'.repeat(64)},person={id:'20000000-0000-4000-8000-000000000002',token:'b'.repeat(64)};
 const client=new JourneyClient({room,person,invalid:false},cloud);await client.comment('30000000-0000-4000-8000-000000000003','一起记得','40000000-0000-4000-8000-000000000004');assert.equal(calls[0].name,'youqi_journey');assert.equal(calls[0].payload.p_payload.token,person.token);assert.equal(calls[0].payload.p_token,room.token);assert.equal(calls[0].payload.p_payload.body,'一起记得');
});

test('unchanged city polling reads a small revision rather than downloading all geometries again',async()=>{
 const calls=[];let revision=0;const feature=normalizedCity(defaults[0]);
 const cloud={rpc:async(name,{p_action})=>{calls.push(p_action);return p_action==='city_status'?{revision}:{cities:[feature],revision};}};
 const client=new JourneyClient({room:{id:'10000000-0000-4000-8000-000000000001',token:'a'.repeat(64)},person:null,invalid:false},cloud);
 await client.cities();await client.cities();assert.deepEqual(calls,['city_status','cities','city_status']);revision=1;await client.cities();assert.deepEqual(calls.slice(-2),['city_status','cities']);
});
