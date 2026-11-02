import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {guideFor,pageGuides} from '../shared/guide-content.js';
import {validateGuide,filterChapters} from '../shared/guide-model.js';
import {mountGuide} from '../shared/guide.js';
test('all published page guides and local tools have valid illustrated task chapters',()=>{
 for(const page of Object.keys(pageGuides)){const guide=guideFor(page);assert.equal(validateGuide(guide),guide);assert.ok(guide.chapters.every(c=>c.steps.length));}
 assert.throws(()=>validateGuide({...guideFor('main'),chapters:[]}));
 const duplicate=structuredClone(guideFor('main'));duplicate.chapters.push(duplicate.chapters[0]);assert.throws(()=>validateGuide(duplicate));
});
test('guide search includes task steps and button purposes, with multiple terms and empty results',()=>{
 const guide=guideFor('memories');assert.ok(filterChapters(guide,'相册 删除').some(c=>c.id==='albums'));assert.ok(filterChapters(guide,'拍摄 地点').some(c=>c.id==='postcard'));assert.equal(filterChapters(guide,'不存在的说明xyz').length,0);assert.equal(filterChapters(guide,' ').length,guide.chapters.length);
});
test('guides remain opt-in, escape text, preserve page controls and locate without clicking',()=>{
 const {document,window}=parseHTML('<html><head></head><body><nav class="site-nav"></nav><button id="real">真实按钮</button></body></html>');globalThis.document=document;globalThis.matchMedia=()=>({matches:false});globalThis.getComputedStyle=()=>({visibility:'visible'});
 const host=document.querySelector('nav'),target=document.querySelector('#real');target.getClientRects=()=>[{}];target.scrollIntoView=()=>{};let clicks=0;target.onclick=()=>clicks++;
 const guide={title:'<img onerror=x>',intro:'说明',chapters:[{id:'one',title:'功能',summary:'用途',art:'navigation',steps:[{title:'入口',body:'<script>danger</script>',target:'#real'}],buttons:[]},{id:'two',title:'另一节',summary:'说明',art:'map',steps:[{title:'展开后',body:'操作',target:'#missing',hint:'先打开对应功能'}]}]};
 const controller=mountGuide({host,guide});assert.equal(mountGuide({host,guide}),controller);assert.equal(document.querySelectorAll('#page-guide').length,1);const panel=document.querySelector('#page-guide');assert.equal(panel.inert,true);assert.equal(panel.querySelector('h2').textContent,guide.title);assert.equal(panel.querySelector('script'),null);
 controller.open();assert.equal(panel.inert,false);panel.querySelector('.guide-locate').click();assert.equal(clicks,0);assert.ok(target.classList.contains('guide-located'));
 panel.querySelector('[data-guide-next]').click();assert.equal(panel.querySelector('h3').textContent,'另一节');panel.querySelector('.guide-locate').click();assert.equal(panel.querySelector('.guide-status').textContent,'先打开对应功能');
 const search=panel.querySelector('input');search.value='找不到';search.dispatchEvent(new window.Event('input'));assert.ok(panel.querySelector('.guide-empty'));assert.equal(panel.querySelector('[data-guide-next]').disabled,true);
 controller.close();assert.equal(panel.inert,true);assert.ok(!target.classList.contains('guide-located'));
});
