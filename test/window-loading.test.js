import test from 'node:test';
import assert from 'node:assert/strict';
import {startBoot} from '../boot.js';
import {openModal,closeModal} from '../motion.js';

function environment(t){
  t.mock.timers.enable({apis:['setTimeout']});
  const properties=new Map(),caption={textContent:''},loader={hidden:false,style:{setProperty:(key,value)=>properties.set(key,value)},setAttribute(){},querySelector:()=>caption};
  const root={dataset:{boot:'pending'}},document={documentElement:root,getElementById:()=>loader};
  const originals=new Map(['document','matchMedia'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  Object.defineProperty(globalThis,'document',{value:document,configurable:true});Object.defineProperty(globalThis,'matchMedia',{value:()=>({matches:false}),configurable:true});
  t.after(()=>{for(const[key,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  return {root,loader,properties,caption,tick:ms=>t.mock.timers.tick(ms)};
}
test('a quick load skips the flight overlay instead of flashing it',t=>{
  const ui=environment(t),boot=startBoot();boot.finish();ui.tick(2000);
  assert.equal(ui.loader.hidden,true);assert.equal(ui.root.dataset.boot,undefined);
});
test('the plane cannot reach its destination before readiness and fades out after arrival',t=>{
  const ui=environment(t),boot=startBoot();ui.tick(150);assert.equal(ui.root.dataset.boot,'loading');
  boot.advance(1);assert.equal(ui.properties.get('--boot-progress'),.9);
  boot.advance(.1);assert.equal(ui.properties.get('--boot-progress'),.9);
  boot.finish();assert.equal(ui.properties.get('--boot-progress'),1);assert.equal(ui.loader.hidden,false);
  ui.tick(720);assert.equal(ui.root.dataset.boot,'ready');ui.tick(400);assert.equal(ui.loader.hidden,true);
});
test('reopening a window cancels an in-progress dismissal',t=>{
  const ui=environment(t),classes=new Set(),dialog={open:false,classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},showModal(){this.open=true;},close(){this.open=false;}};
  openModal(dialog);closeModal(dialog);assert.equal(dialog.open,true);assert.equal(classes.has('is-closing'),true);
  ui.tick(100);openModal(dialog);ui.tick(300);assert.equal(dialog.open,true);assert.equal(classes.has('is-closing'),false);
  closeModal(dialog);ui.tick(220);assert.equal(dialog.open,false);
});
