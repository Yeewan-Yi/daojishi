const closing=new WeakMap(),pending=new WeakMap();
const backdropBound=new WeakSet();
export function bindBackdropDismiss(dialog){
 if(backdropBound.has(dialog))return;backdropBound.add(dialog);
 let outsideStart=false;
 const outside=event=>{const r=dialog.getBoundingClientRect();return event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);};
 dialog.addEventListener('pointerdown',event=>{outsideStart=event.button===0&&outside(event);});
 dialog.addEventListener('pointercancel',()=>{outsideStart=false;});
 dialog.addEventListener('click',event=>{const dismiss=outsideStart&&outside(event);outsideStart=false;if(dismiss)closeModal(dialog);});
}
export function lockModal(dialog){
 const dismiss=closing.get(dialog);if(dismiss){clearTimeout(dismiss);closing.delete(dialog);dialog.classList.remove('is-closing');}
 let state=pending.get(dialog);if(!state){state={depth:0,controls:[...dialog.querySelectorAll('button,input,textarea,select')].map(control=>[control,control.disabled]),busy:dialog.getAttribute('aria-busy')};pending.set(dialog,state);for(const [control]of state.controls)control.disabled=true;dialog.setAttribute('aria-busy','true');}
 state.depth++;let released=false;return ()=>{if(released)return;released=true;if(--state.depth)return;pending.delete(dialog);for(const [control,disabled]of state.controls)control.disabled=disabled;if(state.busy===null)dialog.removeAttribute('aria-busy');else dialog.setAttribute('aria-busy',state.busy);};
}
export function openModal(dialog){
  const timer=closing.get(dialog);if(timer)clearTimeout(timer);
  closing.delete(dialog);dialog.classList.remove('is-closing');
  if(!dialog.open)dialog.showModal();
}
export function closeModal(dialog,value=''){
  if(!dialog.open||closing.has(dialog)||pending.has(dialog))return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){dialog.close(value);return;}
  dialog.classList.add('is-closing');
  closing.set(dialog,setTimeout(()=>{closing.delete(dialog);dialog.close(value);dialog.classList.remove('is-closing');},220));
}
export function bindModalMotion(){
  const fit=()=>document.documentElement.style.setProperty('--visual-height',`${window.visualViewport?.height||innerHeight}px`);
  window.visualViewport?.addEventListener('resize',fit);fit();
  for(const dialog of document.querySelectorAll('dialog')){
    dialog.addEventListener('cancel',event=>{event.preventDefault();closeModal(dialog);});
    bindBackdropDismiss(dialog);
  }
  document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>closeModal(button.closest('dialog'))));
}
