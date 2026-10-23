import test from 'node:test';import assert from 'node:assert/strict';
import {journeyTree,CONTINENTS,cityChoices} from '../journey-navigation.js';
test('journey navigation retains seven continents but contains only visited countries and cities',()=>{
 const countries={CHN:{name:'中国',continent:'亚洲'},FRA:{name:'法国',continent:'欧洲'}};
 const city=(name,country,region,visited=true)=>({properties:{id:name,name,country,region,visited}});
 const tree=journeyTree([city('南京','CHN','江苏省'),city('绍兴','CHN','浙江省'),city('巴黎','FRA','法兰西岛',false)],countries);
 assert.deepEqual(tree.map(t=>t.name),CONTINENTS);assert.equal(tree[1].countries.length,0);
 assert.equal(tree[0].countries.length,1);assert.equal(tree[0].countries[0].regions.length,2);
 assert.equal(tree[0].countries[0].regions[0].cities[0].properties.name,'南京');
});
test('city switcher allows all visited continents and prioritizes the current region without including unvisited cities',()=>{
 const country={CHN:{name:'中国',continent:'亚洲'},JPN:{name:'日本',continent:'亚洲'},FRA:{name:'法国',continent:'欧洲'}};
 const city=(name,country,region,visited=true)=>({properties:{id:name,name,country,region,visited}});
 const current=city('南京','CHN','江苏省'),cities=[city('巴黎','FRA','法兰西岛'),city('东京','JPN','东京都'),city('苏州','CHN','江苏省'),city('绍兴','CHN','浙江省'),current,city('大阪','JPN','大阪府',false)];
 const rows=cityChoices(cities,current,country);assert.deepEqual(rows.map(r=>r.city.properties.name),['南京','苏州','绍兴','东京','巴黎']);
 assert.deepEqual(rows.map(r=>r.rank),[0,0,1,2,3]);
 assert.deepEqual(cityChoices(cities,current,country,'日本').map(r=>r.city.properties.name),['东京']);
 assert.equal(cityChoices(cities,current,country,'不存在').length,0);
});
