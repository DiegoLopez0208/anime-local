import test from 'node:test';
import assert from 'node:assert/strict';
import { search, detail } from './manga.mjs';
const removed='00000000-0000-0000-0000-000000000001',latin='00000000-0000-0000-0000-000000000002',english='00000000-0000-0000-0000-000000000003';
const row=id=>({id,attributes:{title:{en:id},contentRating:'safe',originalLanguage:'ja',tags:[],availableTranslatedLanguages:['es','es-la','en']},relationships:[]});
const ch=(id,lang)=>({id,attributes:{chapter:'1',pages:8,translatedLanguage:lang,externalUrl:null,isUnavailable:false},relationships:[]});
test('search verifies readable feeds, combines Spanish variants and detail offers a real language alternative',async t=>{
 const calls=[];
 t.mock.method(globalThis,'fetch',async address=>{
  const url=new URL(address);calls.push(url);
  let payload;
  if(url.pathname==='/manga')payload={data:[row(removed),row(latin)],total:2,offset:0,limit:24};
  else if(url.pathname.endsWith('/feed')){
   const id=url.pathname.split('/')[2],langs=url.searchParams.getAll('translatedLanguage[]');
   assert.equal(url.searchParams.get('includeUnavailable'),'0');assert.equal(url.searchParams.get('includeExternalUrl'),'0');
   assert.equal(url.searchParams.get('includeEmptyPages'),'0');
   const data=id===latin&&langs.includes('es-la')?[ch(latin,'es-la')]:id===english&&langs.includes('en')?[ch(english,'en')]:[];
   payload={data,total:data.length,offset:0,limit:Number(url.searchParams.get('limit'))};
  }else payload={data:row(url.pathname.split('/')[2])};
  return new Response(JSON.stringify({result:'ok',...payload}),{headers:{'Content-Type':'application/json'}});
 });
 const result=await search({language:'es-la'});
 assert.deepEqual(result.items.map(x=>x.id),[latin]);assert.equal(result.items[0].chapterCount,1);
 assert.deepEqual(calls.find(x=>x.pathname==='/manga').searchParams.getAll('availableTranslatedLanguage[]'),['es','es-la']);
 const spanish=await detail({id:latin,language:'es'});
 assert.equal(spanish.chapters[0].language,'es-la');assert.equal(spanish.language,'es');
 const alternative=await detail({id:english,language:'es'});
 assert.equal(alternative.chapters.length,0);assert.deepEqual(alternative.alternatives,[{language:'en',total:1}]);
 const empty=await detail({id:removed,language:'en'});
 assert.equal(empty.chapters.length,0);assert.deepEqual(empty.alternatives,[]);
});
