import { load } from 'cheerio';
const BASE='https://myanimelist.net', cache=new Map(), pending=new Map();let nextRequest=0;
const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
const normalize=value=>clean(value).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function kind(value){if(!['anime','manga'].includes(value))throw Error('Tipo de puntuación no válido.');return value;}
export function malId(value){const id=Number(value);if(!Number.isSafeInteger(id)||id<1||id>10000000)throw Error('Identificador MAL no válido.');return id;}
function link(value,type){try{const u=new URL(value,BASE);const m=new RegExp('^/'+type+'/(\\d+)(?:/[^/]+)?/?$').exec(u.pathname);return u.origin===BASE&&m?malId(m[1]):null;}catch{return null;}}
async function html(path){
 const hit=cache.get(path);if(hit?.until>Date.now())return hit.html;if(pending.has(path))return pending.get(path);
 const now=Date.now(),start=Math.max(now,nextRequest);if(start-now>5000)throw Error('Las puntuaciones están ocupadas. Intenta nuevamente en unos segundos.');nextRequest=start+1100;
 const task=(async()=>{if(start>now)await new Promise(r=>setTimeout(r,start-now));const response=await fetch(BASE+path,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('MyAnimeList respondió HTTP '+response.status+'.');const text=await response.text();if(text.length>1500000)throw Error('Respuesta demasiado grande.');while(cache.size>=120)cache.delete(cache.keys().next().value);cache.set(path,{html:text,until:Date.now()+6*3600000});return text;})().finally(()=>pending.delete(path));pending.set(path,task);return task;
}
export function parseScore(html,type,id){
 kind(type);id=malId(id);const $=load(html);
 const raw=$('[itemprop=ratingValue]').first().text().trim(),score=raw&&raw!=='N/A'?Number(raw):null;
 if(score!==null&&(!Number.isFinite(score)||score<0||score>10))throw Error('Puntuación MAL no válida.');
 if(!$('[itemprop=ratingValue]').length&&!$('[itemprop=name]').length)throw Error('MyAnimeList no entregó una ficha válida.');
 const title=clean($('h1 .title-name').text()||$('h1 span[itemprop=name]').first().text()||$('h1 strong').first().text()||$('meta[property="og:title"]').attr('content'));
 const votes=Number($('[itemprop=ratingCount]').first().text().replace(/[^\d]/g,''))||0;
 return {id,kind:type,title,score,votes,url:BASE+'/'+type+'/'+id,fetchedAt:new Date().toISOString()};
}
export function parseSearch(html,type){
 kind(type);const $=load(html), rows=[], seen=new Set();
 $('a.hoverinfo_trigger').each((_,e)=>{const a=$(e),id=link(a.attr('href'),type),title=clean(a.find('strong').text()||a.text());if(!id||!title||seen.has(id))return;seen.add(id);rows.push({id,title});});
 return rows.slice(0,6);
}
export function exactMatch(rows,title){const exact=rows.filter(row=>normalize(row.title)===normalize(title));return exact.length===1?exact[0].id:null;}
export async function detail(input){const type=kind(input.kind),id=malId(input.id);return parseScore(await html('/'+type+'/'+id),type,id);}
export async function lookup(input){
 const type=kind(input.kind);
 if(input.id)return {matches:[],match:await detail({kind:type,id:input.id})};
 const title=clean(input.title).slice(0,120);if(title.length<2)throw Error('Escribe un título para buscar en MAL.');
 const params=new URLSearchParams({q:title,cat:type});
 const matches=parseSearch(await html('/'+type+'.php?'+params),type),id=exactMatch(matches,title);
 return {matches,match:id?await detail({kind:type,id}):null};
}
export function parseRanking(html,type){
 kind(type);const $=load(html),items=[];
 $('tr.ranking-list').each((_,e)=>{const row=$(e),a=row.find('h3 a').first(),id=link(a.attr('href'),type),score=Number(row.find('td.score .score-label').first().text());if(!id||!Number.isFinite(score)||score<=0||score>10)return;items.push({id,title:clean(a.text()),score,rank:Number(row.find('td.rank').text().trim()),info:clean(row.find('.information').text()),kind:type,url:BASE+'/'+type+'/'+id});});
 if(!items.length)throw Error('No se pudo leer el ranking de MyAnimeList.');
 return {items:items.slice(0,25),fetchedAt:new Date().toISOString()};
}
export async function ranking(input){const type=kind(input.kind||'anime');return parseRanking(await html('/top'+type+'.php'),type);}
