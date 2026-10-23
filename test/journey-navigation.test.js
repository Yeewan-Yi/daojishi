import test from 'node:test';import assert from 'node:assert/strict';
import {journeyTree,CONTINENTS} from '../journey-navigation.js';
test('journey navigation retains seven continents but contains only visited countries and cities',()=>{
 const countries={CHN:{name:'中国',continent:'亚洲'},FRA:{name:'法国',continent:'欧洲'}};
 const city=(name,country,region,visited=true)=>({properties:{id:name,name,country,region,visited}});
 const tree=journeyTree([city('南京','CHN','江苏省'),city('绍兴','CHN','浙江省'),city('巴黎','FRA','法兰西岛',false)],countries);
 assert.deepEqual(tree.map(t=>t.name),CONTINENTS);assert.equal(tree[1].countries.length,0);
 assert.equal(tree[0].countries.length,1);assert.equal(tree[0].countries[0].regions.length,2);
 assert.equal(tree[0].countries[0].regions[0].cities[0].properties.name,'南京');
});
