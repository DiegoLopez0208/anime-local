import * as ratings from '../ratings.mjs';
import * as manga from '../manga.mjs';
import { inspect } from '../sources.mjs';
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import * as catalog from '../catalog.mjs';
import { resolveYourUpload, resolveMega, parseRange, megaStream, withTimeout } from '../lib.mjs';
const MAX = 4 * 1024 * 1024;
const files = new Map();
const send = (res, status, value) => { res.statusCode = status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store'); res.end(JSON.stringify(value)); };
function validateSource(value) {
 const url = new URL(value);
 if (url.protocol !== 'https:' || url.username || url.password) throw Error('Fuente no válida.');
 if (['www.yourupload.com','yourupload.com'].includes(url.hostname) && /^\/embed\/[a-zA-Z0-9]+$/.test(url.pathname)) return url.href;
 if (url.hostname === 'mega.nz' && (/^\/embed\/![\w-]+![\w-]+$/.test(url.pathname) || /^\/file\/[\w-]+$/.test(url.pathname) && /^#[\w-]+$/.test(url.hash))) return url.href;
 throw Error('Servidor no compatible.');
}
async function sourceFile(url) {
 const entry=files.get(url);if(entry&&entry.until>Date.now())return entry.file;
 const file=await resolveMega(url);while(files.size>=32)files.delete(files.keys().next().value);
 files.set(url,{file,until:Date.now()+600000});return file;
}
async function collect(stream, length) {
 const chunks=[];let total=0;
 try { await withTimeout((async()=>{for await(const chunk of stream){const piece=chunk.subarray(0,length-total);total+=piece.length;chunks.push(piece);if(total===length)break;}})(),45000); }
 finally { stream.destroy(); }
 if(total!==length)throw Error('El proveedor entregó una respuesta incompleta.');
 return Buffer.concat(chunks,total);
}
async function media(req,res,source,preview=false) {
 const url=validateSource(source);let size,file,video;
 if(preview&&new URL(url).hostname==='mega.nz')throw Error('Las vistas previas usan YourUpload.');
 if(new URL(url).hostname==='mega.nz'){file=await sourceFile(url);size=file.size;}
 else{
  video=await resolveYourUpload(url);
  const info=await fetch(video.url,{headers:{Referer:video.referrer,Range:'bytes=0-0'},signal:AbortSignal.timeout(20000)});
  const contentRange=info.headers.get('content-range');size=Number(contentRange?.split('/')[1]);await info.body?.cancel();
  if(!info.ok||!Number.isSafeInteger(size)||size<=0)throw Error('El proveedor no informó el tamaño del MP4.');
 }
 let range;try{range=parseRange(req.headers.range||'bytes=0-',size);}catch{res.writeHead(416,{'Content-Range':'bytes */'+size}).end();return;}
 const start=range.start,end=Math.min(range.end,start+(preview?512*1024:MAX)-1),length=end-start+1;
 const headers={'Content-Type':'video/mp4','Content-Length':length,'Content-Range':'bytes '+start+'-'+end+'/'+size,'Accept-Ranges':'bytes','Cache-Control':'no-store'};
 if(req.method==='HEAD'){res.writeHead(206,headers).end();return;}
 let data;
 if(file)data=await collect(megaStream(file,start,end),length);
 else{
  const response=await fetch(video.url,{headers:{Referer:video.referrer,Range:'bytes='+start+'-'+end},signal:AbortSignal.timeout(45000)});
  if(response.status!==206){await response.body?.cancel();throw Error('El servidor no admite el rango solicitado.');}
  const chunks=[];let total=0;
  try{for await(const chunk of response.body){total+=chunk.length;if(total>length)throw Error('Respuesta de video demasiado grande.');chunks.push(Buffer.from(chunk));}}
  finally{if(response.body&&!response.body.locked)await response.body.cancel().catch(()=>{});}
  if(total!==length)throw Error('Respuesta de video incompleta.');data=Buffer.concat(chunks,total);
 }
 res.writeHead(206,headers).end(data);
}
export default async function handler(req,res) {
 try{
  const query=new URL(req.url,'https://localhost').searchParams;
  const route=req.query?.route||query.get('route')||'home';
  const action=req.query?.action||query.get('action')||'';
  if(route==='license'){
   res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=3600'}).end(await readFile(new URL('../LICENSE',import.meta.url),'utf8'));return;
  }
  if(['home','manual','profiles','manga-ui','ratings-ui','previews','reader-cache'].includes(route)){
   const filename=['ratings-ui','previews','reader-cache'].includes(route)?route+'.mjs':route==='manga-ui'?'manga-ui.mjs':route==='profiles'?'profiles.mjs':route==='manual'?'web.html':'catalog.html';
   const html=(await readFile(new URL('../'+filename,import.meta.url),'utf8')).replaceAll('__API_TOKEN__','cloud');
   res.setHeader('Content-Type',['profiles','manga-ui','ratings-ui','previews','reader-cache'].includes(route)?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
   res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
   if(!['profiles','manga-ui','ratings-ui','previews','reader-cache'].includes(route))res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: blob: https://uploads.mangadex.org https://*.mangadex.network; connect-src 'self'; media-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
   res.end(html);return;
  }
  if(route==='image'){
   const path='/'+(req.query?.path||query.get('path')||'');
   if(catalog.imagePath(path)!=='/image'+path){res.writeHead(404).end();return;}
   const response=await fetch('https://tioanime.com'+path,{signal:AbortSignal.timeout(20000)});
   if(!response.ok||!response.headers.get('content-type')?.startsWith('image/')){res.writeHead(404).end();return;}
   const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>MAX)throw Error('Imagen demasiado grande.');
   res.writeHead(200,{'Content-Type':response.headers.get('content-type'),'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}).end(bytes);return;
  }
  if(route==='manga-cover'){
   if(req.method!=='GET'){res.writeHead(405).end();return;}
   const image=await manga.coverImage(req.query?.id||query.get('id'),req.query?.file||query.get('file'));
   res.writeHead(200,{'Content-Type':image.type,'Content-Length':image.data.length,'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}).end(image.data);return;
  }
  if(route==='manga-image'){
   if(req.method!=='GET'){res.writeHead(405).end();return;}
   const image=await manga.pageImage(req.query?.id||query.get('id'),req.query?.page||query.get('page'));
   res.writeHead(200,{'Content-Type':image.type,'Content-Length':image.data.length,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}).end(image.data);return;
  }
  if(['video','preview-video'].includes(route)){
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
   const id=req.query?.id||query.get('id');if(!id||id.length>1200)throw Error('Fuente no válida.');
   await media(req,res,Buffer.from(id,'base64url').toString('utf8'),route==='preview-video');return;
  }
  if(route!=='api'||req.method!=='POST'){res.writeHead(404).end();return;}
  if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){send(res,403,{error:'Origen no autorizado.'});return;}
  if(req.headers['x-local-token']!=='cloud'){send(res,403,{error:'Solicitud no autorizada.'});return;}
  let input=req.body;
  if(typeof input==='string')input=JSON.parse(input);
  if(!input){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)throw Error('Solicitud demasiado grande.');}input=JSON.parse(raw||'{}');}
  if(action==='catalog/home'){send(res,200,await catalog.home());return;}
  if(action==='catalog/directory'){send(res,200,await catalog.directory(input));return;}
  if(action==='catalog/anime'){send(res,200,await catalog.anime(input.path));return;}
  if(action==='catalog/episode'){send(res,200,await catalog.episode(input.path));return;}
  if(action==='episode'){send(res,200,await inspect(input.url));return;}
  if(action==='ratings/lookup'){send(res,200,await ratings.lookup(input));return;}
  if(action==='ratings/detail'){send(res,200,await ratings.detail(input));return;}
  if(action==='ratings/ranking'){send(res,200,await ratings.ranking(input));return;}
  if(action==='manga/search'){send(res,200,await manga.search(input));return;}
  if(action==='manga/detail'){send(res,200,await manga.detail(input));return;}
  if(action==='manga/chapter'){send(res,200,await manga.chapter(input));return;}
  if(action==='play'){
   const source=validateSource(input.url);const id=Buffer.from(source).toString('base64url');
   if(input.preview&&new URL(source).hostname==='mega.nz')throw Error('Las vistas previas usan YourUpload.');
   const name=new URL(source).hostname==='mega.nz'?(await sourceFile(source)).name:'YourUpload';
   send(res,200,{id,name,src:(input.preview?'/preview-video/':'/video/')+id});return;
  }
  if(action==='close'){send(res,200,{ok:true});return;}
  if(action==='vlc'){send(res,501,{error:'Abrir VLC está disponible al ejecutar la versión local de npm.'});return;}
  send(res,404,{error:'Ruta no encontrada.'});
 }catch(error){if(!res.headersSent)send(res,502,{error:error.message});else res.destroy();}
}
