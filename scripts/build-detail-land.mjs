import fs from 'node:fs';
// Source cache is produced by build-atlas-data.mjs. China uses the same geometry
// as its selectable provinces so the shore and administrative outlines coincide.
const raw=JSON.parse(fs.readFileSync('test-results/countries-10m.json')).features;
const china=JSON.parse(fs.readFileSync('map-data/CHN.json')).regions;
const features=raw.filter(f=>!['CHN','TWN','HKG','MAC'].includes(f.properties.ADM0_A3)).map(f=>({type:'Feature',properties:{},geometry:f.geometry}));
features.push(...china.map(f=>({type:'Feature',properties:{},geometry:f.geometry})));
fs.writeFileSync('detail-land.geojson',JSON.stringify({type:'FeatureCollection',features}));
console.log('Detailed vector terrain:',fs.statSync('detail-land.geojson').size,'bytes');
