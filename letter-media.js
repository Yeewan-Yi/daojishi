import {openModal} from './motion.js?v=20261026-acceptance';

export function validImages(images=[]){
  if(!Array.isArray(images)||images.length>3||images.some(i=>!i||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(i.id)||!Number.isInteger(i.width)||!Number.isInteger(i.height)||i.width<1||i.width>1800||i.height<1||i.height>1800)||new Set(images.map(i=>i.id)).size!==images.length)throw new Error('图片内容无效。');
  return images.map(({id,width,height})=>({id,width,height}));
}
export async function prepareImage(file){
  if(!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)||file.size>15000000)throw new Error('请选择 15 MB 以内的 JPG、PNG、WebP 或 GIF 图片。');
  let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw new Error('这张照片无法读取，可能已损坏或格式不受支持，请换一张重试。');}
  try{
    const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    let blob;
    for(const quality of [.86,.72,.58,.44]){blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=1200000)break;}
    if(!blob||blob.size>1200000)throw new Error('图片仍然过大，请换一张较小的图片。');
    return {blob,width:canvas.width,height:canvas.height};
  }finally{bitmap.close();}
}

export function mountLetterMedia({client,input,getContext,getIdentity,onChange,onError,isComposing=()=>false}){
  const $=id=>document.getElementById(id),previews=$('letter-attachments'),picker=$('letter-emoji-picker');
  let images=[],uploading=0,generation=0,draft='',disabled=false,emojisOpen=false,emojisBuilt=false,flushQueued=false;
  const cache=new Map(),pending=new Map(),queue=[];
  const identityKey=(room,person,id)=>`${room.id}:${person.id}:${id}`;
  function persist(){if(draft)try{localStorage.setItem(draft+'.images',JSON.stringify(validImages(images)));}catch{onError('图片草稿无法保存，请完成递函后再关闭网页。');}}
  function urls(items){
    const room=getContext().room,person=getIdentity();if(!room||!person)return Promise.resolve([]);
    const jobs=items.map(image=>{
      const key=identityKey(room,person,image.id),saved=cache.get(key);
      if(saved&&saved.expires>Date.now())return Promise.resolve(saved.url);
      if(pending.has(key))return pending.get(key);
      const job=new Promise((resolve,reject)=>queue.push({key,id:image.id,room,person,resolve,reject}));pending.set(key,job);return job;
    });
    if(queue.length&&!flushQueued){flushQueued=true;queueMicrotask(async()=>{
      flushQueued=false;const batch=queue.splice(0);
      const groups=new Map();for(const item of batch){const key=`${item.room.id}:${item.person.id}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
      for(const group of [...groups.values()].flatMap(items=>Array.from({length:Math.ceil(items.length/60)},(_,i)=>items.slice(i*60,(i+1)*60))))try{
        const result=await client.imageUrls(group[0].room,group[0].person,group.map(i=>i.id));
        for(const item of group){const url=result.images.find(i=>i.id===item.id)?.url;pending.delete(item.key);if(!url){item.reject(new Error('图片暂时无法读取。'));continue;}cache.set(item.key,{url,expires:Date.now()+3000000});item.resolve(url);}
      }catch(error){for(const item of group){pending.delete(item.key);item.reject(error);}}
    });}
    return Promise.all(jobs);
  }
  function showImage(image){urls([image]).then(([url])=>{$('letter-image-full').src=url;openModal($('image-dialog'));}).catch(error=>onError(error.message));}
  function imageButton(image,index){
    const button=document.createElement('button');button.type='button';button.className='letter-image';button.setAttribute('aria-label',`查看图片 ${index+1}`);
    const img=document.createElement('img');img.alt=`书信图片 ${index+1}`;img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.width=image.width;img.height=image.height;button.append(img);
    urls([image]).then(([url])=>{img.src=url;}).catch(()=>{button.classList.add('is-unavailable');img.alt='图片暂不可用，点击重试';});
    button.addEventListener('click',()=>showImage(image));return button;
  }
  function paint(){
    previews.replaceChildren();
    images.forEach((image,index)=>{
      const item=document.createElement('div');item.className='letter-attachment';item.append(imageButton(image,index));
      const remove=document.createElement('button');remove.type='button';remove.className='attachment-remove';remove.textContent='×';remove.disabled=disabled;remove.setAttribute('aria-label',`移除图片 ${index+1}`);
      remove.addEventListener('click',()=>{images=images.filter(i=>i.id!==image.id);persist();paint();onChange();client.discardImage(getContext().room,getIdentity(),image.id).catch(()=>{});});item.append(remove);previews.append(item);
    });
    $('letter-upload-status').textContent=uploading?'正在装入图片…':'';
    $('letter-attach').disabled=disabled||uploading>0||images.length>=3;
    $('letter-emoji').disabled=disabled;
  }
  function restore(key,defaults=[]){
    generation++;draft=key;
    try{const saved=localStorage.getItem(key+'.images');images=validImages(saved?JSON.parse(saved):defaults);}catch{images=[];}
    paint();onChange();
  }
  async function select(files){
    if(disabled||uploading)return;
    const room=getContext().room,person=getIdentity();if(!room||!person)return;
    const accepted=[...files].slice(0,3-images.length);if(!accepted.length)return onError('每封信最多放入 3 张图片。');
    if(files.length>accepted.length)onError('每封信最多放入 3 张图片，已选取前面的图片。');
    const revision=generation;uploading++;paint();onChange();
    try{
      for(const file of accepted){
        const prepared=await prepareImage(file),id=crypto.randomUUID();
        const image=await client.uploadImage(room,person,prepared,id);
        if(revision!==generation){await client.discardImage(room,person,id).catch(()=>{});continue;}
        cache.set(identityKey(room,person,id),{url:image.url,expires:Date.now()+3000000});images.push(...validImages([image]));persist();paint();
      }
    }catch(error){onError(error.message||'图片无法读取，请换一张图片。');}
    finally{uploading--;paint();onChange();$('letter-files').value='';}
  }
  $('letter-attach').addEventListener('click',()=>$('letter-files').click());
  $('letter-files').addEventListener('change',()=>select($('letter-files').files));
  input.addEventListener('paste',event=>{const files=[...(event.clipboardData?.files||[])].filter(i=>i.type.startsWith('image/'));if(files.length){event.preventDefault();select(files);}});
  input.addEventListener('dragover',event=>{if(event.dataTransfer?.types.includes('Files'))event.preventDefault();});
  input.addEventListener('drop',event=>{if(event.dataTransfer?.files.length){event.preventDefault();select(event.dataTransfer.files);}});
  function closeEmojis(){emojisOpen=false;picker.classList.remove('is-open');picker.inert=true;$('letter-emoji').setAttribute('aria-expanded','false');}
  $('letter-emoji').addEventListener('click',()=>{
    if(emojisOpen)return closeEmojis();
    if(!emojisBuilt){
      for(const emoji of ['🤍','💌','✨','🌙','☀️','🌷','🍀','🌻','😊','🥰','😘','🥺','🫂','😴','🤗','🥳','❤️','💕','💭','🕊️','✈️','🌍','🏡','📖','☕','🍰','🍜','🎵','🌈','🌊','⭐','🎉']){
        const button=document.createElement('button');button.type='button';button.textContent=emoji;button.setAttribute('aria-label',`插入 ${emoji}`);
        button.addEventListener('click',()=>{const a=input.selectionStart??input.value.length,b=input.selectionEnd??a;input.setRangeText(emoji,a,b,'end');input.dispatchEvent(new Event('input',{bubbles:true}));input.focus({preventScroll:true});closeEmojis();});picker.append(button);
      }emojisBuilt=true;
    }
    emojisOpen=true;picker.inert=false;picker.classList.add('is-open');$('letter-emoji').setAttribute('aria-expanded','true');
  });
  addEventListener('keydown',event=>{if(event.key==='Escape'&&emojisOpen&&!event.isComposing&&event.keyCode!==229&&!isComposing()){event.stopImmediatePropagation();event.preventDefault();closeEmojis();$('letter-emoji').focus();}},true);
  document.addEventListener('pointerdown',event=>{if(emojisOpen&&!picker.contains(event.target)&&!$('letter-emoji').contains(event.target))closeEmojis();},true);
  return {
    restore,urls,
    get images(){return validImages(images);},get uploading(){return uploading>0;},
    setDisabled(value){disabled=value;if(value)closeEmojis();paint();},
    clear(){images=[];persist();paint();onChange();},
    close:closeEmojis,
    history(parent,attachments=[]){if(!attachments.length)return;const grid=document.createElement('div');grid.className='letter-image-grid';attachments.forEach((image,index)=>grid.append(imageButton(image,index)));parent.append(grid);}
  };
}
