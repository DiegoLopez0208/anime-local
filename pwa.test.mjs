import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {pwaAsset,servePwa} from './pwa-assets.mjs';
test('mobile assets have correct MIME and icon sizes and never expose arbitrary files',async()=>{
 const manifest=JSON.parse(await readFile(pwaAsset('/manifest.webmanifest').file,'utf8'));
 assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/');
 const ico=await readFile(pwaAsset('/favicon.ico').file);assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),5);
 for(let index=0;index<5;index++){const offset=ico.readUInt32LE(6+index*16+12);assert.equal(ico.subarray(offset+1,offset+4).toString(),'PNG');}
 assert.equal(pwaAsset('/favicon.svg').type,'image/svg+xml');
 for(const icon of manifest.icons){
  const data=await readFile(pwaAsset(icon.src).file);
  assert.equal(data.subarray(1,4).toString(),'PNG');
  assert.equal(data.readUInt32BE(16),Number(icon.sizes.split('x')[0]));
 }
 for(const path of ['/../package.json','/pwa-icons/../../.env','/pwa-icons/unknown.png'])assert.equal(pwaAsset(path),null);
 let headers,status,body;
 const res={writeHead(code,value){status=code;headers=value;return this;},end(value){body=value;}};
 assert.equal(await servePwa({method:'HEAD',url:'/sw.js'},res),true);
 assert.equal(status,200);assert.equal(headers['Service-Worker-Allowed'],'/');assert.equal(body,undefined);
 assert.equal(await servePwa({method:'POST',url:'/manifest.webmanifest'},res),true);assert.equal(status,405);
});
test('mobile worker caches only offline UI and passes API, media and other origins through',async()=>{
 const listeners={},cached=[],removed=[],fallback={offline:true};
 let fresh={online:true},fail=false;
 const context=vm.createContext({URL,Response,self:{location:{origin:'https://anime.example'},addEventListener(name,fn){listeners[name]=fn;},skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async()=>({addAll:async paths=>cached.push(...paths)}),keys:async()=>['anime-local-mobile-old','unrelated-cache','anime-local-mobile-v3'],delete:async name=>removed.push(name),match:async()=>fallback},fetch:async()=>{if(fail)throw Error('offline');return fresh;}});
 vm.runInContext(await readFile(new URL('./public/sw.js',import.meta.url),'utf8'),context);
 let pending;
 listeners.install({waitUntil(value){pending=value;}});await pending;
 assert.deepEqual(cached,['/offline.html','/pwa-icons/icon-192.png']);
 listeners.activate({waitUntil(value){pending=value;}});await pending;assert.deepEqual(removed,['anime-local-mobile-old']);
 const make=(path,mode='navigate',method='GET')=>({request:{method,mode,url:path},respondWith(value){pending=value;this.handled=true;}});
 for(const [path,mode,method] of [['/api/manga/chapter','cors','POST'],['/video/test','no-cors','GET'],['/manga-page/test/0','no-cors','GET'],['/profiles.mjs','cors','GET'],['https://other.example/','navigate','GET']]){
  const event=make(path.startsWith('https:')?path:'https://anime.example'+path,mode,method);listeners.fetch(event);assert.equal(event.handled,undefined);
 }
 const event=make('https://anime.example/');listeners.fetch(event);assert.equal(await pending,fresh);
 fail=true;const offline=make('https://anime.example/');listeners.fetch(offline);assert.equal(await pending,fallback);
 const icon=make('https://anime.example/pwa-icons/icon-192.png','no-cors');listeners.fetch(icon);assert.equal(await pending,fallback);
});
