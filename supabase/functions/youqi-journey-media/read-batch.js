const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function readMediaBatch(requests,{inspect,signStorage,signR2}){
 if(!Array.isArray(requests)||!requests.length||requests.length>20||requests.some(r=>!uuid.test(r?.id)||typeof r.full!=='boolean')||new Set(requests.map(r=>r.id+':'+r.full)).size!==requests.length)throw Error('读取列表无效。');
 const entries=[];
 // Every ID goes through the existing room/person authorization before signing.
 for(let i=0;i<requests.length;i+=4){entries.push(...await Promise.all(requests.slice(i,i+4).map(async request=>{
   try{return {request,row:await inspect(request.id)};}catch{return {request,error:'这份回忆暂时无法读取。'};}
 })));}
 const stored=entries.filter(e=>e.row&&e.row.provider!=='r2');
 const paths=stored.map(e=>e.request.full?e.row.object_key:e.row.thumb_key);
 let signed=[];if(paths.length){try{signed=await signStorage(paths);}catch{}}
 const urls=new Map(signed.filter(r=>r?.signedUrl&&!r.error).map(r=>[r.path,r.signedUrl]));
 return {items:await Promise.all(entries.map(async({request,row,error})=>{
   if(error)return {...request,error};
   try{const path=request.full?row.object_key:row.thumb_key,url=row.provider==='r2'?await signR2(path):urls.get(path);if(!url)throw Error();return {...request,url,expires_in:900,provider:row.provider};}catch{return {...request,error:'图片地址暂时无法取得，请重试。'};}
 }))};
}
