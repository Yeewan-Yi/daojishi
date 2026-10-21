const closing=new WeakMap();
export function openModal(dialog){
  const timer=closing.get(dialog);if(timer)clearTimeout(timer);
  closing.delete(dialog);dialog.classList.remove('is-closing');
  if(!dialog.open)dialog.showModal();
}
export function closeModal(dialog,value=''){
  if(!dialog.open||closing.has(dialog))return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){dialog.close(value);return;}
  dialog.classList.add('is-closing');
  closing.set(dialog,setTimeout(()=>{closing.delete(dialog);dialog.close(value);dialog.classList.remove('is-closing');},220));
}
export function bindModalMotion(){
  const fit=()=>document.documentElement.style.setProperty('--visual-height',`${window.visualViewport?.height||innerHeight}px`);
  window.visualViewport?.addEventListener('resize',fit);fit();
  for(const dialog of document.querySelectorAll('dialog')){
    dialog.addEventListener('cancel',event=>{event.preventDefault();closeModal(dialog);});
    dialog.addEventListener('click',event=>{const r=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))closeModal(dialog);});
  }
  document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>closeModal(button.closest('dialog'))));
}
