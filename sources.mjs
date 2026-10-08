import { load } from 'cheerio';
import { getText, parseEpisode, normalizeMega } from './lib.mjs';

export function sourceUrl(value) {
 const url = new URL(value);
 if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) throw Error('Enlace de episodio no válido.');
 if (url.hostname === 'tioanime.com' && /^\/ver\/[a-zA-Z0-9_-]+$/.test(url.pathname)) return url;
 if (url.hostname === 'jkanime.net' && /^\/[a-zA-Z0-9_-]+\/\d+(?:\.\d+)?\/$/.test(url.pathname)) return url;
 throw Error('Pega un episodio de TioAnime o JKAnime.');
}
export function parseJk(html) {
 const match = html.match(/\bvar\s+servers\s*=\s*(\[[^;]*\])\s*;/);
 if (!match) throw Error('JKAnime no publicó la lista de servidores en el HTML.');
 const available = JSON.parse(match[1]).map(row => {
  try {
   const url = new URL(Buffer.from(row.remote, 'base64').toString('utf8').trim());
   if (url.protocol !== 'https:' || url.username || url.password) return null;
   const compatible = ['mega.nz', 'yourupload.com', 'www.yourupload.com'].includes(url.hostname);
   return { name: String(row.server), url: url.hostname === 'mega.nz' ? normalizeMega(url.href) : url.href, compatible };
  } catch { return null; }
 }).filter(Boolean);
 return { title: load(html)('h1').first().text().trim(), available, servers: available.filter(row => row.compatible) };
}
export async function inspect(value) {
 const url = sourceUrl(value);let html;
 try { html = await getText(url.href); } catch(error) {
  if(url.hostname==='jkanime.net' && error.message.includes('HTTP 403'))throw Error('JKAnime rechazó la consulta desde este servidor (HTTP 403). Prueba la versión local: npx @diegolopez02081/anime-local.');
  throw error;
 }
 if (url.hostname === 'jkanime.net') return { source: 'JKAnime', ...parseJk(html) };
 const servers = parseEpisode(html);
 return { source: 'TioAnime', servers, available: servers.map(row => ({...row, compatible:true})) };
}
