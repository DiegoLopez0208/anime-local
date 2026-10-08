const BASE = 'https://api.mangadex.org';
const cache = new Map(), pending = new Map();
let nextRequest=0;
export function uuid(value) {
 if (typeof value !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)) throw Error('Identificador de lectura no válido.');
 return value.toLowerCase();
}
const language = value => value==='en' ? 'en' : 'es';
const languageCodes = value => language(value)==='es' ? ['es','es-la'] : ['en'];
const offsetValue = value => Math.min(9900, Math.max(0, Math.floor(Number(value) || 0)));
async function request(path, ttl = 60000, refresh = false) {
 const cached = cache.get(path); if(!refresh && cached?.until > Date.now()) return cached.data;
 if(pending.has(path))return pending.get(path);
 const start=Math.max(Date.now(),nextRequest);nextRequest=start+260;
 const task=(async()=>{
  if(start>Date.now())await new Promise(resolve=>setTimeout(resolve,start-Date.now()));
  const response=await fetch(BASE+path,{headers:{'User-Agent':'AnimeLocal/0.2 (https://github.com/DiegoLopez0208/anime-local)'},signal:AbortSignal.timeout(20000)});
  if(response.status===429)throw Error('La consulta necesita una pausa. Intenta nuevamente en un minuto.');
  if(!response.ok)throw Error('La consulta respondió HTTP '+response.status+'.');
  const data=await response.json();if(data.result!=='ok')throw Error('No se pudo completar la consulta.');
  while(cache.size>=100)cache.delete(cache.keys().next().value);
  cache.set(path,{data,until:Date.now()+ttl});return data;
 })().finally(()=>pending.delete(path));
 pending.set(path,task);return task;
}
const text = (values) => values?.es || values?.['es-la'] || values?.en || Object.values(values||{})[0] || '';
export function mangaItem(row) {
 const a=row.attributes||{}, cover=row.relationships?.find(item=>item.type==='cover_art')?.attributes?.fileName;
 const id=uuid(row.id);
 return {id,path:'/manga/'+id,title:text(a.title),synopsis:text(a.description),status:a.status,malId:/^\d+$/.test(a.links?.mal||'')?Number(a.links.mal):null,
 type:({ja:'Manga',ko:'Manhwa',zh:'Manhua'})[a.originalLanguage]||'Cómic',
 image:cover&&/^[\w.-]+$/.test(cover)?'/manga-cover/'+id+'/'+cover+'.256.jpg':null,
 tags:(a.tags||[]).map(tag=>text(tag.attributes?.name)),languages:a.availableTranslatedLanguages||[]};
}
export function coverSource(id, filename) {
 id=uuid(id);
 if(typeof filename!=='string'||!/^[a-f0-9-]{36}\.(jpg|jpeg|png|webp)\.256\.jpg$/i.test(filename))throw Error('Portada no válida.');
 return 'https://uploads.mangadex.org/covers/'+id+'/'+filename;
}
export async function coverImage(id, filename) {
 const response=await fetch(coverSource(id,filename),{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('La portada no está disponible.');
 const type=response.headers.get('content-type');
 if(!['image/jpeg','image/png','image/webp'].includes(type))throw Error('El proveedor no entregó una portada.');
 const chunks=[];let size=0;
 for await(const chunk of response.body){size+=chunk.length;if(size>4*1024*1024)throw Error('Portada demasiado grande.');chunks.push(Buffer.from(chunk));}
 return {type,data:Buffer.concat(chunks,size)};
}
export async function search(input={}) {
 const lang=language(input.language),params=new URLSearchParams({limit:'24',offset:String(offsetValue(input.offset)),'includes[]':'cover_art','contentRating[]':'safe',hasAvailableChapters:'true'});
 for(const code of languageCodes(lang))params.append('availableTranslatedLanguage[]',code);
 if(input.q)params.set('title',String(input.q).trim().slice(0,120));
 if(['ja','ko','zh'].includes(input.type))params.set('originalLanguage[]',input.type);
 params.set('order[followedCount]','desc');
 const result=await request('/manga?'+params);
 const checked=new Array(result.data.length);let cursor=0;
 // Check the feed, not historical translation metadata. Limit concurrent lookups.
 await Promise.all(Array.from({length:Math.min(3,result.data.length)},async()=>{
  while(cursor<result.data.length){const i=cursor++,row=result.data[i];const feed=await chapterFeed(uuid(row.id),lang,0,1);checked[i]=feed.data.some(readable)?{...mangaItem(row),chapterCount:feed.total}:null;}
 }));
 return {items:checked.filter(Boolean),total:result.total,offset:result.offset,limit:result.limit,language:lang};
}
const readable=row=>row.attributes.pages>0&&!row.attributes.externalUrl&&!row.attributes.isUnavailable;
async function chapterFeed(id,lang,offset=0,limit=100){
 const params=new URLSearchParams({limit:String(limit),offset:String(offset),includeEmptyPages:'0',includeExternalUrl:'0',includeUnavailable:'0','order[chapter]':'asc','order[volume]':'asc'});
 for(const code of languageCodes(lang))params.append('translatedLanguage[]',code);
 return request('/manga/'+id+'/feed?'+params,300000);
}
export async function detail(input) {
 const id=uuid(input.id), lang=language(input.language), offset=offsetValue(input.offset);
 // Metadata and chapter feed share the same public API; issue sequentially.
 const row=await request('/manga/'+id+'?includes[]=cover_art');
 const info=mangaItem(row.data);
 if(row.data.attributes.contentRating!=='safe')throw Error('Este catálogo solo incluye obras con clasificación safe.');
 const feed=await chapterFeed(id,lang,offset);
 const alternatives=[];
 if(feed.total===0&&offset===0){const other=lang==='es'?'en':'es',available=await chapterFeed(id,other,0,1);if(available.data.some(readable))alternatives.push({language:other,total:available.total});}
 return {...info,language:lang,total:feed.total,offset,limit:100,alternatives,chapters:feed.data.filter(readable).map(row=>({
  id:row.id,path:'/leer/'+row.id,number:row.attributes.chapter,title:row.attributes.title,
  pages:row.attributes.pages,externalUrl:row.attributes.externalUrl,language:row.attributes.translatedLanguage,
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
 if(row.data.attributes.isUnavailable||!row.data.attributes.pages)throw Error('Este capítulo ya no está disponible. Vuelve a la lista para elegir otro.');
 if(row.data.attributes.externalUrl)throw Error('Este capítulo no está disponible aquí.');
 const result=await request('/at-home/server/'+id+'?forcePort443=true',30000,input.refresh===true);
 return {id,manga:mangaItem(manga.data),number:row.data.attributes.chapter,title:row.data.attributes.title,language:row.data.attributes.translatedLanguage,pages:pageUrls(result)};
}
export async function pageImage(id, page) {
 id=uuid(id);page=Number(page);
 if(!Number.isSafeInteger(page)||page<0||page>=1000)throw Error('Página no válida.');
 let info=await chapter({id});
 for(let attempt=0;attempt<2;attempt++){
  const url=info.pages[page];if(!url)throw Error('Página fuera del capítulo.');
  const started=Date.now();let bytes=0,cached=false,data,type,error;
  try {
   const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
   cached=response.headers.get('x-cache')?.startsWith('HIT')||false;
   const chunks=[];
   for await(const chunk of response.body){bytes+=chunk.length;if(bytes>4*1024*1024)throw Error('Imagen demasiado grande.');chunks.push(Buffer.from(chunk));}
   if(!response.ok)throw Error('El servidor de imágenes respondió HTTP '+response.status+'.');
   type=response.headers.get('content-type');if(!type?.startsWith('image/'))throw Error('El servidor no entregó una imagen.');
   data=Buffer.concat(chunks,bytes);
  } catch(caught){error=caught;}
  if(new URL(url).hostname.endsWith('.mangadex.network')){
   try{await fetch('https://api.mangadex.network/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,success:!error,bytes,duration:Date.now()-started,cached}),signal:AbortSignal.timeout(2000)}).then(r=>r.body?.cancel());}catch{}
  }
  if(!error)return {data,type};
  if(attempt===1)throw error;
  info=await chapter({id,refresh:true});
 }
}
