// The loader uses illustrated placeholders, so private photos are never fetched for decoration.
export function createAlbumLoader(){
  const loader=document.createElement('div');
  loader.className='album-loader';loader.setAttribute('role','status');
  loader.innerHTML=`<span class="photo-selection" aria-hidden="true">${Array.from({length:5},(_,i)=>`<span class="selection-print" style="--i:${i}"><svg viewBox="0 0 60 60"><circle cx="42" cy="17" r="5"/><path d="m4 49 17-23 13 16 9-11 13 18Z"/></svg></span>`).join('')}<span class="selection-corners"></span></span><span class="selection-caption">正在拾起这一刻<span class="selection-dots">…</span></span>`;
  return loader;
}
export function dismissAlbumLoader(loader){
  if(!loader)return;
  loader.classList.add('is-leaving');loader.setAttribute('aria-hidden','true');
  setTimeout(()=>loader.remove(),matchMedia('(prefers-reduced-motion: reduce)').matches?0:320);
}
