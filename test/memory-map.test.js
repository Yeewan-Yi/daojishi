import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {countryAt,countryView,VISITED_CITIES,canPickCountry,sharedCountryEdges,citySurfaceGeometry,cityOutlineGeometry,alignCityBoundaries,CITY_FILL_RADIUS,CITY_EDGE_RADIUS,MAP_SURFACE_RADIUS} from '../memory-map.js';
const countries=JSON.parse(readFileSync(new URL('../countries.geojson',import.meta.url))).features;
const cities=JSON.parse(readFileSync(new URL('../visited-cities.geojson',import.meta.url))).features;

test('visited city areas cover their city centers and form finite curved surface triangles',()=>{
  for(const city of VISITED_CITIES){
    const feature=countryAt(cities,city.longitude,city.latitude);
    assert.equal(feature?.properties.name,city.name);
    const geometry=citySurfaceGeometry(feature),positions=geometry.getAttribute('position');
    assert.ok(positions.count>300);assert.equal(positions.count%3,0);
    for(let i=0;i<positions.count;i++){
      const radius=Math.hypot(positions.getX(i),positions.getY(i),positions.getZ(i));
      assert.ok(Math.abs(radius-CITY_FILL_RADIUS)<.000001,'city area follows the globe above its surface');
    }
    geometry.dispose();
  }
  assert.equal(countryAt(cities,121.4737,31.2304),null,'nearby Shanghai is not highlighted as visited');
});

test('saved city highlights use the same boundary vertices as the district map without changing saved records',()=>{
  const boundaries=['320000','330000'].flatMap(id=>JSON.parse(readFileSync(new URL('../map-data/cities-'+id+'.json',import.meta.url))).features);
  const before=JSON.stringify(cities),aligned=alignCityBoundaries(cities,boundaries);
  for(const city of aligned){const canonical=boundaries.find(f=>f.properties.id===city.properties.id);assert.deepEqual(city.geometry,canonical.geometry);const original=cities.find(f=>'cn:'+f.properties.id===city.properties.id);assert.equal(city.properties.name,original.properties.name);assert.equal(city.properties.longitude,original.properties.longitude);}
  assert.equal(JSON.stringify(cities),before);
  assert.deepEqual(alignCityBoundaries(cities,[]).map(f=>f.geometry),cities.map(f=>f.geometry),'missing optional map retains saved boundaries');
});

test('city fill and outline remain attached to the terrain under close perspective',()=>{
  for(const feature of cities){const geometry=cityOutlineGeometry(feature),p=geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert.ok(Math.abs(Math.hypot(p.getX(i),p.getY(i),p.getZ(i))-CITY_EDGE_RADIUS)<.000001);geometry.dispose();}
  // At the closest camera distance, a lifted shell used to magnify an identical
  // boundary by over 20%. Keep the fill/terrain projection difference below 0.3%.
  const projected=r=>r/(1.04-r);
  assert.ok(Math.abs(projected(CITY_FILL_RADIUS)/projected(MAP_SURFACE_RADIUS)-1)<.003);
  assert.ok(CITY_EDGE_RADIUS>CITY_FILL_RADIUS);
});

test('city surface triangulation preserves holes instead of filling unvisited enclaves',()=>{
  const feature={geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]],[[.2,.2],[.2,.8],[.8,.8],[.8,.2],[.2,.2]]]}};
  const geometry=citySurfaceGeometry(feature),p=geometry.getAttribute('position');
  for(let i=0;i<p.count;i+=3){
    const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
    const lon=Math.atan2(x,z)*180/Math.PI,lat=Math.atan2(y,Math.hypot(x,z))*180/Math.PI;
    assert.ok(!(lon>.201&&lon<.799&&lat>.201&&lat<.799),'hole remains empty');
  }
  geometry.dispose();
});
test('country clicks are gated until the close zoom level, including after page scrolling',()=>{
  for(const zoom of [0,.25,.65,.8,.859])assert.equal(canPickCountry(zoom),false);
  assert.equal(canPickCountry(.86),true);assert.equal(canPickCountry(1),true);
  assert.equal(canPickCountry(1,.2),false);
});
test('frontiers are shared once, while coastline-only edges are omitted',()=>{
  const square=(id,west,east)=>({properties:{id},geometry:{type:'Polygon',coordinates:[[[west,0],[east,0],[east,1],[west,1],[west,0]]]}});
  const a=square('a',0,1),b=square('b',1,2);
  assert.equal(sharedCountryEdges([a]).length,0);
  const edges=sharedCountryEdges([a,b]);assert.equal(edges.length,1);
  assert.deepEqual([...edges[0].owners],['a','b']);
  assert.equal(edges[0].a[0],1);assert.equal(edges[0].b[0],1);
  const worldEdges=sharedCountryEdges(countries);
  assert.ok(worldEdges.filter(edge=>edge.owners.has('CHN')).length>1000,'retain the detailed 50m frontier vertices');
});
test('geographic picking finds shared cities and distinguishes land from ocean',()=>{
  for(const city of VISITED_CITIES)assert.equal(countryAt(countries,city.longitude,city.latitude)?.properties.id,city.country);
  assert.equal(countryAt(countries,-122.3321,47.6062)?.properties.id,'USA');
  assert.equal(countryAt(countries,2.35,48.85)?.properties.id,'FRA');
  assert.equal(countryAt(countries,140,36)?.properties.id,'JPN');
  assert.equal(countryAt(countries,0,0),null);
  assert.equal(countryAt(countries,179,0),null);
});
test('country picking handles islands across the date line and holes in polygons',()=>{
  const feature={geometry:{type:'Polygon',coordinates:[[[170,-10],[-170,-10],[-170,10],[170,10],[170,-10]],[[175,-3],[-175,-3],[-175,3],[175,3],[175,-3]]]},properties:{id:'test'}};
  assert.equal(countryAt([feature],179,8),feature);assert.equal(countryAt([feature],-179,8),feature);
  assert.equal(countryAt([feature],0,8),null);assert.equal(countryAt([feature],179,0),null);
});
test('every country produces a finite camera fit outside the globe',()=>{
  for(const country of countries){const view=countryView(country);assert.ok(Object.values(view).every(Number.isFinite),country.properties.id);assert.ok(view.distance>=1.09&&view.distance<=3);}
  assert.deepEqual(VISITED_CITIES.map(city=>city.name),['南京','绍兴']);
});
