import test from 'node:test';
import assert from 'node:assert/strict';
import {createPair,identityFromHash,personalUrl,validateIdentity,validateBody,parsePage,LettersClient} from '../letters.js';
import {CloudClient,roomFromHash} from '../cloud.js';
const room={id:crypto.randomUUID(),token:'a'.repeat(64)}, [one,two]=createPair(['小雨','阿泽']);

test('personal links keep room and independent identity capabilities in fragments only',()=>{
  const url=new URL(personalUrl('https://example.com/?old=1#c=old',room,one));
  assert.equal(url.search,'');assert.deepEqual(roomFromHash(url.hash),room);assert.deepEqual(identityFromHash(url.hash),validateIdentity(one));
  assert.notEqual(one.token,two.token);assert.notEqual(one.id,two.id);
  assert.equal(identityFromHash('#room=x'),null);
  for(const hash of [`#person=${one.id}`,`#note=${one.token}`,'#person=bad&note=bad'])assert.throws(()=>identityFromHash(hash));
});
test('empty, excessive and malformed messages and names are rejected, Unicode counts as characters',()=>{
  assert.equal(validateBody('  想见你\r\n明天见  '),'想见你\n明天见');
  assert.equal(validateBody('🌙'.repeat(500)).length,1000);
  for(const text of [' ','\n','🌙'.repeat(501)])assert.throws(()=>validateBody(text));
  for(const names of [[],['一位'],['','另一个'],['a'.repeat(13),'二位']])assert.throws(()=>createPair(names));
});
test('retries reuse a message UUID and writes carry personal identity plus optimistic version',async()=>{
  const calls=[];
  const cloud=new CloudClient(async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});return new Response('{"saved":true}',{status:200});});
  const client=new LettersClient(cloud), id=crypto.randomUUID();
  await client.write(room,one,'晚安',id);await client.write(room,one,'晚安',id);await client.write(room,one,'好梦',id,3);await client.remove(room,one,id,4);
  assert.equal(calls[0].body.p_payload.message_id,calls[1].body.p_payload.message_id);
  assert.equal(calls[2].body.p_payload.version,3);assert.equal(calls[3].body.p_action,'delete');
  assert.equal(calls[0].body.p_payload.token,one.token);assert.equal(calls[0].options.referrerPolicy,'no-referrer');
  assert.equal(calls[0].options.headers.Authorization,undefined);
});
test('invalid history does not get rendered as successful server data',()=>{
  const row={id:crypto.randomUUID(),author:one.id,seq:1,version:1,name:'小雨',body:'hello',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  const page={revision:1,latest_other:0,items:[row],cursor:null};
  assert.equal(parsePage(page),page);
  for(const bad of [{...page,revision:-1},{...page,items:[{...row,body:null}]},{...page,items:[{...row,author:'bad'}]},{...page,items:[{...row,version:0}]}])assert.throws(()=>parsePage(bad));
});
