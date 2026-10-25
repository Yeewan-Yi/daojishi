import test from 'node:test';
import assert from 'node:assert/strict';
import {JourneyClient} from '../journey-data.js';
import {readMediaBatch} from '../supabase/functions/youqi-journey-media/read-batch.js';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');

test('45 thumbnails are split into three bounded batches while a full image starts immediately',async()=>{
 const client=new JourneyClient({room:{id:'test'}},{base:'https://example.com'}),calls=[];
 client.media=async(action,payload)=>{calls.push({action,count:payload.requests?.length});const url='https://example.com/storage/v1/object/sign/youqi-journey/photo';return action==='read'?{url}:{items:payload.requests.map(row=>({...row,url}))};};
 const thumbs=Array.from({length:45},(_,i)=>client.urls(id(i)));
 await client.urls(id(99),true);assert.equal(calls[0].action,'read');
 await Promise.all(thumbs);assert.deepEqual(calls.filter(c=>c.action==='read_many').map(c=>c.count),[20,20,5]);
});
test('batch reads authorize every item and never sign a denied item',async()=>{
 const inspected=[],signed=[];
 const result=await readMediaBatch([{id:id(1),full:false},{id:id(2),full:false}],{
  inspect:async key=>{inspected.push(key);if(key===id(2))throw Error('wrong room');return {provider:'supabase',object_key:'original',thumb_key:'permitted-thumb'};},
  signStorage:async paths=>{signed.push(...paths);return paths.map(path=>({path,signedUrl:'https://example.com/'+path}));},signR2:()=>assert.fail('Unexpected R2 access')
 });
 assert.equal(inspected.length,2);assert.deepEqual(signed,['permitted-thumb']);assert.ok(result.items[1].error);assert.equal(result.items[1].url,undefined);
});
test('invalid and oversized batches are rejected before any storage or database access',async()=>{
 const hooks={inspect:()=>assert.fail(),signStorage:()=>assert.fail(),signR2:()=>assert.fail()};
 for(const rows of [[],[{id:'bad',full:false}],Array.from({length:21},(_,i)=>({id:id(i),full:false})),[{id:id(1),full:false},{id:id(1),full:false}]])await assert.rejects(readMediaBatch(rows,hooks));
});

test('concurrent consumers share a private URL request, while thumbnail and full image remain separate',async()=>{
 const client=new JourneyClient({room:{id:'test'}},{base:'https://example.com'});let calls=0;
 client.media=async(action,payload)=>{calls++;await new Promise(resolve=>setTimeout(resolve,10));const result={url:'https://example.com/storage/v1/object/sign/youqi-journey/photo?token=test'};return action==='read_many'?{items:payload.requests.map(row=>({...row,...result}))}:result;};
 const results=await Promise.all([client.urls('photo'),client.urls('photo'),client.urls('photo',true)]);
 assert.equal(calls,2);assert.deepEqual(results[0],results[1]);
 await client.urls('photo');assert.equal(calls,2);
 client.urlCache.get('photo:false').expires=0;await client.urls('photo');assert.equal(calls,3);
});
test('failed signing requests are not cached and can be retried',async()=>{
 const client=new JourneyClient({room:{id:'test'}},{base:'https://example.com'});let calls=0;
 client.media=async(action,payload)=>{if(++calls===1)throw Error('temporary failure');return {items:payload.requests.map(row=>({...row,url:'https://example.com/storage/v1/object/sign/youqi-journey/photo'}))};};
 await assert.rejects(client.urls('photo'));await client.urls('photo');assert.equal(calls,2);assert.equal(client.urlPending.size,0);
});

test('local preview consumers also share an in-flight object URL read',async()=>{
 const client=new JourneyClient({localOnly:true});let calls=0,finish;
 client.readUrl=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
 const first=client.urls('local-photo',true),second=client.urls('local-photo',true);
 assert.equal(calls,1);finish({url:'blob:synthetic-local-photo',local:true});
 assert.deepEqual(await first,await second);assert.equal(client.urlPending.size,0);
});
