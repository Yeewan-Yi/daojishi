import {guideFor} from './guide-content.js';
import {validateGuide} from './guide-model.js';
import {tourFor} from './guide-tour.js?v=20261102-details';
import {createGuideViews} from './guide-views.js';
import {focusPageTool} from './focus-return.js';
const mark='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 5h10l2 3 2-3h8v22h-9l-2 2-2-2H5ZM16 9v15M8 10h4m-4 5h4m8-5h4m-4 5h4"/><path d="m22 18 3 3-3 3-3-3Z"/></svg>';
const mounted=new WeakMap();
export function mountGuide({host,guide,page='main',dark=false,auto=true}={}){
 if(!host)return;if(mounted.has(host))return mounted.get(host);
 const content=validateGuide(guide||guideFor(page)),steps=tourFor(page,content,!!guide),view=document.defaultView||document;
 const key='youqi.guide.welcome.'+(guide?location.pathname.replace(/index\.html$/,''):page),progressKey=key+'.position';
 if(!document.querySelector('link[data-guide-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./guide.css?v=20261102-details',import.meta.url).href;link.dataset.guideStyle='';document.head.append(link);}
 const button=document.createElement('button');button.type='button';button.dataset.guideButton='';button.className=host.classList.contains('header-actions')?'icon-button nav-tool':host.classList.contains('site-nav')?'site-tool':host.closest('.memory-header')?'line-action':'guide-entry';button.setAttribute('aria-label','使用指引');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','page-guide');button.innerHTML=mark+'<span class="nav-caption" aria-hidden="true">指引</span>';host.append(button);
 const panel=document.createElement('aside');panel.style.display='none';panel.id='page-guide';panel.className='page-guide'+(dark?' guide-dark':'');panel.setAttribute('aria-label',content.title+'使用指引');panel.setAttribute('aria-hidden','true');panel.tabIndex=-1;panel.inert=true;
 panel.innerHTML='<header class="guide-heading"><span class="guide-eyebrow"></span><button type="button" class="guide-close" aria-label="暂停指引">×</button></header><div class="guide-progress" role="progressbar" aria-label="导览进度" aria-valuemin="0" aria-valuemax="100"><span></span></div><div class="guide-reading" aria-live="polite"></div><p class="guide-status" role="status"></p><footer class="guide-footer"></footer>';
 document.body.append(panel);const spot=document.createElement('div');spot.className='guide-spotlight';spot.hidden=true;spot.setAttribute('aria-hidden','true');document.body.append(spot);
 const reading=panel.querySelector('.guide-reading'),status=panel.querySelector('.guide-status'),footer=panel.querySelector('footer'),eyebrow=panel.querySelector('.guide-eyebrow');
 let open=false,mode='welcome',position=0,highlight=null,focusTimer,hideTimer,inviteTimer,frame,ownedMenu=null,acknowledged=false,busy=false,revision=0,cleanup=Promise.resolve();
 const session=createGuideViews({document});
 const popover=typeof panel.showPopover==='function';if(popover)panel.setAttribute('popover','manual');
 const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
 const action=(text,fn,className)=>{const b=node('button',text,className);b.type='button';b.onclick=fn;return b;};
 function seen(){if(acknowledged)return true;try{return localStorage.getItem(key)==='seen';}catch{return false;}}
 function remember(){acknowledged=true;try{localStorage.setItem(key,'seen');}catch{}}
 function clearHighlight(){highlight?.classList.remove('guide-located');highlight=null;spot.hidden=true;}
 function restoreMenu(){if(ownedMenu?.getAttribute('aria-expanded')==='true')ownedMenu.click();ownedMenu=null;}
 function findTarget(selector){if(!selector)return null;try{return [...document.querySelectorAll(selector)].find(e=>!panel.contains(e)&&!e.closest('[inert],[hidden]')&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');}catch{return null;}}
 function followDialog(){if(!open)return;const parent=[...document.querySelectorAll('dialog[open]')].at(-1)||session.parent()||document.body;if(popover&&panel.parentElement!==parent){panel.hidePopover();parent.append(panel);panel.showPopover();}}
 function positionSpot(){
  if(!open||mode!=='walk'||!highlight)return;
  const r=highlight.getBoundingClientRect(),w=view.innerWidth||document.documentElement.clientWidth,h=view.innerHeight||document.documentElement.clientHeight;
  const left=Math.max(7,r.left-7),top=Math.max(7,r.top-7),right=Math.min(w-7,r.right+7),bottom=Math.min(h-7,r.bottom+7);
  spot.hidden=right<=left||bottom<=top;if(spot.hidden)return;
  Object.assign(spot.style,{left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px'});
  panel.classList.remove('guide-on-left','guide-at-top');const p=panel.getBoundingClientRect();
  if(r.left<p.right&&r.right>p.left&&r.top<p.bottom&&r.bottom>p.top)panel.classList.add(matchMedia('(max-width:680px)').matches?'guide-at-top':'guide-on-left');
 }
 function point(reveal=false){
  clearHighlight();status.textContent='';if(!open||mode!=='walk')return;
  const step=steps[position];let target=findTarget(step.target)||findTarget(step.fallback);
  // Only expose an existing navigation menu. Never open an editor, submit or change data.
  if(!target&&matchMedia('(max-width:680px)').matches){const toggle=document.querySelector('.mobile-tools-toggle');let hiddenTarget;try{hiddenTarget=step.target&&document.querySelector(step.target);}catch{}if(toggle&&hiddenTarget?.closest('.mobile-tools-panel')&&toggle.getAttribute('aria-expanded')!=='true'){ownedMenu=toggle;toggle.click();target=findTarget(step.target);}}
  if(!target){if(document.querySelector('dialog[open]'))status.textContent='先关掉正在使用的窗口，就能接着看其他入口。';return;}
  highlight=target;target.classList.add('guide-located');if(reveal)target.scrollIntoView({block:'nearest',inline:'nearest',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});positionSpot();
 }
 function setOpen(value,focus=true){
  panel.style.removeProperty('display');const origin=document.activeElement,restore=!value&&panel.contains(origin);open=value;clearTimeout(focusTimer);clearTimeout(hideTimer);
  if(value&&popover){panel.showPopover();followDialog();}panel.classList.toggle('is-open',value);panel.setAttribute('aria-hidden',String(!value));panel.inert=!value;button.setAttribute('aria-expanded',String(value));
  if(value){point(mode==='walk');if(focus)focusTimer=setTimeout(()=>{if(open&&(document.activeElement===origin||panel.contains(document.activeElement)))panel.focus({preventScroll:true});},matchMedia('(prefers-reduced-motion:reduce)').matches?0:280);}
  else{clearHighlight();restoreMenu();if(popover)hideTimer=setTimeout(()=>{if(!open){panel.hidePopover();document.body.append(panel);}},matchMedia('(prefers-reduced-motion:reduce)').matches?0:300);if(restore)focusPageTool(button);}
 }
 function savePosition(){try{if(mode==='finish')localStorage.removeItem(progressKey);else if(mode==='walk')localStorage.setItem(progressKey,JSON.stringify({title:steps[position].title,index:position}));}catch{}}
 function resumePosition(){try{const row=JSON.parse(localStorage.getItem(progressKey));if(Number.isInteger(row?.index)&&steps[row.index]?.title===row.title)return row.index;return row?.title?Math.max(0,steps.findIndex(step=>step.title===row.title)):0;}catch{return 0;}}
 function skip(){savePosition();remember();revision++;busy=false;panel.removeAttribute('aria-busy');setOpen(false);cleanup=session.cleanup();return cleanup;}
 async function enter(index){
  const token=++revision;busy=true;clearHighlight();panel.setAttribute('aria-busy','true');for(const b of panel.querySelectorAll('button:not(.guide-close)'))b.disabled=true;status.textContent='正在带你看看这里…';restoreMenu();
  let result;try{result=await session.prepare(steps[index]?.views||[],()=>token!==revision||!open);}catch{result={ok:false,reason:'这处界面暂时没能展开，可以稍后继续。'};}
  if(token!==revision||!open)return;busy=false;panel.removeAttribute('aria-busy');
  if(!result.ok){followDialog();render();point();status.textContent=result.reason||'可以先处理当前窗口，再继续。';return;}
  position=index;if(position>=steps.length){mode='finish';remember();clearHighlight();}else mode='walk';followDialog();render();panel.focus({preventScroll:true});point(true);if(result.reason)status.textContent=result.reason;savePosition();
 }
 async function start(restart=false){const intent=++revision;remember();await cleanup;if(intent!==revision)return;mode='walk';position=restart?0:resumePosition();render();setOpen(true);await enter(position);}
 function move(delta){if(!busy)return enter(position+delta);}
 function render(){
  reading.replaceChildren();footer.replaceChildren();status.textContent='';panel.classList.remove('guide-on-left','guide-at-top');
  const group=steps[position]?.group,groupSteps=group?steps.filter(step=>step.group===group):steps,localIndex=group?groupSteps.indexOf(steps[position]):position;
  eyebrow.textContent=mode==='walk'?`${group||content.title} · ${localIndex+1} / ${groupSteps.length}`:content.title+' · 初次见面';
  const progress=panel.querySelector('.guide-progress'),percent=mode==='walk'?Math.round(position/steps.length*100):mode==='finish'?100:0;progress.setAttribute('aria-valuenow',String(percent));progress.querySelector('span').style.width=percent+'%';
  if(mode==='welcome'){
   reading.append(node('h2','一起认识一下'+content.title),node('p','我先带你认识页面，再展开各个区域，看看里面的小操作。跟着看就好，随时能暂停，下次接着看。','guide-instruction'));
   footer.append(action('稍后再看',skip,'guide-skip'),action('带我看看 →',()=>start(),'guide-next'));return;
  }
  if(mode==='finish'){
   reading.append(node('h2','现在，可以慢慢逛了'),node('p','这就是这一页的主要用法。以后想再看一遍，点顶部的“指引”就好。','guide-instruction'));
   footer.append(action('再看一遍',()=>start(true),'guide-prev'),action('开始使用',()=>setOpen(false),'guide-next'));return;
  }
  const step=steps[position];reading.append(node('h2',step.title),node('p',step.body,'guide-instruction'));
  const prev=action('上一步',()=>move(-1),'guide-prev');prev.disabled=position===0;
  footer.append(prev,action('稍后继续',skip,'guide-skip'),action(position===steps.length-1?'认识完了 →':'继续 →',()=>move(1),'guide-next'));
  if(position>0)reading.append(action('从头认识一遍',()=>start(true),'guide-restart'));
 }
 button.onclick=()=>open&&mode!=='welcome'?skip():start();panel.querySelector('.guide-close').onclick=skip;
 document.addEventListener('click',event=>{if(open&&!busy&&!panel.contains(event.target)&&!button.contains(event.target)&&event.target!==ownedMenu){followDialog();point();}});
 document.addEventListener('close',()=>{if(open){followDialog();point();}},true);
 view.addEventListener('keydown',event=>{if(event.key==='Escape'&&open&&!event.isComposing&&event.keyCode!==229&&panel.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();skip();}},true);
 function updatePosition(){if(!open||mode!=='walk')return;if(frame)return;const raf=view.requestAnimationFrame||((fn)=>setTimeout(fn,16));frame=raf(()=>{frame=null;positionSpot();});}
 view.addEventListener('scroll',updatePosition,{passive:true,capture:true});view.addEventListener('resize',()=>{if(open)point();},{passive:true});
 for(const type of ['wheel','touchmove'])panel.addEventListener(type,e=>e.stopPropagation(),{passive:true});
 function invite(){if(seen()||open||document.hidden||document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;mode='welcome';render();setOpen(true,false);}
 if(auto&&!seen()){
  let bootObserver;
  const schedule=()=>{const loader=document.getElementById('boot-screen');if(loader&&!loader.hidden&&typeof MutationObserver==='function'){if(!bootObserver){bootObserver=new MutationObserver(()=>{if(loader.hidden){bootObserver.disconnect();bootObserver=null;inviteTimer=setTimeout(invite,900);}});bootObserver.observe(loader,{attributes:true,attributeFilter:['hidden']});}return;}inviteTimer=setTimeout(invite,900);};
  if(document.readyState==='complete')schedule();else view.addEventListener('load',schedule,{once:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!seen()&&!open){clearTimeout(inviteTimer);schedule();}});
 }
 render();const controller={open:start,close:skip};mounted.set(host,controller);return controller;
}
