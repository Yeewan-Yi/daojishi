import { CloudClient, roomUrl, validateRoom, newRoom } from './cloud.js';
import {validImages} from './letter-media.js?v=20261021-experience';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[0-9a-f]{64}$/;
export function validateIdentity(value) {
  if (!value || !UUID.test(value.id) || !KEY.test(value.token)) throw new Error('传书专属链接不完整，请使用自己的完整链接。');
  return {id:value.id, token:value.token};
}
export function identityFromHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (!params.has('person') && !params.has('note')) return null;
  return validateIdentity({id:params.get('person'),token:params.get('note')});
}
export function personalUrl(base, room, identity) {
  const url = new URL(roomUrl(base, room)), person = validateIdentity(identity);
  const params = new URLSearchParams(url.hash.slice(1)); params.set('person',person.id); params.set('note',person.token); url.hash=params.toString();
  return url.href;
}
export function validateBody(body,images=[]) {
  const value = String(body).replace(/\r\n?/g,'\n').trim();
  if ((!value&&!validImages(images).length) || [...value].length > 500) throw new Error('写下 1—500 字，或放入图片。');
  return value;
}
export function createPair(names) {
  if (!Array.isArray(names) || names.length !== 2 || names.some(name => typeof name !== 'string' || !name.trim() || [...name.trim()].length > 12)) throw new Error('请填写两个人的称呼，每个不超过 12 字。');
  return names.map(name => ({...newRoom(),name:name.trim()}));
}
export function parsePage(data) {
  if (!data || !Number.isSafeInteger(data.revision) || data.revision < 0 || !Number.isSafeInteger(data.latest_other) || !Array.isArray(data.items) || data.items.length>20) throw new Error('书信读取失败，请重试。');
  for (const row of data.items) {
    if (!UUID.test(row.id) || !UUID.test(row.author) || typeof row.name!=='string' || typeof row.body!=='string' || (!row.body.trim()&&!validImages(row.images).length) || [...row.body].length>500 || !Number.isSafeInteger(row.seq) || !Number.isSafeInteger(row.version) || row.version<1 || !Number.isFinite(Date.parse(row.created_at)) || !Number.isFinite(Date.parse(row.updated_at))) throw new Error('书信数据无效，请重试。');
    validImages(row.images);
  }
  return data;
}
export class LettersClient {
  constructor(cloud = new CloudClient()) { this.cloud=cloud; }
  async call(room, action, payload={}) {
    validateRoom(room);
    try { return await this.cloud.rpc('youqi_letters',{p_id:room.id,p_token:room.token,p_action:action,p_payload:payload}); }
    catch(error) {
      const messages={SETUP:'传书功能暂未连接，请稍后重试。',ACCESS:'这条链接没有传书权限，请使用自己的专属链接。',CONFLICT:'这封信已在另一处更新，请重新打开后修改。',VALIDATION:'请检查称呼或书信内容。',SERVER:'暂时无法保存，请稍后重试；草稿已保留。'};
      if(messages[error.code]) error.message=messages[error.code];
      throw error;
    }
  }
  setup(room,pair) { return this.call(room,'setup',{members:pair.map(person=>({...validateIdentity(person),name:person.name}))}); }
  status(room,identity) { return this.call(room,'status',identity ? validateIdentity(identity) : {}); }
  async list(room,identity,before=null) { return parsePage(await this.call(room,'list',{...validateIdentity(identity),before})); }
  write(room,identity,body,id=crypto.randomUUID(),version=null,images=[]) { const attachments=validImages(images);return this.call(room,'write',{...validateIdentity(identity),message_id:id,body:validateBody(body,attachments),version,images:attachments.map(i=>i.id)}); }
  async media(room,identity,action,payload={},file=null){
    validateRoom(room);validateIdentity(identity);
    const body={room,person:identity,action,...payload},controller=new AbortController(),timer=setTimeout(()=>controller.abort(),35000);
    let data=JSON.stringify(body),headers={apikey:this.cloud.key,'Content-Type':'application/json'};
    if(file){data=new FormData();data.append('payload',JSON.stringify(body));data.append('image',file,'letter.jpg');headers={apikey:this.cloud.key};}
    try{
      const response=await this.cloud.fetcher(`${this.cloud.base}/functions/v1/youqi-media`,{method:'POST',headers,body:data,signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'图片暂时无法处理，请重试。');return result;
    }catch(error){if(error instanceof TypeError||controller.signal.aborted)throw new Error('图片连接超时或网络不可用，请重试。');throw error;}
    finally{clearTimeout(timer);}
  }
  async uploadImage(room,identity,image,id){const result=await this.media(room,identity,'upload',{image_id:id,width:image.width,height:image.height},image.blob);validImages([result]);this.checkImageUrl(result.url);return result;}
  async imageUrls(room,identity,ids){const result=await this.media(room,identity,'read',{images:[...new Set(ids)]});if(!Array.isArray(result.images))throw new Error('图片返回内容无效。');for(const image of result.images){if(!UUID.test(image.id)||!ids.includes(image.id))throw new Error('图片返回内容无效。');this.checkImageUrl(image.url);}return result;}
  checkImageUrl(value){if(typeof value!=='string'||!value.startsWith(`${this.cloud.base}/storage/v1/object/sign/youqi-letters/`))throw new Error('图片地址无效。');}
  discardImage(room,identity,id){return this.media(room,identity,'discard',{image_id:id});}
  remove(room,identity,id,version) { if(!UUID.test(id)) throw new Error('书信不存在。'); return this.call(room,'delete',{...validateIdentity(identity),message_id:id,version}); }
}
