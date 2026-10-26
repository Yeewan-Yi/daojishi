import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';
import {THEME_KEY,createThemeController,nextThemeMode,resolveTheme} from '../shared/theme.js';
function fixture(saved,dark=false){const values=new Map(saved===undefined?[]:[[THEME_KEY,saved]]),changes=[],events=new EventTarget(),media=new EventTarget();media.matches=dark;const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};const controller=createThemeController({storage,media,events,onChange:value=>changes.push(value)});return {controller,values,changes,events,system(value){media.matches=value;media.dispatchEvent(new Event('change'));},external(value,key=THEME_KEY){events.dispatchEvent(Object.assign(new Event('storage'),{key,newValue:value}));}};}

test('theme modes cycle dark, light, system without overwriting existing explicit preferences',()=>{
 const f=fixture('dark',true);assert.equal(f.controller.mode,'dark');for(const expected of ['light','system','dark']){f.controller.cycle();assert.equal(f.controller.mode,expected);assert.equal(f.values.get(THEME_KEY),expected);}assert.equal(nextThemeMode('system'),'dark');
});
test('unset or invalid preferences follow the system and update immediately when it changes',()=>{
 for(const saved of [undefined,'invalid','system']){const f=fixture(saved,false);assert.deepEqual(f.changes.at(-1),{mode:'system',theme:'light',next:'dark'});f.system(true);assert.equal(f.changes.at(-1).theme,'dark');assert.equal(f.controller.mode,'system');assert.equal(f.values.get(THEME_KEY),saved);}
});
test('manual modes remain fixed when system appearance changes',()=>{
 for(const mode of ['dark','light']){const f=fixture(mode,false);f.system(true);f.system(false);assert.equal(f.changes.length,1);assert.equal(f.changes[0].theme,mode);}
});
test('cross-tab changes, preference removal and clearing storage update the active mode',()=>{
 const f=fixture('dark',true);f.external('light');assert.equal(f.changes.at(-1).theme,'light');f.external('system');assert.equal(f.changes.at(-1).theme,'dark');f.system(false);assert.equal(f.changes.at(-1).theme,'light');f.external('dark','unrelated');assert.equal(f.controller.mode,'system');f.external(null);assert.equal(f.controller.mode,'system');f.external('dark');f.external(null,null);assert.equal(f.controller.mode,'system');
});
test('blocked storage does not prevent theme switching, and disposed controllers stop listening',()=>{
 const media=new EventTarget(),events=new EventTarget(),changes=[];media.matches=true;const controller=createThemeController({storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}},media,events,onChange:value=>changes.push(value)});assert.equal(changes[0].theme,'dark');controller.cycle();controller.cycle();assert.equal(changes.at(-1).theme,'light');controller.dispose();const count=changes.length;media.dispatchEvent(new Event('change'));events.dispatchEvent(Object.assign(new Event('storage'),{key:THEME_KEY,newValue:'dark'}));assert.equal(changes.length,count);
});
test('pre-paint initialization agrees with runtime resolution for all saved modes',()=>{
 const source=readFileSync(new URL('../shared/theme-init.js',import.meta.url),'utf8');
 for(const mode of [null,'dark','light','system','invalid'])for(const dark of [false,true]){const root={dataset:{}};runInNewContext(source,{document:{documentElement:root},localStorage:{getItem:()=>mode},matchMedia:()=>({matches:dark})});assert.equal(root.dataset.theme,resolveTheme(mode,dark));assert.equal(root.dataset.themeMode,['dark','light'].includes(mode)?mode:'system');}
 const root={dataset:{}};runInNewContext(source,{document:{documentElement:root},localStorage:{getItem(){throw Error('blocked');}},matchMedia:()=>({matches:true})});assert.equal(root.dataset.theme,'dark');
});
