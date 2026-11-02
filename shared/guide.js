import {guideFor} from './guide-content.js';
import {validateGuide} from './guide-model.js';
import {guideIllustration} from './guide-art.js';
import {quickTask} from './guide-quick.js';
import {focusPageTool} from './focus-return.js';
const mark='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 5h10l2 3 2-3h8v22h-9l-2 2-2-2H5ZM16 9v15M8 10h4m-4 5h4m8-5h4m-4 5h4"/><path d="m22 18 3 3-3 3-3-3Z"/></svg>';
const mounted=new WeakMap();
export function mountGuide({host,guide,page='main',dark=false}={}){
 if(!host)return;if(mounted.has(host))return mounted.get(host);
 const content=validateGuide(guide||guideFor(page)),tasks=content.chapters.map(row=>guide?row:quickTask(row));
 if(!document.querySelector('link[data-guide-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./guide.css?v=20261102-easy',import.meta.url).href;link.dataset.guideStyle='';document.head.append(link);}
 const button=document.createElement('button');button.type='button';button.dataset.guideButton='';button.className=host.classList.contains('header-actions')?'icon-button nav-tool':host.classList.contains('site-nav')?'site-tool':host.closest('.memory-header')?'line-action':'guide-entry';button.setAttribute('aria-label','使用指引');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','page-guide');button.innerHTML=mark+'<span class="nav-caption" aria-hidden="true">指引</span>';host.append(button);
 const panel=document.createElement('aside');panel.style.display='none';panel.id='page-guide';panel.className='page-guide'+(dark?' guide-dark':'');panel.setAttribute('aria-label',content.title+'使用指引');panel.setAttribute('aria-hidden','true');panel.tabIndex=-1;panel.inert=true;
 panel.innerHTML='<header class="guide-heading"><div><span class="guide-eyebrow"></span><h2>想做什么？</h2></div><button type="button" class="guide-close" aria-label="关闭使用指引"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></header><div class="guide-reading"></div><p class="guide-status" role="status" aria-live="polite"></p><footer class="guide-footer" hidden></footer>';
 panel.querySelector('.guide-eyebrow').textContent=content.title+' · 一起试试';document.body.append(panel);
 const reading=panel.querySelector('.guide-reading'),heading=panel.querySelector('h2'),status=panel.querySelector('.guide-status'),footer=panel.querySelector('footer');
 let open=false,selected=null,position=0,highlight=null,focusTimer,hideTimer;
 const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
 const action=(text,fn,className)=>{const b=node('button',text,className);b.type='button';b.onclick=fn;return b;};
 const popover=typeof panel.showPopover==='function';if(popover)panel.setAttribute('popover','manual');
 const resume=action('继续指引 →',()=>panel.classList.remove('is-peeking'),'guide-resume');panel.querySelector('header').append(resume);
 function followDialog(){
  if(!open)return;const dialogs=[...document.querySelectorAll('dialog[open]')],parent=dialogs.at(-1)||document.body;
  if(popover&&panel.parentElement!==parent){panel.hidePopover();parent.append(panel);panel.showPopover();}
 }
 function clearHighlight(){highlight?.classList.remove('guide-located');highlight=null;}
 function findTarget(selector){if(!selector)return null;try{return [...document.querySelectorAll(selector)].find(e=>!panel.contains(e)&&!e.closest('[inert],[hidden]')&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');}catch{return null;}}
 function pointToStep(){
  clearHighlight();status.textContent='';if(!open||!selected)return;
  const step=selected.steps[position],target=findTarget(step.target);
  if(target){highlight=target;target.classList.add('guide-located');if(!matchMedia('(max-width:680px)').matches){panel.classList.remove('guide-on-left');const a=target.getBoundingClientRect(),b=panel.getBoundingClientRect();if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)panel.classList.add('guide-on-left');}}
  else if(step.target)status.textContent=step.hint||'先打开刚才的入口，再进行这一步。';
 }
 function setOpen(value){
  panel.style.removeProperty('display');const origin=document.activeElement,restore=!value&&panel.contains(origin);
  open=value;clearTimeout(focusTimer);clearTimeout(hideTimer);if(value&&popover){panel.showPopover();followDialog();}panel.classList.toggle('is-open',value);panel.setAttribute('aria-hidden',String(!value));panel.inert=!value;button.setAttribute('aria-expanded',String(value));
  if(value){pointToStep();focusTimer=setTimeout(()=>{if(open&&(document.activeElement===origin||panel.contains(document.activeElement)))panel.focus({preventScroll:true});},matchMedia('(prefers-reduced-motion:reduce)').matches?0:280);}
  else{clearHighlight();if(popover)hideTimer=setTimeout(()=>{if(!open){panel.hidePopover();document.body.append(panel);}},matchMedia('(prefers-reduced-motion:reduce)').matches?0:300);if(restore)focusPageTool(button);}
 }
 function showHome(){selected=null;position=0;clearHighlight();render();}
 function choose(row){selected=row;position=0;render();}
 function render(){
  reading.replaceChildren();footer.replaceChildren();status.textContent='';footer.hidden=!selected;panel.classList.remove('is-peeking','guide-peek-top','guide-on-left');panel.classList.toggle('is-walking',!!selected);
  if(!selected){
   heading.textContent='想做什么？';reading.append(node('p','选一件，我们一步步来。','guide-intro'));
   const list=node('div',undefined,'guide-tasks');
   for(const row of tasks){const b=action('',()=>choose(row),'guide-task'),image=node('span',undefined,'guide-task-icon'),text=node('span');image.innerHTML=guideIllustration(row.art,row.title);text.append(node('strong',row.title),node('small',row.summary));b.append(image,text,node('span','↗','guide-task-arrow'));list.append(b);}
   reading.append(list);return;
  }
  const step=selected.steps[position];heading.textContent=selected.title;
  reading.append(action('← 换一件事',showHome,'guide-back'));
  const visual=node('div',undefined,'guide-visual');visual.innerHTML=guideIllustration(selected.art,selected.title);reading.append(visual);
  reading.append(node('p',step.body,'guide-instruction'));
  if(step.target)reading.append(action('去试试 ↗',()=>{
   const target=findTarget(step.target);
   if(!target){status.textContent=step.hint||'先打开前一步的入口，就能继续。手机上的工具在顶部“更多”里。';return;}
   // Expose the real control; never click, submit or change data on the visitor's behalf.
   if(matchMedia('(max-width:680px)').matches){panel.classList.add('is-peeking');panel.classList.toggle('guide-peek-top',target.getBoundingClientRect().top>(document.documentElement.clientHeight||800)/2);}target.scrollIntoView({block:'center',inline:'nearest',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});target.focus?.({preventScroll:true});
  },'guide-try'));
  const original=content.chapters.find(row=>row.id===selected.id);
  if(original?.buttons?.length){const details=node('details',undefined,'guide-extra');details.append(node('summary','想知道其他按钮？'));for(const item of original.buttons){const line=node('p');line.append(node('strong',item.label+'：'),document.createTextNode(item.description));details.append(line);}reading.append(details);}
  const prev=action('上一步',()=>{if(position>0){position--;render();}},'guide-prev');prev.disabled=position===0;
  const dots=node('span',undefined,'guide-dots');dots.setAttribute('aria-label',`第 ${position+1} 步，共 ${selected.steps.length} 步`);for(let i=0;i<selected.steps.length;i++){const dot=node('i');if(i===position)dot.className='is-current';dots.append(dot);}
  const next=action(position===selected.steps.length-1?'完成':'下一步',()=>{if(position<selected.steps.length-1){position++;render();}else showHome();},'guide-next');footer.append(prev,dots,next);reading.scrollTop=0;pointToStep();
 }
 button.onclick=()=>setOpen(!open);panel.querySelector('.guide-close').onclick=()=>setOpen(false);
 document.addEventListener('click',event=>{if(open&&!panel.contains(event.target)&&!button.contains(event.target)){followDialog();const step=selected?.steps[position];let done=false;try{done=step?.advanceWhen&&document.querySelector(step.advanceWhen);}catch{}if(done&&position<selected.steps.length-1){position++;render();}else pointToStep();}});
 document.addEventListener('close',()=>{if(open){followDialog();pointToStep();}},true);
 (document.defaultView||document).addEventListener('keydown',event=>{if(event.key==='Escape'&&open&&panel.contains(event.target)&&!event.isComposing&&event.keyCode!==229&&!document.querySelector('dialog[open]')){event.preventDefault();event.stopImmediatePropagation();setOpen(false);}},true);
 for(const type of ['wheel','touchmove'])panel.addEventListener(type,e=>e.stopPropagation(),{passive:true});
 render();const controller={open:()=>setOpen(true),close:()=>setOpen(false)};mounted.set(host,controller);return controller;
}
