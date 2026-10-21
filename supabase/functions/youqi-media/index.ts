import { createClient } from 'npm:@supabase/supabase-js@2.95.3';

const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey, content-type, authorization','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
const url = Deno.env.get('SUPABASE_URL')!;
const secrets = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const admin = createClient(url,secrets.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const bucket=admin.storage.from('youqi-letters');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key=/^[0-9a-f]{64}$/;
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply({error:'请求方式无效。'},405);
  try{
    if(Number(req.headers.get('content-length')||0)>1500000)return reply({error:'图片过大，请选择较小的图片。'},413);
    const multipart=req.headers.get('content-type')?.startsWith('multipart/form-data');
    const form=multipart?await req.formData():null;
    const body=form?JSON.parse(String(form.get('payload'))):await req.json();
    if(!uuid.test(body.room?.id)||!key.test(body.room?.token)||!uuid.test(body.person?.id)||!key.test(body.person?.token))return reply({error:'请使用自己的完整传书链接。'},403);
    const call=async(action:string,payload:Record<string,unknown>)=>{
      const {data,error}=await admin.rpc('youqi_letters',{p_id:body.room.id,p_token:body.room.token,p_action:action,p_payload:{...body.person,...payload}});
      if(error)throw Object.assign(new Error(error.code==='42501'?'没有这张图片的访问权限。':error.code==='P0001'?'今天上传的图片较多，请稍后再试。':'图片暂时无法处理，请重试。'),{status:error.code==='42501'?403:400});
      return data;
    };
    if(body.action==='upload'){
      const file=form?.get('image');
      if(!(file instanceof File)||file.type!=='image/jpeg'||file.size<1||file.size>1200000||!uuid.test(body.image_id)||!Number.isInteger(body.width)||!Number.isInteger(body.height)||body.width<1||body.width>1800||body.height<1||body.height>1800)return reply({error:'请选择有效图片。'},400);
      const bytes=new Uint8Array(await file.arrayBuffer());
      if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)return reply({error:'图片格式无效。'},400);
      const image=await call('media_reserve',{image_id:body.image_id,bytes:file.size,width:body.width,height:body.height});
      const {error}=await bucket.upload(image.path,bytes,{contentType:'image/jpeg',upsert:false,cacheControl:'3600'});
      if(error&&String(error.statusCode)!=='409'&&String(error.statusCode)!=='400')throw new Error('图片上传失败，请重试。');
      // Confirm an existing object on retry instead of treating every 400 as success.
      if(error){const {data,error:check}=await bucket.download(image.path);if(check||!data)throw new Error('图片上传失败，请重试。');}
      const {data:signed,error:signError}=await bucket.createSignedUrl(image.path,3600);
      if(signError)throw new Error('图片已上传，预览暂不可用，请重试。');
      return reply({id:image.id,width:image.width,height:image.height,url:signed.signedUrl});
    }
    if(body.action==='read'){
      if(!Array.isArray(body.images)||body.images.length>60||body.images.some((id:unknown)=>typeof id!=='string'||!uuid.test(id)))return reply({error:'图片列表无效。'},400);
      const result=await call('media_read',{images:body.images});
      if(!result.images.length)return reply({images:[]});
      const {data,error}=await bucket.createSignedUrls(result.images.map((i:{path:string})=>i.path),3600);
      if(error)throw new Error('图片暂时无法读取，请重试。');
      return reply({images:data.flatMap((i,index)=>i.signedUrl?[{id:result.images[index].id,url:i.signedUrl}]:[])});
    }
    if(body.action==='discard'){
      const result=await call('media_discard',{image_id:body.image_id});
      if(result.path){const {error}=await bucket.remove([result.path]);if(error)throw new Error('图片暂时无法移除。');}
      return reply({ok:true});
    }
    return reply({error:'请求无效。'},400);
  }catch(error){return reply({error:error instanceof Error?error.message:'图片暂时无法处理。'},(error as {status?:number}).status||400);}
});
