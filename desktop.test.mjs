import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Profiles} from './profiles.mjs';
const {externalAllowed}=createRequire(import.meta.url)('./desktop/policy.cjs');
test('desktop opens only known external destinations and rejects local files, credentials and unrelated origins',()=>{
 const origin='http://127.0.0.1:5198';
 for(const url of [origin+'/license','https://myanimelist.net/anime/21','https://github.com/DiegoLopez0208/anime-local/releases/latest/download/Anime-Local-Windows-Setup.exe'])assert.equal(externalAllowed(url,origin),true);
 for(const url of ['file:///C:/Windows/System32/cmd.exe','javascript:alert(1)','https://myanimelist.net.evil.com/anime/21','https://user@myanimelist.net/anime/21','https://github.com/other/releases/app.exe','https://myanimelist.net:444/anime/21',origin+'/api/play'])assert.equal(externalAllowed(url,origin),false);
});
test('favorites preserve reading state and score and survive export/import without accepting invalid values',()=>{
 const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
 const p=new Profiles(storage(),storage()),item={path:'/anime/favorite-test',title:'Favorite test',image:null};
 p.setAnime(item,'completed');p.setRating(item,9);p.setFavorite(item,true);
 assert.equal(p.current().library[item.path].status,'completed');assert.equal(p.current().library[item.path].rating,9);
 const imported=new Profiles(storage(),storage());imported.importData(p.exportData());assert.equal(imported.current().library[item.path].favorite,true);
 const invalid=structuredClone(p.exportData());invalid.library[item.path].favorite='yes';assert.throws(()=>imported.importData(invalid));assert.equal(imported.current().library[item.path].favorite,true);
 p.setFavorite(item,false);assert.equal(p.current().library[item.path].status,'completed');
});
