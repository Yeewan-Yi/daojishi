import test from 'node:test';
import assert from 'node:assert/strict';
import {shiftDate,monthCells} from '../date-picker.js';
import {validImages} from '../letter-media.js';
import {validateBody,parsePage,LettersClient,createPair} from '../letters.js';
import {CloudClient,newRoom} from '../cloud.js';

test('month and year changes clamp the day across leap years and short months',()=>{
  const jan=new Date(2028,0,31,18,30),feb=shiftDate(jan,'month',1);
  assert.equal(feb.getMonth(),1);assert.equal(feb.getDate(),29);assert.equal(feb.getHours(),18);
  assert.equal(shiftDate(feb,'year',1).getDate(),28);assert.equal(jan.getMonth(),0);
  assert.equal(shiftDate(new Date(2026,11,31),'month',1).getFullYear(),2027);
});
test('time-wheel changes carry across midnight and calendar weeks start on Monday',()=>{
  const next=shiftDate(new Date(2026,9,31,23,59),'minute',1);
  assert.equal(next.getMonth(),10);assert.equal(next.getDate(),1);assert.equal(next.getHours(),0);assert.equal(next.getMinutes(),0);
  const cells=monthCells(new Date(2026,9,1));assert.equal(cells.length%7,0);assert.equal(cells[3],1);assert.equal(cells.filter(Boolean).length,31);
});
test('image-only letters are valid and image metadata stays bounded',()=>{
  const image={id:crypto.randomUUID(),width:1600,height:900};assert.equal(validateBody('',[image]),'');assert.throws(()=>validateBody(''));
  assert.throws(()=>validImages(Array(4).fill(image)));assert.throws(()=>validImages([{...image,id:'invalid'}]));assert.throws(()=>validImages([{...image,width:1900}]));
  const row={id:crypto.randomUUID(),author:crypto.randomUUID(),name:'甲',body:'',images:[image],seq:1,version:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  assert.equal(parsePage({items:[row],revision:1,latest_other:0}).items[0],row);assert.throws(()=>parsePage({items:[{...row,images:[]}],revision:1,latest_other:0}));
});
test('image identities stay in request bodies and sends preserve attachment IDs',async()=>{
  const calls=[],room=newRoom(),[person]=createPair(['甲','乙']),image={id:crypto.randomUUID(),width:120,height:80};
  const cloud=new CloudClient(async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});return new Response(JSON.stringify(url.includes('/functions/')?{images:[]}:{saved:true}),{status:200});});
  const client=new LettersClient(cloud);await client.write(room,person,'',crypto.randomUUID(),null,[image]);await client.imageUrls(room,person,[image.id]);
  assert.deepEqual(calls[0].body.p_payload.images,[image.id]);assert.equal(calls[1].body.person.token,person.token);assert.equal(calls[1].url.includes(person.token),false);assert.equal(calls[1].options.referrerPolicy,'no-referrer');
  assert.throws(()=>client.checkImageUrl('https://other.example/image.jpg'));
});
