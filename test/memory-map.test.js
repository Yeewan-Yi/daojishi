import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {countryAt,countryView,VISITED_CITIES,canPickCountry,sharedCountryEdges} from '../memory-map.js';
const countries=JSON.parse(readFileSync(new URL('../countries.geojson',import.meta.url))).features;
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
  for(const country of countries){const view=countryView(country);assert.ok(Object.values(view).every(Number.isFinite),country.properties.id);assert.ok(view.distance>=1.38&&view.distance<=3);}
  assert.deepEqual(VISITED_CITIES.map(city=>city.name),['南京','绍兴']);
});
