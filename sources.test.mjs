import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJk, sourceUrl } from './sources.mjs';
import { uuid, mangaItem, pageUrls } from './manga.mjs';
import { Profiles } from './profiles.mjs';
const id='7e544761-7d3d-4fce-8137-719814d7d138';
test('JKAnime: decode published URLs without running scripts and keep supported providers',()=>{
 const remote=Buffer.from('https://mega.nz/embed/abc#key\n').toString('base64');
 const html='<h1>Episode</h1><script>var servers = '+JSON.stringify([{server:'Mega',remote},{server:'Other',remote:Buffer.from('https://example.com/e/x').toString('base64')}])+';</script>';
 const result=parseJk(html);assert.equal(result.available.length,2);assert.equal(result.servers.length,1);assert.equal(result.servers[0].url,'https://mega.nz/file/abc#key');
 assert.throws(()=>parseJk('var servers = [evil()];'));
});
test('source input accepts episode pages only',()=>{
 assert.equal(sourceUrl('https://jkanime.net/test/1/').hostname,'jkanime.net');
 for(const url of ['http://jkanime.net/test/1/','https://jkanime.net/jkplayer/c1?u=x','https://example.com/test/1/','https://jkanime.net:123/test/1/'])assert.throws(()=>sourceUrl(url));
});
test('MangaDex metadata, UUID and page URL validation',()=>{
 const item=mangaItem({id,attributes:{title:{en:'Title'},originalLanguage:'ko',description:{es:'Texto'},tags:[]},relationships:[{type:'cover_art',attributes:{fileName:'cover.jpg'}}]});
 assert.equal(item.type,'Manhwa');assert.equal(item.synopsis,'Texto');assert.ok(item.image.startsWith('https://uploads.mangadex.org/covers/'));
 assert.equal(uuid(id.toUpperCase()),id);assert.throws(()=>uuid('../bad'));
 const result={baseUrl:'https://node.mangadex.network',chapter:{hash:'a'.repeat(32),dataSaver:['1-test.jpg']}};
 assert.equal(pageUrls(result)[0],'https://node.mangadex.network/data-saver/'+'a'.repeat(32)+'/1-test.jpg');
 for(const baseUrl of ['http://node.mangadex.network','https://evil.com','https://mangadex.network.evil.com'])assert.throws(()=>pageUrls({...result,baseUrl}));
 assert.throws(()=>pageUrls({...result,chapter:{...result.chapter,dataSaver:['../secret']}}));
});
test('manga library and page progress survive export/import without profile credentials',()=>{
 const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
 const profile=new Profiles(storage(),storage());
 profile.setAnime({path:'/manga/'+id,title:'Test',image:'https://uploads.mangadex.org/covers/'+id+'/cover.jpg.256.jpg'},'watching',{lastEpisode:'/leer/'+id});
 profile.saveProgress('/leer/'+id,3);
 const other=new Profiles(storage(),storage());other.importData(profile.exportData());
 assert.equal(other.current().library['/manga/'+id].lastEpisode,'/leer/'+id);assert.equal(other.current().progress['/leer/'+id].time,3);
});
