const BASE = 'https://api.mangadex.org';
const cache = new Map(), pending = new Map();
export function uuid(value) {
 if (typeof value !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)) throw Error('Identificador de MangaDex no válido.');
 return value.toLowerCase();
}
const language = value => ['es','es-la','en'].includes(value) ? value : 'es';
const offsetValue = value => Math.min(9900, Math.max(0, Math.floor(Number(value) || 0)));
async function request(path, ttl = 60000) {
 const cached = cache.get(path); if(cached?.until > Date.now()) return cached.data;
 if(pending.has(path))return pending.get(path);
 const task=(async()=>{
  const response=await fetch(BASE+path,{headers:{'User-Agent':'AnimeLocal/0.2 (https://github.com/DiegoLopez0208/anime-local)'},signal:AbortSignal.timeout(20000)});
  if(response.status===429)throw Error('MangaDex pidió una pausa. Intenta nuevamente en un minuto.');
  if(!response.ok)throw Error('MangaDex respondió HTTP '+response.status+'.');
  const data=await response.json();if(data.result!=='ok')throw Error('MangaDex no pudo completar la consulta.');
  while(cache.size>=100)cache.delete(cache.keys().next().value);
  cache.set(path,{data,until:Date.now()+ttl});return data;
 })().finally(()=>pending.delete(path));
 pending.set(path,task);return task;
}
const text = (values) => values?.es || values?.['es-la'] || values?.en || Object.values(values||{})[0] || '';
export function mangaItem(row) {
 const a=row.attributes||{}, cover=row.relationships?.find(item=>item.type==='cover_art')?.attributes?.fileName;
 const id=uuid(row.id);
 return {id,path:'/manga/'+id,title:text(a.title),synopsis:text(a.description),status:a.status,
 type:({ja:'Manga',ko:'Manhwa',zh:'Manhua'})[a.originalLanguage]||'Cómic',
 image:cover&&/^[\w.-]+$/.test(cover)?'https://uploads.mangadex.org/covers/'+id+'/'+cover+'.256.jpg':null,
 tags:(a.tags||[]).map(tag=>text(tag.attributes?.name)),languages:a.availableTranslatedLanguages||[]};
}
export async function search(input={}) {
 const params=new URLSearchParams({limit:'24',offset:String(offsetValue(input.offset)),'includes[]':'cover_art','contentRating[]':'safe',hasAvailableChapters:'true','availableTranslatedLanguage[]':language(input.language)});
 if(input.q)params.set('title',String(input.q).trim().slice(0,120));
 if(['ja','ko','zh'].includes(input.type))params.set('originalLanguage[]',input.type);
 params.set('order[followedCount]','desc');
 const result=await request('/manga?'+params);
 return {items:result.data.map(mangaItem),total:result.total,offset:result.offset,limit:result.limit};
}
export async function detail(input) {
 const id=uuid(input.id), lang=language(input.language), offset=offsetValue(input.offset);
 // Metadata and chapter feed share the same public API; issue sequentially.
 const row=await request('/manga/'+id+'?includes[]=cover_art');
 const info=mangaItem(row.data);
 if(row.data.attributes.contentRating!=='safe')throw Error('Este catálogo solo incluye obras con clasificación safe.');
 const params=new URLSearchParams({limit:'100',offset:String(offset),'translatedLanguage[]':lang,includeEmptyPages:'0','order[chapter]':'asc','order[volume]':'asc'});
 const feed=await request('/manga/'+id+'/feed?'+params);
 return {...info,language:lang,total:feed.total,offset,limit:100,chapters:feed.data.map(row=>({
  id:row.id,path:'/leer/'+row.id,number:row.attributes.chapter,title:row.attributes.title,
  pages:row.attributes.pages,externalUrl:row.attributes.externalUrl,
  group:row.relationships?.find(r=>r.type==='scanlation_group')?.id
 }))};
}
export function pageUrls(result) {
 const base=new URL(result.baseUrl);
 if(base.protocol!=='https:' || base.username || base.password || base.port || !(base.hostname.endsWith('.mangadex.network') || base.hostname==='uploads.mangadex.org'))throw Error('Servidor de imágenes no reconocido.');
 const hash=result.chapter?.hash;
 if(!/^[a-f0-9]{32}$/.test(hash))throw Error('Capítulo sin imágenes válidas.');
 const pages=result.chapter.dataSaver;
 if(!Array.isArray(pages) || !pages.length || pages.length>1000)throw Error('Capítulo sin páginas disponibles.');
 return pages.map(file=>{if(!/^[\w.-]+$/.test(file))throw Error('Página no válida.');return base.href.replace(/\/$/,'')+'/data-saver/'+hash+'/'+file;});
}
export async function chapter(input) {
 const id=uuid(input.id), row=await request('/chapter/'+id);
 const mangaId=uuid(row.data.relationships.find(r=>r.type==='manga')?.id);
 const manga=await request('/manga/'+mangaId+'?includes[]=cover_art');
 if(manga.data.attributes.contentRating!=='safe')throw Error('Este catálogo solo incluye obras con clasificación safe.');
 if(row.data.attributes.externalUrl)throw Error('Este capítulo se lee en la página de su editor.');
 const result=await request('/at-home/server/'+id+'?forcePort443=true',30000);
 return {id,manga:mangaItem(manga.data),number:row.data.attributes.chapter,title:row.data.attributes.title,language:row.data.attributes.translatedLanguage,pages:pageUrls(result)};
}
