import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { Profiles } from './profiles.mjs';
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)};};
test('registro, contraseña incorrecta y aislamiento de bibliotecas',async()=>{
 const local=storage(),session=storage(),profiles=new Profiles(local,session);
 profiles.setAnime({path:'/anime/test',title:'Guest series',image:null},'watching');
 await profiles.register('Test User','example-password-for-tests');
 assert.equal(profiles.current().name,'Test User');assert.deepEqual(profiles.current().library,{});
 profiles.setAnime({path:'/anime/second',title:'Series',image:null},'planned');
 profiles.saveProgress('/ver/second-1',42);profiles.logout();
 assert.ok(profiles.current().library['/anime/test']);assert.equal(profiles.current().library['/anime/second'],undefined);
 await assert.rejects(profiles.login('Test User','wrong-password'));
 await profiles.login('test user','example-password-for-tests');
 assert.equal(profiles.current().progress['/ver/second-1'].time,42);
 assert.equal(profiles.current().library['/anime/second'].status,'planned');
 assert.ok(!local.getItem('anime-local-profiles-v1').includes('example-password-for-tests'));
 const reloaded=new Profiles(local,session);assert.equal(reloaded.current().name,'Test User');
});
test('importación y exportación sin credenciales, validación de rutas',()=>{
 const profiles=new Profiles(storage(),storage());
 profiles.setAnime({path:'/anime/test',title:'Series',image:'/image/uploads/portadas/1.jpg'},'completed');
 const exported=profiles.exportData();assert.equal(exported.library['/anime/test'].status,'completed');assert.equal(exported.hash,undefined);
 const other=new Profiles(storage(),storage());other.importData(exported);assert.equal(other.current().library['/anime/test'].title,'Series');
 assert.throws(()=>other.importData({version:1,library:{bad:{path:'https://evil.com',status:'watching',title:'Bad'}},progress:{}}));
});
test('script del catálogo válido',()=>{
 const html=readFileSync(new URL('./catalog.html',import.meta.url),'utf8');
 const text=html.split('<script type="module">')[1].split('</script>')[0].replace(/^import .*$/m,'');
 assert.doesNotThrow(()=>new Script(text));
});
