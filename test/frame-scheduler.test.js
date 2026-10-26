import test from 'node:test';import assert from 'node:assert/strict';
import {createFrameScheduler} from '../shared/frame-scheduler.js';
function clock(){let next=0;const queue=new Map();return {queue,request:callback=>{const id=next++;queue.set(id,callback);return id;},cancel:id=>queue.delete(id),tick(now){const batch=[...queue.values()];queue.clear();for(const callback of batch)callback(now);}};}

test('map transitions and idle continuation share one frame even after repeated enter/exit cycles',()=>{
 const time=clock();let draws=0,loop;
 loop=createFrameScheduler(()=>{draws++;loop.invalidate();loop.invalidate();},{request:time.request,cancel:time.cancel});
 loop.invalidate();loop.invalidate();assert.equal(time.queue.size,1);
 for(let i=0;i<1200;i++){time.tick(i*16);assert.equal(time.queue.size,1,'redraws during a frame must not fork persistent animation loops');}
 assert.equal(draws,1200);loop.stop();assert.equal(time.queue.size,0);
});

test('hidden or context-lost views stop work and resume with only one callback',()=>{
 const time=clock();let active=true,draws=0;const loop=createFrameScheduler(()=>draws++,{request:time.request,cancel:time.cancel,active:()=>active});
 loop.invalidate();active=false;loop.stop();loop.invalidate();time.tick(16);assert.equal(draws,0);assert.equal(time.queue.size,0);
 active=true;loop.invalidate();loop.invalidate();time.tick(32);assert.equal(draws,1);assert.equal(time.queue.size,0);
});

test('a cancelled callback cannot clear the resumed view frame or draw stale content',()=>{
 const time=clock();let draws=0;const loop=createFrameScheduler(()=>draws++,{request:time.request,cancel:time.cancel});loop.invalidate();const stale=[...time.queue.values()][0];loop.stop();loop.invalidate();stale(16);loop.invalidate();assert.equal(draws,0);assert.equal(time.queue.size,1);time.tick(32);assert.equal(draws,1);
});
