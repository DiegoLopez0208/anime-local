import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScore, parseSearch, exactMatch, parseRanking, malId, kind } from './ratings.mjs';
import { Profiles } from './profiles.mjs';
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)};};
test('MAL scores distinguish an unrated title and reject blocked or invalid pages',()=>{
 const html='<h1><span class="title-name">One Piece</span></h1><span itemprop="ratingValue">8.72</span><span itemprop="ratingCount">1,561,591</span>';
 const data=parseScore(html,'anime',21);
 assert.equal(data.score,8.72);assert.equal(data.votes,1561591);assert.equal(data.title,'One Piece');assert.equal(data.url,'https://myanimelist.net/anime/21');
 assert.equal(parseScore(html.replace('8.72','N/A'),'anime',21).score,null);
 assert.throws(()=>parseScore('<h1>Access denied</h1>','anime',21));
 assert.throws(()=>parseScore(html.replace('8.72','NaN'),'anime',21));
 assert.throws(()=>malId('../21'));assert.throws(()=>kind('user'));
});
test('MAL search accepts only canonical entries and deduplicates titles',()=>{
 const html='<a class="hoverinfo_trigger" href="https://myanimelist.net/anime/21/One_Piece"><strong>One Piece</strong></a><a class="hoverinfo_trigger" href="/anime/21/One_Piece">Duplicate</a><a class="hoverinfo_trigger" href="https://evil.example/anime/22/Evil">Bad</a><a class="hoverinfo_trigger" href="/manga/23/Test">Wrong type</a><a class="hoverinfo_trigger" href="javascript:alert(1)">Bad</a>';
 assert.deepEqual(parseSearch(html,'anime'),[{id:21,title:'One Piece'}]);
});
test('MAL title matching avoids choosing another season or an ambiguous match',()=>{
 const rows=[{id:1,title:'Hyouken no Majutsushi'},{id:2,title:'Hyouken no Majutsushi II'}];
 assert.equal(exactMatch(rows,'hyouken no majutsushi!'),1);assert.equal(exactMatch(rows,'Hyouken no Majutsushi II'),2);
 assert.equal(exactMatch(rows,'Hyouken'),null);assert.equal(exactMatch([...rows,{id:3,title:rows[0].title}],rows[0].title),null);
});
test('MAL ranking reads the community score and skips invalid rows',()=>{
 const row=(id,score)=>'<tr class="ranking-list"><td class="rank">1</td><td><h3><a href="/manga/'+id+'/Test">Test</a></h3><div class="information">Manga (10 vols)</div></td><td class="score"><span class="score-label">'+score+'</span></td><td>My score: 1</td></tr>';
 const data=parseRanking('<table>'+row(2,'9.46')+row(3,'N/A')+'</table>','manga');
 assert.equal(data.items.length,1);assert.equal(data.items[0].score,9.46);assert.equal(data.items[0].kind,'manga');
 assert.throws(()=>parseRanking('<p>Blocked</p>','manga'));
});
test('personal ratings survive status changes, reload and import; invalid imports do not alter the library',()=>{
 const local=storage(),session=storage(),profiles=new Profiles(local,session);
 const anime={path:'/anime/test',title:'Test',image:null};
 const manga={path:'/manga/00000000-0000-0000-0000-000000000001',title:'Reading',image:null};
 profiles.setAnime(anime,'watching',{lastEpisode:'/ver/test-1'});profiles.setRating(anime,8);profiles.setAnime(anime,'completed');
 profiles.setRating(manga,10);
 const reload=new Profiles(local,session);
 assert.equal(reload.current().library[anime.path].rating,8);assert.equal(reload.current().library[anime.path].status,'completed');
 assert.equal(reload.current().library[manga.path].status,'planned');
 const other=new Profiles(storage(),storage());other.importData(profiles.exportData());
 assert.equal(other.current().library[manga.path].rating,10);
 const before=JSON.stringify(other.exportData()),invalid=structuredClone(profiles.exportData());invalid.library[manga.path].rating=11;
 assert.throws(()=>other.importData(invalid));assert.equal(JSON.stringify(other.exportData()),before);
 for(const value of [0,11,1.5,'8',undefined])assert.throws(()=>profiles.setRating(anime,value));
 profiles.setRating(anime,null);assert.equal(profiles.current().library[anime.path].rating,null);
});
