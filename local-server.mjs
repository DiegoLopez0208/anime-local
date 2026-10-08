import * as ratings from './ratings.mjs';
import * as manga from './manga.mjs';
import { inspect } from './sources.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getText, parseEpisode, resolveYourUpload, resolveMega, createMegaBridge, parseRange } from './lib.mjs';
import { openVlc } from './player.mjs';
import * as catalog from './catalog.mjs';

const port = Number(process.env.PORT || 5189);
const origin = 'http://127.0.0.1:' + port;
const secret = randomBytes(24).toString('hex');
const sessions = new Map();
const html = (await readFile(new URL('./web.html', import.meta.url), 'utf8')).replaceAll('__API_TOKEN__', secret);
const catalogHtml = (await readFile(new URL('./catalog.html', import.meta.url), 'utf8')).replaceAll('__API_TOKEN__', secret);
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify(value)); };
async function body(req) {
  let input = '';
  for await (const chunk of req) { input += chunk; if (input.length > 4096) throw new Error('Solicitud demasiado grande.'); }
  return JSON.parse(input);
}
async function remove(id) {
  const session = sessions.get(id); sessions.delete(id);
  if (session?.bridge) await session.bridge.close();
}
const cleanup = setInterval(() => {
  for (const [id, session] of sessions) if (Date.now() - session.created > 2 * 60 * 60 * 1000) remove(id).catch(console.error);
}, 60000);
cleanup.unref();
const server = createServer(async (req, res) => {
  try {
    if (req.headers.host !== '127.0.0.1:' + port) { res.writeHead(403).end(); return; }
    const path = new URL(req.url, origin).pathname;
    if (req.method === 'GET' && ['/profiles.mjs','/manga-ui.mjs','/ratings-ui.mjs','/previews.mjs'].includes(path)) {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' }).end(await readFile(new URL('.'+path, import.meta.url), 'utf8')); return;
    }
    if (req.method === 'GET' && path === '/favicon.ico') { res.writeHead(204).end(); return; }
    if (req.method === 'GET' && ['/','/reproductor'].includes(path)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
        'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: blob: https://uploads.mangadex.org https://*.mangadex.network; connect-src 'self'; media-src 'self' http://127.0.0.1:*; base-uri 'none'; frame-ancestors 'none'; form-action 'none'" }).end(path === '/reproductor' ? html : catalogHtml); return;
    }
    if (req.method === 'GET' && path.startsWith('/image/')) {
      const image = path.slice('/image'.length);
      if (catalog.imagePath(image) !== path) { res.writeHead(404).end(); return; }
      const response = await fetch('https://tioanime.com' + image, { signal: AbortSignal.timeout(15000) });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': response.headers.get('content-type'), 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
      await pipeline(Readable.fromWeb(response.body), res); return;
    }
    const coverMatch=/^\/manga-cover\/([a-f0-9-]{36})\/([^/]+)$/.exec(path);
    if(coverMatch&&req.method==='GET'){const image=await manga.coverImage(coverMatch[1],coverMatch[2]);res.writeHead(200,{'Content-Type':image.type,'Content-Length':image.data.length,'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}).end(image.data);return;}
    const mangaMatch=/^\/manga-page\/([a-f0-9-]{36})\/(\d+)$/.exec(path);
    if(mangaMatch&&req.method==='GET'){const image=await manga.pageImage(mangaMatch[1],mangaMatch[2]);res.writeHead(200,{'Content-Type':image.type,'Content-Length':image.data.length,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}).end(image.data);return;}
    const streamMatch = /^\/(?:video|preview-video)\/([a-f0-9]{48})$/.exec(path);
    if (streamMatch && ['GET', 'HEAD'].includes(req.method)) {
      const session = sessions.get(streamMatch[1]);
      if (!session?.video) { res.writeHead(404).end(); return; }
      let requestedRange=req.headers.range;
      if(session.preview){
        if(!session.size){const info=await fetch(session.video.url,{headers:{Referer:session.video.referrer,Range:'bytes=0-0'},signal:AbortSignal.timeout(15000)});session.size=Number(info.headers.get('content-range')?.split('/')[1]);await info.body?.cancel();if(!Number.isSafeInteger(session.size)||session.size<1)throw Error('No se pudo preparar la vista previa.');}
        let range;try{range=parseRange(requestedRange||'bytes=0-',session.size);}catch{res.writeHead(416,{'Content-Range':'bytes */'+session.size}).end();return;}
        requestedRange='bytes='+range.start+'-'+Math.min(range.end,range.start+512*1024-1);
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      res.once('close', () => controller.abort());
      let upstream;
      try {
        upstream = await fetch(session.video.url, {
          method: req.method, headers: { Referer: session.video.referrer, ...(requestedRange ? { Range: requestedRange } : {}) },
          signal: controller.signal
        });
      } finally { clearTimeout(timer); }
      const headers = { 'Cache-Control': 'no-store' };
      for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges'])
        if (upstream.headers.has(name)) headers[name] = upstream.headers.get(name);
      res.writeHead(upstream.status, headers);
      if (req.method === 'HEAD' || !upstream.body) { res.end(); return; }
      await pipeline(Readable.fromWeb(upstream.body), res); return;
    }
    if (req.method !== 'POST' || !path.startsWith('/api/')) { res.writeHead(404).end(); return; }
    if (req.headers['x-local-token'] !== secret || (req.headers.origin && req.headers.origin !== origin)) {
      json(res, 403, { error: 'Solicitud no autorizada.' }); return;
    }
    const input = await body(req);
    if (path === '/api/catalog/home') { json(res, 200, await catalog.home()); return; }
    if (path === '/api/catalog/directory') { json(res, 200, await catalog.directory(input)); return; }
    if (path === '/api/catalog/anime') { json(res, 200, await catalog.anime(input.path)); return; }
    if (path === '/api/catalog/episode') { json(res, 200, await catalog.episode(input.path)); return; }
    if (path === '/api/episode') { json(res, 200, await inspect(input.url)); return; }
    if (path === '/api/ratings/lookup') {json(res,200,await ratings.lookup(input));return;}
    if (path === '/api/ratings/detail') {json(res,200,await ratings.detail(input));return;}
    if (path === '/api/ratings/ranking') {json(res,200,await ratings.ranking(input));return;}
    if (path === '/api/manga/search') { json(res, 200, await manga.search(input)); return; }
    if (path === '/api/manga/detail') { json(res, 200, await manga.detail(input)); return; }
    if (path === '/api/manga/chapter') { json(res, 200, await manga.chapter(input)); return; }
    if (path === '/api/play') {
      const url = new URL(input.url);
      if(input.preview&&url.hostname==='mega.nz')throw Error('Las vistas previas usan YourUpload.');
      let session;
      if (url.hostname === 'mega.nz') {
        const file = await resolveMega(url.href);
        session = { bridge: await createMegaBridge(file), name: file.name };
      } else {
        session = { video: await resolveYourUpload(url.href), name: 'YourUpload' };
      }
      while (sessions.size >= 8) await remove(sessions.keys().next().value);
      const id = randomBytes(24).toString('hex');
      session.created = Date.now();session.preview=input.preview===true;sessions.set(id, session);
      json(res, 200, { id, name: session.name, src: session.bridge?.url || (session.preview?'/preview-video/':'/video/') + id }); return;
    }
    if (path === '/api/vlc') {
      const session = sessions.get(input.id);
      if (!session) throw new Error('La sesion vencio. Vuelve a cargar el video.');
      const child = openVlc(session.bridge?.url || session.video.url, session.video?.referrer);
      await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
      child.unref(); json(res, 200, { ok: true }); return;
    }
    if (path === '/api/close') { await remove(input.id); json(res, 200, { ok: true }); return; }
    json(res, 404, { error: 'Ruta desconocida.' });
  } catch (error) {
    if (res.destroyed) return;
    console.error(error.message);
    if (!res.headersSent && !res.destroyed) json(res, 502, { error: error.message });
    else res.destroy();
  }
});
server.listen(port, '127.0.0.1', () => console.log('Reproductor local: ' + origin));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
async function shutdown() { for (const id of sessions.keys()) await remove(id); server.closeAllConnections(); server.close(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
