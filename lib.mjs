import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { File } from 'megajs';
const nodeStreamApis = new WeakSet();

export function parseEpisode(html) {
  const match = html.match(/\bvar\s+videos\s*=\s*(\[[^;]*\])\s*;/);
  if (!match) throw new Error('TioAnime no publico la lista de servidores en el HTML.');
  const rows = JSON.parse(match[1]);
  return rows.filter(row => Array.isArray(row) && typeof row[1] === 'string')
    .map(([name, url]) => ({ name, url }))
    .filter(({ url }) => {
      try { return ['www.yourupload.com', 'yourupload.com', 'mega.nz'].includes(new URL(url).hostname); }
      catch { return false; }
    });
}

export function normalizeMega(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'mega.nz') throw new Error('Enlace MEGA no valido.');
  const legacy = parsed.pathname.match(/^\/embed\/!([^!]+)!([^/]+)$/);
  if (/^\/embed\/[\w-]+$/.test(parsed.pathname) && /^#[\w-]+$/.test(parsed.hash)) return 'https://mega.nz/file/' + parsed.pathname.split('/')[2] + parsed.hash;
  return legacy ? 'https://mega.nz/file/' + legacy[1] + '#' + legacy[2] : parsed.href;
}

export function parseRange(header, size) {
  if (!header) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) throw new Error('Rango no valido');
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) throw new Error('Rango no valido');
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start)
    throw new Error('Rango fuera del archivo');
  return { start, end, partial: true };
}

export async function getText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error('HTTP ' + response.status + ' al consultar la pagina.');
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error('La pagina es demasiado grande.');
  return text;
}

export async function resolveYourUpload(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !['www.yourupload.com', 'yourupload.com'].includes(parsed.hostname))
    throw new Error('Enlace YourUpload no valido.');
  const html = await getText(url);
  const match = html.match(/file:\s*['"](?<url>https:\/\/[^'"]+)['"]/);
  if (!match) throw new Error('No se encontro el MP4 en YourUpload.');
  return { url: match.groups.url.replaceAll('&amp;', '&'), referrer: url };
}

export async function withTimeout(promise, ms = 30000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('El proveedor no respondio a tiempo.')), ms);
    })]);
  } finally { clearTimeout(timer); }
}

export async function resolveMega(url) {
  const file = File.fromURL(normalizeMega(url));
  // MEGAJS's Web-stream reader leaves an unhandled promise on cancellation.
  // Give its single-connection download a Node stream with error propagation.
  if (!nodeStreamApis.has(file.api)) {
  nodeStreamApis.add(file.api);
  const originalFetch = file.api.fetch.bind(file.api);
  file.api.fetch = async (url, options) => {
    const response = await originalFetch(url, options);
    if (!/\/\d+-\d+$/.test(new URL(url).pathname) || !response.body || typeof response.body.pipe === 'function') return response;
    const body = Readable.fromWeb(response.body);
    body.on('error', () => {});
    const originalPipe = body.pipe.bind(body);
    body.pipe = (destination, ...args) => {
      body.once('error', error => destination.destroy(error));
      destination.once('close', () => body.destroy());
      return originalPipe(destination, ...args);
    };
    return new Proxy(response, { get(target, key) {
      if (key === 'body') return body;
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
  };
  }
  await withTimeout(file.loadAttributes());
  if (file.directory || !Number.isSafeInteger(file.size) || file.size <= 0)
    throw new Error('MEGA no devolvio un archivo de video valido.');
  if (!/\.(mp4|mkv|webm|avi|mov)$/i.test(file.name || ''))
    throw new Error('El archivo MEGA no tiene una extension de video compatible.');
  return file;
}

export function megaStream(file, start, end) {
  return file.download({ start, end: Math.max(1, end), maxConnections: 1, forceHttps: true });
}

export async function probeYourUpload(video) {
  const response = await fetch(video.url, {
    headers: { Referer: video.referrer, Range: 'bytes=0-4095' },
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok || !response.body) throw new Error('El servidor de video devolvio HTTP ' + response.status);
  const reader = response.body.getReader();
  let total = 0, first = Buffer.alloc(0);
  try {
    while (total < 4096) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!first.length) first = Buffer.from(value).subarray(0, 32);
      total += value.length;
    }
  } finally { await reader.cancel(); }
  if (first.subarray(4, 8).toString() !== 'ftyp') throw new Error('La respuesta no tiene la cabecera de un MP4.');
  return { status: response.status, bytesRead: total, contentType: response.headers.get('content-type') };
}

export async function createMegaBridge(file) {
  const token = randomBytes(24).toString('hex');
  const route = '/' + token + '/video';
  const streams = new Set();
  const server = createServer(async (req, res) => {
    if (req.url !== route) { res.writeHead(404).end(); return; }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    let range;
    try { range = parseRange(req.headers.range, file.size); }
    catch { res.writeHead(416, { 'Content-Range': 'bytes */' + file.size }).end(); return; }
    const { start, end, partial } = range;
    const length = end - start + 1;
    const headers = {
      'Content-Type': /\.webm$/i.test(file.name) ? 'video/webm' : /\.mkv$/i.test(file.name) ? 'video/x-matroska' : 'video/mp4',
      'Content-Length': length, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store'
    };
    if (partial) headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + file.size;
    if (req.method === 'HEAD') { res.writeHead(partial ? 206 : 200, headers).end(); return; }
    const stream = megaStream(file, start, end);
    streams.add(stream);
    const stop = () => stream.destroy();
    res.once('close', stop);
    let remaining = length;
    const limiter = new Transform({ transform(chunk, _, callback) {
      const piece = chunk.subarray(0, remaining);
      remaining -= piece.length;
      callback(null, piece);
    } });
    try {
      // Delay headers until MEGA supplies data, so quota/errors can return HTTP 502.
      const iterator = stream[Symbol.asyncIterator]();
      const initial = await withTimeout(iterator.next());
      if (initial.done || res.destroyed) { if (!res.destroyed) res.writeHead(502).end(); return; }
      res.writeHead(partial ? 206 : 200, headers);
      await pipeline((async function* () {
        yield initial.value;
        while (true) { const next = await iterator.next(); if (next.done) return; yield next.value; }
      })(), limiter, res);
    } catch (error) {
      if (!res.headersSent && !res.destroyed) res.writeHead(502).end('MEGA no pudo entregar el video.');
      else res.destroy();
      if (!stream.destroyed) console.error('MEGA:', error.message);
    } finally { stream.destroy(); streams.delete(stream); res.removeListener('close', stop); }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject); server.listen(0, '127.0.0.1', resolve);
  });
  return {
    url: 'http://127.0.0.1:' + server.address().port + route,
    close: async () => { for (const stream of streams) stream.destroy(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  };
}
