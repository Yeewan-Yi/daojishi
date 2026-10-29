import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import * as THREE from '../vendor/three.module.js';
import {mountMemoryMap} from '../memory-map.js';
import {JourneyClient} from '../journey-data.js?v=20261023-albums';

const feature=(id,name,west=118,country='CHN',region='')=>({type:'Feature',properties:{id,name,country,region,longitude:west+.25,latitude:32.25},geometry:{type:'Polygon',coordinates:[[[west,32],[west+.5,32],[west+.5,32.5],[west,32.5],[west,32]]]}});
const cities=[feature('cn:320100','南京',118,'CHN','江苏省'),feature('cn:330600','绍兴',120,'CHN','浙江省')];
const regions=[feature('320000','江苏省'),feature('330000','浙江省',120),feature('710000','台湾省',121)];
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
function setup(t,{deferCities=false}={}){
 const set=(name,value)=>{const previous=Object.getOwnPropertyDescriptor(globalThis,name);Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});t.after(()=>previous?Object.defineProperty(globalThis,name,previous):delete globalThis[name]);};
 const {document,window}=parseHTML('<html><body><nav class="header-actions"></nav><div id="globe"></div></body></html>');
 for(const [name,value]of Object.entries({document,window,location:{href:'http://localhost/?mode=local',hash:''},localStorage:{getItem:key=>key==='youqi.journey.local-cities'?JSON.stringify(cities):null,setItem(){}},requestAnimationFrame:callback=>setImmediate(callback),addEventListener(){},setInterval(){}}))set(name,value);
 // linkedom omits the native select setter and Option constructor.
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value||this.querySelector('option')?.value||'';},set(value){for(const option of this.querySelectorAll('option'))option.removeAttribute('selected');[...this.querySelectorAll('option')].find(option=>option.value===value)?.setAttribute('selected','');}});
 set('Option',function(text,value){const node=document.createElement('option');node.textContent=text;node.value=value;return node;});
 const pending=[];
 t.mock.method(globalThis,'fetch',async url=>{
  const path=String(url);
  if(path.includes('cities-')&&deferCities)return new Promise(resolve=>pending.push(()=>resolve({ok:true,json:async()=>({features:cities})})));
  const data=path.includes('countries.geojson')?{features:[feature('CHN','中国')]}:path.includes('/CHN.json')?{country:feature('CHN','中国'),regions}:path.includes('detail-land')?{features:[]}:path.includes('cities-')?{features:cities}:null;
  assert.ok(data,'known map request');return {ok:true,json:async()=>data};
 });
 const controller=mountMemoryMap(new THREE.Group(),document.querySelector('#globe'),{onFocus(){},onExit(){}});
 return {document,controller,pending};
}
test('optional city precision never blocks readiness or existing city choices',async t=>{
 const f=setup(t,{deferCities:true});await f.controller.ready;
 assert.equal(f.document.querySelectorAll('.memory-city-pin').length,2);
 assert.equal(f.pending.length,2);
 for(const resolve of f.pending)resolve();await flush();
 assert.equal(f.document.querySelectorAll('.memory-city-pin').length,2);
});
test('choosing a visited city synchronizes province and city selectors, including switching cities',async t=>{
 const f=setup(t);await f.controller.ready;f.document.querySelector('.atlas-trigger').click();await flush();
 f.document.querySelector('[data-city="cn:320100"]').click();await flush();
 assert.equal(f.document.querySelector('.atlas-region-picker select').value,'320000');assert.equal(f.document.querySelector('.atlas-city-picker select').value,'cn:320100');
 f.document.querySelector('[data-city="cn:330600"]').click();await flush();
 assert.equal(f.document.querySelector('.atlas-region-picker select').value,'330000');assert.equal(f.document.querySelector('.atlas-city-picker select').value,'cn:330600');
 assert.equal(f.document.querySelector('.atlas-city-detail h3').textContent,'绍兴');
});
test('late city-search success or failure cannot replace the newly selected region',async t=>{
 for(const fail of [false,true])await t.test(fail?'failed old request':'successful old request',async t=>{
  const f=setup(t);let resolve,reject;t.mock.method(JourneyClient.prototype,'searchCities',()=>new Promise((yes,no)=>{resolve=yes;reject=no;}));
  await f.controller.ready;f.document.querySelector('.atlas-trigger').click();await flush();
  const picker=f.document.querySelector('.atlas-region-picker select');picker.value='710000';await picker.onchange();
  const form=f.document.querySelector('.atlas-city-search');form.querySelector('input').value='旧地区';const request=form.onsubmit({preventDefault(){}});
  assert.equal(form.querySelector('button').disabled,true);picker.value='320000';await picker.onchange();assert.equal(form.querySelector('button').disabled,false);
  if(fail)reject(Error('旧地区网络错误'));else resolve([]);await request;
  assert.equal(f.document.querySelector('.atlas-error').textContent,'');assert.equal(form.querySelector('select').hidden,true);assert.equal(picker.value,'320000');
 });
});
