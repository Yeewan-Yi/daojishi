import { LettersClient, createPair, identityFromHash, personalUrl, validateIdentity } from './letters.js';

export function mountLetters({getContext,openSharing,notify,client=new LettersClient()}) {
  const $=id=>document.getElementById(id), dock=$('letters-dock'), panel=$('letters-panel'), trigger=$('letters-trigger');
  const fine=matchMedia('(hover:hover) and (pointer:fine)'), list=$('letters-list'), input=$('letter-body');
  function fitKeyboard(){
    const viewport=window.visualViewport;
    if(!viewport)return;
    panel.style.setProperty('--letters-available-height',`${viewport.height}px`);
    panel.style.setProperty('--letters-keyboard-inset',`${Math.max(0,innerHeight-viewport.height-viewport.offsetTop)}px`);
  }
  window.visualViewport?.addEventListener('resize',fitKeyboard);
  window.visualViewport?.addEventListener('scroll',fitKeyboard);
  fitKeyboard();
  let opened=false, closing, timer, busy=false, fetching=false, booting=false, contextKey='', identity=null, pair=null, pendingPair=null;
  let items=[], cursor=null, revision=-1, latestOther=0, edit=null, sendId=crypto.randomUUID(), seen=0, pendingRevision=null, names='', view='loading';
  let explicit=null, invalidIdentity=false;
  try { explicit=identityFromHash(location.hash); } catch { invalidIdentity=true; }
  const get=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
  const put=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
  const key=kind=>`youqi.letters.${kind}.${getContext().room?.id}.${identity?.id||'setup'}`;
  const error=message=>{$('letters-error').textContent=message||'';$('letters-retry').hidden=!message;};
  function setView(next) {
    view=next;
    $('letters-links-button').hidden=!identity || !['book','links'].includes(next);
    for(const name of ['loading','local','setup','identity','book','links']) $('letters-'+name).hidden=name!==next;
  }
  function setOpen(value) {
    clearTimeout(closing); opened=value;
    dock.classList.toggle('is-open',value); panel.inert=!value; trigger.setAttribute('aria-expanded',String(value));
    document.body.classList.toggle('letters-sidebar-open',value && fine.matches);
    $('letters-backdrop').hidden=!value || fine.matches;
    if(value) { sync(); if(view==='book' && list.scrollTop<24 && !pendingRevision) markRead(); }
  }
  dock.addEventListener('pointerenter',event=>{if(fine.matches && event.pointerType!=='touch')setOpen(true);});
  dock.addEventListener('pointerleave',event=>{if(fine.matches && event.pointerType!=='touch')closing=setTimeout(()=>{if(dock.contains(document.activeElement))document.activeElement.blur();setOpen(false);},240);});
  dock.addEventListener('focusin',event=>{if(fine.matches && event.target!==trigger)setOpen(true);});
  dock.addEventListener('focusout',()=>{if(fine.matches)closing=setTimeout(()=>{if(!dock.matches(':hover')&&!dock.contains(document.activeElement))setOpen(false);},160);});
  trigger.addEventListener('click',event=>{if(!fine.matches || event.detail===0)setOpen(!opened);});
  $('letters-close').addEventListener('click',()=>{setOpen(false);trigger.focus({preventScroll:true});});
  $('letters-backdrop').addEventListener('click',()=>setOpen(false));
  addEventListener('keydown',event=>{if(event.key==='Escape'&&opened){event.stopImmediatePropagation();setOpen(false);trigger.focus({preventScroll:true});}},true);
  fine.addEventListener('change',()=>setOpen(false));
  $('letters-enable-cloud').addEventListener('click',()=>{setOpen(false);openSharing();});
  $('letters-retry').addEventListener('click',()=>{contextKey='';sync();});
  $('letters-updates').addEventListener('click',()=>load(false));
  $('letters-older').addEventListener('click',()=>load(true));
  function markRead() {
    if(!identity || view!=='book')return;
    seen=Math.max(seen,latestOther);put(key('seen'),seen); $('letters-unread').hidden=true;
    trigger.setAttribute('aria-label','留言');
  }
  function unread() {
    const has=latestOther>seen;
    $('letters-unread').hidden=!has;trigger.setAttribute('aria-label',has?'留言，有新留言':'留言');
  }
  function draftKey(){return key(edit?`edit.${edit.id}`:'draft');}
  function saveDraft(){put(draftKey(),input.value);}
  function counter(){const length=[...input.value].length;$('letter-count').textContent=`${length} / 500`;$('letter-count').classList.toggle('is-over',length>500);}
  input.addEventListener('input',()=>{saveDraft();counter();});
  input.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){$('letter-form').requestSubmit();event.preventDefault();}});
  $('letter-cancel').addEventListener('click',()=>{
    saveDraft();edit=null;sendId=crypto.randomUUID();input.value=get(draftKey(),'');updateComposer();
  });
  function updateComposer(){
    $('letter-send-label').textContent=edit?'保存修改':'留言';$('letter-cancel').hidden=!edit;
    $('letter-composer-label').textContent=edit?'修改这条留言':`以 ${names} 的身份留言`;
    $('letter-send').disabled=busy;input.disabled=busy;counter();
  }
  function render() {
    list.replaceChildren();
    $('letters-empty').hidden=items.length>0;
    for(const item of items){
      const row=document.createElement('article');row.className='letter-entry';row.dataset.id=item.id;
      if(item.author===identity.id)row.classList.add('is-mine');
      const head=document.createElement('div');head.className='letter-byline';
      const name=document.createElement('span');name.className='letter-author';name.textContent=item.name;
      const time=document.createElement('time');time.dateTime=item.created_at;
      time.textContent=new Intl.DateTimeFormat('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',...(new Date(item.created_at).getFullYear()!==new Date().getFullYear()?{year:'numeric'}:{})}).format(new Date(item.created_at));
      if(item.version>1)time.textContent+=' · 已编辑';head.append(name,time);
      const body=document.createElement('p');body.className='letter-text';body.textContent=item.body;row.append(head,body);
      if(item.author===identity.id){
        const actions=document.createElement('div');actions.className='letter-actions';
        const change=document.createElement('button');change.type='button';change.textContent='修改';change.disabled=busy;
        change.addEventListener('click',()=>{if(busy)return;saveDraft();edit=item;input.value=get(draftKey(),item.body);error('');updateComposer();input.focus({preventScroll:true});});
        const remove=document.createElement('button');remove.type='button';remove.textContent='删除';remove.disabled=busy;
        remove.addEventListener('click',()=>{
          if(busy)return;
          actions.replaceChildren();
          const prompt=document.createElement('span');prompt.textContent='删除这条留言？';
          const yes=document.createElement('button');yes.textContent='确认删除';yes.type='button';
          const no=document.createElement('button');no.textContent='取消';no.type='button';
          no.addEventListener('click',render);
          yes.addEventListener('click',async()=>{if(busy)return;busy=true;yes.disabled=no.disabled=true;updateComposer();error('');
            try{await client.remove(getContext().room,identity,item.id,item.version);if(edit?.id===item.id){edit=null;input.value=get(draftKey(),'');}await load(false);}
            catch(e){error(e.message);}finally{busy=false;updateComposer();render();}
          });actions.append(prompt,no,yes);
        });actions.append(change,remove);row.append(actions);
      }
      list.append(row);
    }
    $('letters-older').hidden=cursor===null;$('letters-older').disabled=fetching;
  }
  async function load(older=false){
    if(fetching||!identity)return;
    fetching=true;$('letters-older').disabled=true;
    const ctx=getContext(), person=identity, previous=list.scrollTop;
    try{
      const data=await client.list(ctx.room,person,older?cursor:null);
      if(ctx.room.id!==getContext().room?.id||person.id!==identity?.id)return;
      items=older?[...items,...data.items.filter(row=>!items.some(old=>old.id===row.id))]:data.items;
      cursor=data.cursor;names=data.name;latestOther=data.latest_other;
      if(!older){revision=data.revision;pendingRevision=null;$('letters-updates').hidden=true;}
      setView('book');render();list.scrollTop=older?previous:0;updateComposer();error('');
      if(opened&&!older)markRead();else unread();
    }catch(e){error(e.message);}finally{fetching=false;$('letters-older').disabled=false;}
  }
  async function sync(){
    clearTimeout(timer);
    if(booting)return;
    const ctx=getContext();
    if(!ctx.room){setView('local');contextKey='';return;}
    if(!ctx.record){setView('loading');timer=setTimeout(sync,1500);return;}
    if(ctx.room.id!==contextKey){
      contextKey=ctx.room.id;items=[];cursor=null;revision=-1;pendingRevision=null;edit=null;pair=get(`youqi.letters.pair.${ctx.room.id}`);
      try{if(!Array.isArray(pair)||pair.length!==2)pair=null;else for(const person of pair){validateIdentity(person);if(typeof person.name!=='string')pair=null;}}catch{pair=null;}
      pendingPair=get(`youqi.letters.pending.${ctx.room.id}`);
      if(Array.isArray(pendingPair)&&pendingPair.length===2){$('letter-name-self').value=pendingPair[0].name||'';$('letter-name-other').value=pendingPair[1].name||'';}
      try{identity=explicit||validateIdentity(get(`youqi.letters.identity.${ctx.room.id}`));}catch{identity=null;}
      if(invalidIdentity){setView('identity');error('留言专属链接不完整，请使用自己的完整链接。');return;}
      if(identity){put(`youqi.letters.identity.${ctx.room.id}`,identity);seen=get(key('seen'),0);input.value=get(draftKey(),'');updateComposer();}
    }
    booting=true;
    try{
      const status=await client.status(ctx.room,identity);
      if(!status.ready){setView(status.can_setup?'setup':'identity');return;}
      if(status.needs_identity){setView('identity');if(pair){$('letters-recover').hidden=false;}return;}
      latestOther=status.latest_other;
      if(view==='links')return;
      if(revision<0)await load(false);
      else if(status.revision!==revision){
        if(opened && list.scrollTop<24 && items.length<=20 && !edit)await load(false);
        else{pendingRevision=status.revision;$('letters-updates').hidden=false;}
      }
      if(opened&&view==='book'&&list.scrollTop<24&&!pendingRevision)markRead();else unread();
    }catch(e){error(e.message);}
    finally{booting=false;timer=setTimeout(sync,document.hidden?15000:opened?2500:6000);}
  }
  $('letters-setup-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;busy=true;error('');$('letters-create').disabled=true;
    try{
      const ctx=getContext();
      pendingPair ||= get(`youqi.letters.pending.${ctx.room.id}`) || createPair([$('letter-name-self').value,$('letter-name-other').value]);
      put(`youqi.letters.pending.${ctx.room.id}`,pendingPair);
      await client.setup(ctx.room,pendingPair);pair=pendingPair;identity=validateIdentity(pair[0]);names=pair[0].name;
      const stored=put(`youqi.letters.pair.${ctx.room.id}`,pair);put(`youqi.letters.identity.${ctx.room.id}`,identity);
      if(stored)try{localStorage.removeItem(`youqi.letters.pending.${ctx.room.id}`);}catch{/* The saved pair remains usable. */}
      if(!stored)error('此浏览器无法保存身份，请立即复制并妥善保存两条专属链接。');
      history.replaceState(null,'',personalUrl(location.href,ctx.room,identity));explicit=identity;
      input.value=get(draftKey(),'');seen=get(key('seen'),0);showLinks();
    }catch(e){error(e.message);}finally{busy=false;$('letters-create').disabled=false;updateComposer();}
  });
  async function copy(value){try{await navigator.clipboard.writeText(value);notify('专属链接已复制。');}catch{error('请选中链接后复制。');}}
  function showLinks(){
    const area=$('letter-links');area.replaceChildren();
    const members=pair||[{...identity,name:names}];
    for(const person of members){
      const label=document.createElement('label');label.textContent=`${person.name} 的专属链接`;
      const field=document.createElement('div');field.className='letter-link-field';
      const link=document.createElement('input');link.readOnly=true;link.setAttribute('aria-label',label.textContent);link.value=personalUrl(location.href,getContext().room,person);link.addEventListener('click',()=>link.select());
      const button=document.createElement('button');button.type='button';button.textContent='复制';button.addEventListener('click',()=>copy(link.value));field.append(link,button);label.append(field);area.append(label);
    }
    setView('links');
  }
  $('letters-links-button').addEventListener('click',()=>{if(identity)showLinks();});
  $('letters-recover').addEventListener('click',()=>{if(pair)showLinks();});
  $('letters-links-done').addEventListener('click',()=>{if(identity){revision=-1;load(false);}else setView('identity');});
  $('letter-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!identity)return;busy=true;saveDraft();error('');updateComposer();
    const oldEdit=edit, body=input.value;
    try{
      await client.write(getContext().room,identity,body,edit?.id||sendId,edit?.version??null);
      put(draftKey(),'');input.value='';edit=null;sendId=crypto.randomUUID();
      // Preserve any unsent new message when finishing an edit.
      if(oldEdit)input.value=get(draftKey(),'');
      await load(false);
    }catch(e){error(e.message);}
    finally{busy=false;updateComposer();render();}
  });
  list.addEventListener('scroll',()=>{if(opened&&list.scrollTop<24&&!pendingRevision)markRead();},{passive:true});
  addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
  addEventListener('online',sync);
  addEventListener('storage',event=>{if(event.key?.startsWith('youqi.letters.')){seen=get(key('seen'),seen);unread();}});
  panel.inert=true;sync();
  return {refresh:sync,close:()=>setOpen(false)};
}
