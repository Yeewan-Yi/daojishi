import test from 'node:test';
import assert from 'node:assert/strict';
import {mountLetters} from '../letters-ui.js';

function emit(target,type,properties={}){
  const event=new Event(type,{cancelable:true});
  for(const [key,value] of Object.entries(properties))Object.defineProperty(event,key,{value});
  target.dispatchEvent(event);
  return event;
}
function notebook(t){
  t.mock.timers.enable({apis:['setTimeout']});
  const elements=new Map(), document=new EventTarget(), window=new EventTarget();
  class Element extends EventTarget{
    constructor(id){super();this.id=id;this.hover=false;this.value='';this.attributes=new Map();this.blurCount=0;this.submits=0;const classes=new Set();this.classList={toggle(name,on){if(on??!classes.has(name))classes.add(name);else classes.delete(name);},contains:name=>classes.has(name),add:name=>classes.add(name),remove:name=>classes.delete(name)};this.style={setProperty(){}};}
    replaceChildren(...children){this.children=children;}
    matches(selector){return selector===':hover'?this.hover:['letter-body','letter-name-self','letter-name-other'].includes(this.id);}
    contains(element){return !!element&&element.id!=='outside';}
    setAttribute(key,value){this.attributes.set(key,value);}
    getAttribute(key){return this.attributes.get(key);}
    focus(){document.activeElement=this;emit(get('letters-dock'),'focusin',{target:this});}
    blur(){this.blurCount++;document.activeElement=null;}
    requestSubmit(){this.submits++;}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
  document.getElementById=get;document.body=new Element('body');document.activeElement=null;
  const fine=new EventTarget();fine.matches=true;
  const replacements={document,window,location:{hash:''},localStorage:{getItem(){return null;},setItem(){}},matchMedia:()=>fine,addEventListener:window.addEventListener.bind(window)};
  const originals=new Map(Object.keys(replacements).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(replacements))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  t.after(()=>{for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  mountLetters({getContext:()=>({room:null,record:null}),openSharing(){},notify(){}});
  const dock=get('letters-dock'), editor=get('letter-body'), trigger=get('letters-trigger');
  const open=()=>{dock.hover=true;emit(dock,'pointerenter',{pointerType:'mouse'});};
  const leave=()=>{dock.hover=false;emit(dock,'pointerleave',{pointerType:'mouse'});};
  const expanded=()=>trigger.getAttribute('aria-expanded')==='true';
  return {get,document,window,dock,editor,trigger,open,leave,expanded,tick:ms=>t.mock.timers.tick(ms)};
}

test('leaving with an active text field keeps the notebook and typing focus intact',t=>{
  const ui=notebook(t);ui.open();ui.editor.focus();ui.leave();ui.tick(1000);
  assert.equal(ui.expanded(),true);assert.equal(ui.document.activeElement,ui.editor);assert.equal(ui.editor.blurCount,0);
});
test('IME candidate focus loss and composition completion do not collapse the editing session',t=>{
  const ui=notebook(t);ui.open();ui.editor.focus();emit(ui.dock,'compositionstart',{target:ui.editor});
  ui.leave();emit(ui.dock,'focusout',{target:ui.editor,relatedTarget:null});ui.tick(1000);
  assert.equal(ui.expanded(),true);
  emit(ui.dock,'compositionend',{target:ui.editor});ui.tick(1000);assert.equal(ui.expanded(),true);
});
test('clicking outside releases editing protection and restores automatic closing',t=>{
  const ui=notebook(t);ui.open();ui.editor.focus();ui.leave();
  const outside=ui.get('outside');emit(ui.document,'pointerdown',{target:outside});ui.document.activeElement=outside;
  emit(ui.dock,'focusout',{target:ui.editor,relatedTarget:null});ui.tick(300);assert.equal(ui.expanded(),false);
});
test('tabbing away releases protection, and ordinary hover viewing still closes on leave',t=>{
  const ui=notebook(t);ui.open();ui.editor.focus();ui.leave();
  emit(ui.window,'keydown',{key:'Tab'});ui.document.activeElement=ui.get('outside');
  emit(ui.dock,'focusout',{target:ui.editor,relatedTarget:ui.get('outside')});ui.tick(1);ui.tick(300);assert.equal(ui.expanded(),false);
  ui.open();ui.leave();ui.tick(300);assert.equal(ui.expanded(),false);
});
test('Escape cancels IME selection without closing; a later Escape can explicitly close',t=>{
  const ui=notebook(t);ui.open();ui.editor.focus();emit(ui.dock,'compositionstart');
  const cancel=emit(ui.window,'keydown',{key:'Escape',isComposing:true});
  assert.equal(cancel.defaultPrevented,false);assert.equal(ui.expanded(),true);
  emit(ui.dock,'compositionend');ui.tick(600);emit(ui.window,'keydown',{key:'Escape',isComposing:false});assert.equal(ui.expanded(),false);
});
test('Ctrl+Enter during composition never submits an unfinished message',t=>{
  const ui=notebook(t);ui.open();ui.editor.focus();emit(ui.dock,'compositionstart');
  emit(ui.editor,'keydown',{key:'Enter',ctrlKey:true,isComposing:true});assert.equal(ui.get('letter-form').submits,0);
  ui.editor.value='想对你说的话';emit(ui.dock,'compositionend');emit(ui.editor,'keydown',{key:'Enter',ctrlKey:true,isComposing:false});assert.equal(ui.get('letter-form').submits,1);
});

test('delivery is disabled for empty, whitespace, oversized and composing drafts',t=>{
  const ui=notebook(t), send=ui.get('letter-send');
  assert.equal(send.disabled,true);
  for(const text of ['   \n', '字'.repeat(501)]){
    ui.editor.value=text;emit(ui.editor,'input');assert.equal(send.disabled,true);
    emit(ui.editor,'keydown',{key:'Enter',ctrlKey:true});assert.equal(ui.get('letter-form').submits,0);
  }
  ui.editor.value='💌'.repeat(500);emit(ui.editor,'input');assert.equal(send.disabled,false);
  emit(ui.dock,'compositionstart');assert.equal(send.disabled,true);
  emit(ui.dock,'compositionend');assert.equal(send.disabled,false);
  ui.editor.value='';emit(ui.editor,'input');assert.equal(send.disabled,true);
});

test('the writing indicator follows actual typing and rests after a pause without closing the editor',t=>{
  const ui=notebook(t);ui.open();ui.editor.focus();
  assert.equal(ui.dock.classList.contains('is-writing'),false);
  ui.editor.value='写给你';emit(ui.editor,'input');assert.equal(ui.dock.classList.contains('is-writing'),true);
  ui.tick(1200);emit(ui.editor,'input');ui.tick(1200);assert.equal(ui.dock.classList.contains('is-writing'),true);
  ui.tick(401);assert.equal(ui.dock.classList.contains('is-writing'),false);assert.equal(ui.expanded(),true);
  emit(ui.editor,'input');ui.editor.value='';emit(ui.editor,'input');assert.equal(ui.dock.classList.contains('is-writing'),false);
});

test('IME composition keeps the writing indicator active, and explicitly closing stops it',t=>{
  const ui=notebook(t);ui.open();ui.editor.focus();
  emit(ui.dock,'compositionstart',{target:ui.editor});ui.tick(1700);
  assert.equal(ui.dock.classList.contains('is-writing'),true);
  ui.editor.value='候选文字';emit(ui.dock,'compositionend',{target:ui.editor});
  ui.tick(1601);assert.equal(ui.dock.classList.contains('is-writing'),false);
  emit(ui.editor,'input');emit(ui.get('letters-close'),'click');
  assert.equal(ui.dock.classList.contains('is-writing'),false);
});

test('native IME focus moving to body or a proxy control does not end the editing session',t=>{
  const ui=notebook(t);ui.open();ui.editor.focus();ui.leave();
  ui.document.activeElement=ui.get('outside');
  emit(ui.dock,'focusout',{target:ui.editor,relatedTarget:ui.get('outside')});ui.tick(300);
  assert.equal(ui.expanded(),true);
  emit(ui.dock,'focusin',{target:ui.get('letters-links-button')});ui.leave();ui.tick(500);
  assert.equal(ui.expanded(),true);
});
test('candidate mouse events before and immediately after composition commit cannot close the notebook',t=>{
  const ui=notebook(t);ui.open();ui.editor.focus();ui.leave();emit(ui.dock,'compositionstart');
  emit(ui.document,'pointerdown',{target:ui.get('outside')});ui.tick(300);assert.equal(ui.expanded(),true);
  emit(ui.dock,'compositionend');emit(ui.document,'pointerdown',{target:ui.get('outside')});
  emit(ui.window,'keydown',{key:'Escape',isComposing:false});ui.tick(600);assert.equal(ui.expanded(),true);
  emit(ui.document,'pointerdown',{target:ui.get('outside')});ui.tick(300);assert.equal(ui.expanded(),false);
});
test('native-window mouse forwarding while the document lacks focus cannot end editing',t=>{
  const ui=notebook(t);ui.open();ui.editor.focus();ui.leave();ui.document.hasFocus=()=>false;
  emit(ui.document,'pointerdown',{target:ui.get('outside')});ui.tick(300);assert.equal(ui.expanded(),true);
  ui.document.hasFocus=()=>true;emit(ui.document,'pointerdown',{target:ui.get('outside')});ui.tick(300);assert.equal(ui.expanded(),false);
});
