import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {guideFor,pageGuides} from '../shared/guide-content.js';
import {validateGuide} from '../shared/guide-model.js';
import {tourFor} from '../shared/guide-tour.js';
import {mountGuide} from '../shared/guide.js';
function setup(options={}){
 const {document,window}=parseHTML('<html><head></head><body><nav class="site-nav"></nav><button id="real">真实按钮</button></body></html>');globalThis.document=document;globalThis.location={pathname:'/guide-demo'};const saved=options.saved||new Map();globalThis.localStorage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};globalThis.matchMedia=()=>({matches:false});globalThis.getComputedStyle=()=>({visibility:'visible'});window.innerWidth=1200;window.innerHeight=800;
 const target=document.querySelector('#real');target.getClientRects=()=>[{}];target.getBoundingClientRect=()=>({left:0,right:100,top:0,bottom:30});target.scrollIntoView=()=>{};let clicks=0;target.onclick=()=>clicks++;
 const guide={title:'演示',intro:'',chapters:[{id:'demo',title:'介绍',summary:'说明',art:'navigation',steps:[{title:'入口',body:'说明',target:'#real'}]}],tour:[{title:'先认识这里',body:'<script>不是可执行代码</script>',target:'#real'},{title:'再看看这里',body:'这是第二个介绍',target:'#missing'}]};
 const host=document.querySelector('nav'),controller=mountGuide({host,guide,auto:false,...options}),panel=document.querySelector('#page-guide');panel.getBoundingClientRect=()=>({left:700,right:1000,top:400,bottom:700});return {document,window,saved,controller,panel,host,target,clicks:()=>clicks};
}
test('each page has one ordered introduction, with short readable sentences',()=>{
 for(const page of Object.keys(pageGuides)){const content=validateGuide(guideFor(page)),steps=tourFor(page,content);assert.ok(steps.length);assert.ok(steps.every(s=>s.title&&s.body&&s.body.length<120));}
 assert.match(tourFor('main',guideFor('main'))[0].body,/倒计时/);assert.match(tourFor('memories',guideFor('memories'))[0].body,/拾光/);
});
test('opening the guide begins immediately, proceeds across the page, and never shows a task menu',async()=>{
 const f=setup();assert.equal(f.panel.inert,true);assert.equal(mountGuide({host:f.host}),f.controller);await f.controller.open();assert.equal(f.panel.querySelector('h2').textContent,'先认识这里');assert.equal(f.panel.querySelector('.guide-task'),null);assert.equal(f.panel.querySelector('input'),null);assert.equal(f.panel.querySelector('script'),null);assert.equal(f.panel.querySelector('.guide-instruction').textContent,'<script>不是可执行代码</script>');assert.ok(f.target.classList.contains('guide-located'));assert.equal(f.clicks(),0);
 await f.panel.querySelector('.guide-next').onclick();assert.equal(f.panel.querySelector('h2').textContent,'再看看这里');assert.ok(!f.target.classList.contains('guide-located'));await f.panel.querySelector('.guide-prev').onclick();assert.equal(f.panel.querySelector('h2').textContent,'先认识这里');await f.panel.querySelector('.guide-next').onclick();await f.panel.querySelector('.guide-next').onclick();assert.equal(f.panel.querySelector('h2').textContent,'现在，可以慢慢逛了');await f.panel.querySelector('.guide-next').onclick();assert.equal(f.panel.inert,true);assert.equal(f.clicks(),0);
});
test('skipping removes the spotlight, remembers the choice and permits a fresh replay',async()=>{
 const f=setup();await f.controller.open();assert.equal(f.document.querySelector('.guide-spotlight').hidden,false);await f.panel.querySelector('.guide-skip').onclick();assert.equal(f.document.querySelector('.guide-spotlight').hidden,true);assert.equal(f.saved.get('youqi.guide.welcome./guide-demo'),'seen');await f.controller.open();assert.equal(f.panel.querySelector('h2').textContent,'先认识这里');await f.controller.close();
});
test('first visit offers an invitation without taking focus, and does not repeat after skipping',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=setup({auto:true});f.window.dispatchEvent(new f.window.Event('load'));t.mock.timers.tick(901);assert.equal(f.panel.inert,false);assert.match(f.panel.querySelector('h2').textContent,/一起认识/);assert.equal(f.document.querySelector('.guide-spotlight').hidden,true);await f.panel.querySelector('.guide-skip').onclick();
 const next=setup({auto:true,saved:f.saved});next.window.dispatchEvent(new next.window.Event('load'));t.mock.timers.tick(901);assert.equal(next.panel.inert,true);next.controller.close();
});
test('custom subsites can supply an ordered tour while old chapter data remains compatible',()=>{
 const content=guideFor('starter'),tour=[{title:'欢迎',body:'先看这里',target:'#draft'}];assert.equal(tourFor('starter',{...content,tour},true),tour);assert.equal(tourFor('starter',content,true).length,content.chapters.length);
});
test('a paused tour resumes the same step and can explicitly restart',async()=>{
 const first=setup();await first.controller.open();await first.panel.querySelector('.guide-next').onclick();await first.controller.close();const second=setup({saved:first.saved});await second.controller.open();assert.equal(second.panel.querySelector('h2').textContent,'再看看这里');await second.panel.querySelector('.guide-restart').onclick();assert.equal(second.panel.querySelector('h2').textContent,'先认识这里');await second.controller.close();
});
test('mobile navigation is exposed for the introduction and restored on exit',async()=>{
 const f=setup();globalThis.matchMedia=q=>({matches:q.includes('max-width')});const menu=f.document.createElement('div');menu.className='mobile-tools-panel';menu.setAttribute('inert','');f.document.body.append(menu);menu.append(f.target);const toggle=f.document.createElement('button');toggle.className='mobile-tools-toggle';toggle.setAttribute('aria-expanded','false');toggle.onclick=()=>{const value=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(value));if(value)menu.removeAttribute('inert');else menu.setAttribute('inert','');};f.host.append(toggle);await f.controller.open();assert.equal(toggle.getAttribute('aria-expanded'),'true');assert.ok(f.target.classList.contains('guide-located'));await f.controller.close();assert.equal(toggle.getAttribute('aria-expanded'),'false');assert.ok(menu.hasAttribute('inert'));
});
