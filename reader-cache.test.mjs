import test from 'node:test';
import assert from 'node:assert/strict';
import { createReaderCache } from './reader-cache.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('five-page cache reuses overlapping pages and limits simultaneous downloads',async()=>{
 let running=0,max=0;const calls=[],released=[];
 const cache=createReaderCache({load:async index=>{calls.push(index);max=Math.max(max,++running);await new Promise(r=>setTimeout(r,5));running--;return {index};},createUrl:value=>'blob:'+value.index,revokeUrl:url=>released.push(url)});
 const urls=await Promise.all([0,1,2,3,4].map(i=>cache.get(i)));
 assert.equal(max,2);assert.deepEqual(calls,[0,1,2,3,4]);assert.equal(await cache.get(1),urls[1]);assert.equal(calls.length,5);
 cache.retain([1,2,3,4,5]);assert.deepEqual(released,['blob:0']);
 assert.equal(await cache.get(5),'blob:5');assert.equal(await cache.get(2),urls[2]);assert.equal(calls.length,6);
 cache.close();assert.equal(released.length,6);assert.equal(new Set(released).size,6);
});
test('leaving the reader cancels queued pages and ignores late responses without leaking object URLs',async()=>{
 const started=[],created=[],resolvers=[];
 const cache=createReaderCache({load:(index,signal)=>{started.push({index,signal});return new Promise(r=>resolvers.push(r));},createUrl:value=>{created.push(value);return 'blob:test';}});
 const results=Promise.allSettled([0,1,2,3,4].map(i=>cache.get(i)));
 await tick();assert.equal(started.length,2);cache.close();
 assert.ok(started.every(x=>x.signal.aborted));for(const resolve of resolvers)resolve(new Blob(['late']));
 await tick();assert.equal(created.length,0);assert.equal(started.length,2);
 assert.ok((await results).every(x=>x.status==='rejected'&&x.reason.name==='AbortError'));
});
test('a failed prefetched page can be retried independently',async()=>{
 let attempts=0;const cache=createReaderCache({load:async()=>{if(++attempts===1)throw Error('temporary failure');return new Blob(['image']);},createUrl:()=>'blob:ready',revokeUrl:()=>{}});
 await assert.rejects(cache.get(2),/temporary failure/);assert.equal(await cache.get(2),'blob:ready');assert.equal(attempts,2);cache.close();
});
