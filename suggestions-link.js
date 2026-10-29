import {outsideCouncilPointer} from './suggestion-presentation.js';
import {focusPageTool} from './shared/focus-return.js';
import {mountCouncilAlerts} from './suggestions-alerts.js?v=20261025-council-compact';
import {journeyContext} from './journey-data.js';
export const suggestionMark='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 5h17v18H12l-6 5ZM11 10h8m-8 5h5M23 9h4v18H16l-4 3"/><path d="m18 18 2 2 5-6"/></svg>';
export function currentSuggestionSite(path=location.pathname){const match=path.match(/\/pages\/([a-z][a-z0-9-]{1,39})\//);return match?'page:'+match[1]:/\/memories\.html$/.test(path)?'memories':'main';}
export function mountSuggestionLink({host,site=currentSuggestionSite(),siteTitle,shared=false}={}){
 if(!host)return;
 const existing=document.querySelector('[data-suggestions-link]');if(existing)return existing;
 const button=document.createElement('button');button.type='button';button.dataset.suggestionsLink='';button.className=shared?'site-tool':host.classList.contains('header-actions')?'icon-button nav-tool':'line-action';
 button.setAttribute('aria-label','共议 · 建议与修订');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','council-panel');button.innerHTML=suggestionMark+'<span class="nav-caption" aria-hidden="true">共议</span>';host.append(button);
 let panel,controller,loading,contextKey,desired=false,composing=false,compositionEnded=-Infinity;
 const stylesheet=new URL('./suggestions.css?v=20261026-direct-status',import.meta.url);
 function loadStyle(){return new Promise((resolve,reject)=>{const found=document.querySelector('link[data-council-style]');if(found?.sheet){resolve();return;}const link=found||document.createElement('link');const timer=setTimeout(()=>{link.remove();reject(Error('共议样式载入超时，请重试。'));},12000);link.rel='stylesheet';link.href=stylesheet.href;link.dataset.councilStyle='';link.addEventListener('load',()=>{clearTimeout(timer);resolve();},{once:true});link.addEventListener('error',()=>{clearTimeout(timer);link.remove();reject(Error('共议样式暂未载入，请再试一次。'));},{once:true});if(!found)document.head.append(link);});}
 const badge=document.createElement('i');badge.className='council-unread-badge';badge.setAttribute('aria-hidden','true');badge.hidden=true;button.append(badge);
 const alertStatus=document.createElement('span');alertStatus.className='council-global-status';alertStatus.setAttribute('role','status');host.append(alertStatus);
 const alerts=mountCouncilAlerts({context:journeyContext,onChange:items=>{const count=items.length;button.dataset.unread=String(count);badge.hidden=!count;badge.textContent=count>99?'99+':String(count);alertStatus.textContent=count?'共议有 '+count+' 条未读回应':'';}});
 loadStyle().catch(()=>{});
 async function prepare(){
  const ctx=journeyContext(),key=JSON.stringify(ctx);
  if(controller&&key===contextKey)return;
  controller?.dispose();controller=null;contextKey=key;
  const [module]=await Promise.all([import('./suggestions-ui.js?v=20261026-direct-status'),loadStyle()]);
  if(!panel){panel=document.createElement('aside');panel.id='council-panel';panel.className='council-panel';panel.dataset.councilPanel='';panel.dataset.tone=site==='main'&&!shared?'green':'blue';panel.setAttribute('aria-labelledby','council-title');panel.setAttribute('aria-hidden','true');panel.inert=true;panel.tabIndex=-1;document.body.append(panel);
   panel.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});panel.addEventListener('touchstart',event=>event.stopPropagation(),{passive:true});panel.addEventListener('touchmove',event=>event.stopPropagation(),{passive:true});
   panel.addEventListener('compositionstart',()=>{composing=true;});panel.addEventListener('compositionend',event=>{composing=false;compositionEnded=event.timeStamp;});
   panel.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.isComposing&&event.keyCode!==229){event.preventDefault();event.stopPropagation();setOpen(false);}});
  }
  controller=await module.mountCouncil(panel,{site,siteTitle,context:ctx,onClose:()=>setOpen(false)});controller.setUnread(alerts.items);
 }
 async function setOpen(open){
  desired=open;button.setAttribute('aria-expanded',String(open));
  if(!open){if(panel){const restoreFocus=panel.contains(document.activeElement);panel.classList.remove('is-open');panel.setAttribute('aria-hidden','true');panel.inert=true;controller?.setActive(false);composing=false;if(restoreFocus)focusPageTool(button);}return;}
  button.setAttribute('aria-busy','true');
  try{loading??=prepare().finally(()=>{loading=null;});await loading;if(!desired)return;panel.inert=false;panel.setAttribute('aria-hidden','false');panel.classList.add('is-open');controller.setActive(true);controller.focus();button.removeAttribute('title');}
  catch(error){desired=false;button.setAttribute('aria-expanded','false');button.title=error.message;let status=host.querySelector('[data-council-error]');if(!status){status=document.createElement('span');status.dataset.councilError='';status.setAttribute('role','status');host.append(status);}status.textContent='共议暂未载入，请再点一次。';}
  finally{button.removeAttribute('aria-busy');}
 }
 document.addEventListener('pointerdown',event=>{const focused=document.hasFocus()||(event.target!==document.body&&event.target!==document.documentElement);if(outsideCouncilPointer(event,{open:desired,panel,button,composing,compositionEnded,focused}))setOpen(false);},{capture:true});
 button.onclick=()=>{host.querySelector('[data-council-error]')?.remove();setOpen(!desired);};
 const url=new URL(location.href);if(url.searchParams.get('council')==='1'){url.searchParams.delete('council');history.replaceState(history.state,'',url.href);queueMicrotask(()=>setOpen(true));}
 return button;
}
