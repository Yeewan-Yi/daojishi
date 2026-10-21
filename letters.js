import { CloudClient, roomUrl, validateRoom, newRoom } from './cloud.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[0-9a-f]{64}$/;
export function validateIdentity(value) {
  if (!value || !UUID.test(value.id) || !KEY.test(value.token)) throw new Error('留言专属链接不完整，请使用自己的完整链接。');
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
export function validateBody(body) {
  const value = String(body).replace(/\r\n?/g,'\n').trim();
  if (!value || [...value].length > 500) throw new Error('写下 1—500 字的留言。');
  return value;
}
export function createPair(names) {
  if (!Array.isArray(names) || names.length !== 2 || names.some(name => typeof name !== 'string' || !name.trim() || [...name.trim()].length > 12)) throw new Error('请填写两个人的称呼，每个不超过 12 字。');
  return names.map(name => ({...newRoom(),name:name.trim()}));
}
export function parsePage(data) {
  if (!data || !Number.isSafeInteger(data.revision) || data.revision < 0 || !Number.isSafeInteger(data.latest_other) || !Array.isArray(data.items) || data.items.length>20) throw new Error('留言读取失败，请重试。');
  for (const row of data.items) {
    if (!UUID.test(row.id) || !UUID.test(row.author) || typeof row.name!=='string' || typeof row.body!=='string' || !row.body.trim() || [...row.body].length>500 || !Number.isSafeInteger(row.seq) || !Number.isSafeInteger(row.version) || row.version<1 || !Number.isFinite(Date.parse(row.created_at)) || !Number.isFinite(Date.parse(row.updated_at))) throw new Error('留言数据无效，请重试。');
  }
  return data;
}
export class LettersClient {
  constructor(cloud = new CloudClient()) { this.cloud=cloud; }
  async call(room, action, payload={}) {
    validateRoom(room);
    try { return await this.cloud.rpc('youqi_letters',{p_id:room.id,p_token:room.token,p_action:action,p_payload:payload}); }
    catch(error) {
      const messages={SETUP:'留言功能暂未连接，请稍后重试。',ACCESS:'这条链接没有留言权限，请使用自己的专属链接。',CONFLICT:'这条留言已在另一处更新，请重新打开后修改。',VALIDATION:'请检查称呼或留言内容。',SERVER:'暂时无法保存，请稍后重试；草稿已保留。'};
      if(messages[error.code]) error.message=messages[error.code];
      throw error;
    }
  }
  setup(room,pair) { return this.call(room,'setup',{members:pair.map(person=>({...validateIdentity(person),name:person.name}))}); }
  status(room,identity) { return this.call(room,'status',identity ? validateIdentity(identity) : {}); }
  async list(room,identity,before=null) { return parsePage(await this.call(room,'list',{...validateIdentity(identity),before})); }
  write(room,identity,body,id=crypto.randomUUID(),version=null) { return this.call(room,'write',{...validateIdentity(identity),message_id:id,body:validateBody(body),version}); }
  remove(room,identity,id,version) { if(!UUID.test(id)) throw new Error('留言不存在。'); return this.call(room,'delete',{...validateIdentity(identity),message_id:id,version}); }
}
