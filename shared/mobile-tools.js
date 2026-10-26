/** Reuse actual controls so their listeners, access checks and disabled state stay intact. */
export function mountMobileTools({host,primary}={}){
 if(!host||host.dataset.mobileTools)return;
 host.dataset.mobileTools='';
 if(!document.querySelector('link[data-mobile-tools-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./mobile-tools.css?v=20261025-mobile-nav',import.meta.url).href;link.dataset.mobileToolsStyle='';document.head.append(link);}
 const media=matchMedia('(max-width:680px)'),items=new Map();
 const toggle=document.createElement('button');toggle.type='button';toggle.className='mobile-tools-toggle';toggle.setAttribute('aria-label','更多功能');toggle.setAttribute('aria-expanded','false');
 toggle.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 10V6h6m8 0h6v4M6 22v4h6m8 0h6v-4"/><circle cx="10" cy="16" r="1"/><circle cx="16" cy="16" r="1"/><circle cx="22" cy="16" r="1"/></svg>';
 const panel=document.createElement('div');panel.className='mobile-tools-panel';panel.id='mobile-page-tools';panel.setAttribute('role','group');panel.setAttribute('aria-label','更多页面工具');toggle.setAttribute('aria-controls',panel.id);panel.inert=true;
 host.append(toggle,panel);
 for(const type of ['wheel','touchstart','touchmove'])panel.addEventListener(type,event=>event.stopPropagation(),{passive:true});
 function setOpen(open,restore=false){host.classList.toggle('tools-open',open);toggle.setAttribute('aria-expanded',String(open));panel.inert=!open;if(!open&&restore)toggle.focus({preventScroll:true});}
 function labelFor(node){if(node.dataset.themeLabel)return node.dataset.themeLabel;if(node.dataset.suggestionsLink!==undefined)return '共议';if(node.id==='version-button')return '版本手记';return node.getAttribute('aria-label')||[...node.childNodes].filter(child=>!child.classList?.contains('mobile-tool-label')).map(child=>child.textContent).join('').trim();}
 const observer=new MutationObserver(reconcile);
 function reconcile(){observer.disconnect();
  for(const node of [...host.children])if(node!==toggle&&node!==panel&&node.matches('button,a')&&!node.matches(primary||':not(*)')&&!items.has(node)){const marker=document.createComment('tool position');node.before(marker);items.set(node,marker);}
  host.classList.toggle('tools-compact',media.matches);toggle.hidden=!media.matches;panel.hidden=!media.matches;
  for(const [node,marker]of items){if(media.matches){if(node.parentNode!==panel)panel.append(node);let label=node.querySelector('.mobile-tool-label');if(!label){label=document.createElement('span');label.className='mobile-tool-label';node.append(label);}label.textContent=labelFor(node);}else{if(marker.parentNode)marker.after(node);node.querySelector('.mobile-tool-label')?.remove();}}
  if(media.matches){const rank=node=>node.matches('.atlas-trigger')?0:node.id==='share-button'?1:node.dataset.suggestionsLink!==undefined?2:node.matches('#theme-button,#memory-theme,[data-theme-toggle]')?3:node.id==='version-button'?4:2;for(const node of [...items.keys()].sort((a,b)=>rank(a)-rank(b)))panel.append(node);}
  const unread=host.querySelector('[data-suggestions-link]')?.dataset.unread;toggle.dataset.unread=unread||'0';
  if(!media.matches)setOpen(false);
  observer.observe(host,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-label','data-unread']});
 }
 toggle.onclick=()=>setOpen(toggle.getAttribute('aria-expanded')!=='true');
 panel.addEventListener('click',event=>{if(event.target.closest('button,a'))setOpen(false,panel.contains(document.activeElement));});
 host.addEventListener('keydown',event=>{if(event.key==='Escape'&&host.classList.contains('tools-open')&&!event.isComposing){event.preventDefault();event.stopPropagation();setOpen(false,true);}});
 document.addEventListener('pointerdown',event=>{if(!host.contains(event.target))setOpen(false);});
 document.addEventListener('focusin',event=>{if(!host.contains(event.target))setOpen(false);});
 media.addEventListener('change',()=>{if(panel.contains(document.activeElement))toggle.focus({preventScroll:true});reconcile();});
 reconcile();return {close:()=>setOpen(false)};
}
