import test from 'node:test';
import assert from 'node:assert/strict';
import {JourneyClient} from '../journey-data.js';

test('concurrent consumers share a private URL request, while thumbnail and full image remain separate',async()=>{
 const client=new JourneyClient({room:{id:'test'}},{base:'https://example.com'});let calls=0;
 client.media=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,10));return {url:'https://example.com/storage/v1/object/sign/youqi-journey/photo?token=test'};};
 const results=await Promise.all([client.urls('photo'),client.urls('photo'),client.urls('photo',true)]);
 assert.equal(calls,2);assert.deepEqual(results[0],results[1]);
 await client.urls('photo');assert.equal(calls,2);
 client.urlCache.get('photo:false').expires=0;await client.urls('photo');assert.equal(calls,3);
});
test('failed signing requests are not cached and can be retried',async()=>{
 const client=new JourneyClient({room:{id:'test'}},{base:'https://example.com'});let calls=0;
 client.media=async()=>{if(++calls===1)throw Error('temporary failure');return {url:'https://example.com/storage/v1/object/sign/youqi-journey/photo'};};
 await assert.rejects(client.urls('photo'));await client.urls('photo');assert.equal(calls,2);assert.equal(client.urlPending.size,0);
});
