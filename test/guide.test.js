import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {guideFor,pageGuides} from '../shared/guide-content.js';
import {validateGuide,filterChapters} from '../shared/guide-model.js';
import {mountGuide} from '../shared/guide.js';
import {quickTask} from '../shared/guide-quick.js';
test('all published page guides and local tools have valid illustrated task chapters',()=>{
 for(const page of Object.keys(pageGuides)){const guide=guideFor(page);assert.equal(validateGuide(guide),guide);assert.ok(guide.chapters.every(c=>c.steps.length));}
 assert.throws(()=>validateGuide({...guideFor('main'),chapters:[]}));
 const duplicate=structuredClone(guideFor('main'));duplicate.chapters.push(duplicate.chapters[0]);assert.throws(()=>validateGuide(duplicate));
});
test('guide search includes task steps and button purposes, with multiple terms and empty results',()=>{
 const guide=guideFor('memories');assert.ok(filterChapters(guide,'相册 删除').some(c=>c.id==='albums'));assert.ok(filterChapters(guide,'拍摄 地点').some(c=>c.id==='postcard'));assert.equal(filterChapters(guide,'不存在的说明xyz').length,0);assert.equal(filterChapters(guide,' ').length,guide.chapters.length);
});
test('guides show a flat task list, then one action at a time without clicking page controls',()=>{
 const {document,window}=parseHTML('<html><head></head><body><nav class="site-nav"></nav><button id="real">真实按钮</button></body></html>');globalThis.document=document;globalThis.matchMedia=()=>({matches:false});globalThis.getComputedStyle=()=>({visibility:'visible'});
 const host=document.querySelector('nav'),target=document.querySelector('#real');target.getClientRects=()=>[{}];target.getBoundingClientRect=()=>({left:0,right:10,top:0,bottom:10});target.scrollIntoView=()=>{};let clicks=0;target.onclick=()=>clicks++;
 const guide={title:'<img onerror=x>',intro:'说明',chapters:[{id:'one',title:'功能',summary:'用途',art:'navigation',steps:[{title:'入口',body:'<script>danger</script>',target:'#real'}],buttons:[]},{id:'two',title:'另一节',summary:'说明',art:'map',steps:[{title:'展开后',body:'操作',target:'#missing',hint:'先打开对应功能'}]}]};
 const controller=mountGuide({host,guide});assert.equal(mountGuide({host,guide}),controller);assert.equal(document.querySelectorAll('#page-guide').length,1);const panel=document.querySelector('#page-guide');assert.equal(panel.inert,true);assert.equal(panel.querySelectorAll('.guide-task').length,2);assert.equal(panel.querySelector('script'),null);assert.equal(panel.querySelector('input'),null);
 panel.getBoundingClientRect=()=>({left:20,right:30,top:20,bottom:30});controller.open();assert.equal(panel.inert,false);panel.querySelector('.guide-task').click();assert.equal(panel.querySelector('.guide-instruction').textContent,'<script>danger</script>');assert.equal(panel.querySelector('script'),null);assert.ok(target.classList.contains('guide-located'));panel.querySelector('.guide-try').click();assert.equal(clicks,0);
 panel.querySelector('.guide-next').click();assert.equal(panel.querySelectorAll('.guide-task').length,2);panel.querySelectorAll('.guide-task')[1].click();panel.querySelector('.guide-try').click();assert.equal(panel.querySelector('.guide-status').textContent,'先打开对应功能');
 controller.close();assert.equal(panel.inert,true);assert.ok(!target.classList.contains('guide-located'));
});
test('short instructions preserve task order and point at the control named in the sentence',()=>{
 for(const [page,guide] of Object.entries(pageGuides))for(const chapter of guide.chapters){const quick=quickTask(chapter);assert.equal(quick.steps.length,chapter.steps.length);assert.ok(quick.steps.every(step=>step.body.length<100),`${page}/${chapter.id}`);}
 const cities=quickTask(pageGuides.memories.chapters[0]);assert.equal(cities.steps[0].target,'#city-title');assert.equal(cities.steps[1].target,'.destination-menu');
});
test('opening a real panel advances the prompt without changing any form values',()=>{
 const {document}=parseHTML('<html><head></head><body><nav></nav><button id="open">打开</button><dialog id="demo"><input value="保留这句话"></dialog></body></html>');globalThis.document=document;globalThis.matchMedia=()=>({matches:false});globalThis.getComputedStyle=()=>({visibility:'visible'});
 const guide={title:'演示',intro:'',chapters:[{id:'demo',title:'试一下',summary:'说明',art:'calendar',steps:[{title:'打开',body:'打开窗口',advanceWhen:'#demo[open]'},{title:'输入',body:'现在可以写字了'}]}]};
 const controller=mountGuide({host:document.querySelector('nav'),guide});controller.open();document.querySelector('.guide-task').click();document.querySelector('#open').onclick=()=>document.querySelector('dialog').setAttribute('open','');document.querySelector('#open').click();assert.equal(document.querySelector('.guide-instruction').textContent,'现在可以写字了');assert.equal(document.querySelector('input').value,'保留这句话');controller.close();
});
