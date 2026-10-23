// Proveedores que se resuelven a un archivo de video propio (sin anuncios del reproductor ajeno).
const DIRECT = ['mega.nz', 'yourupload.com', 'mp4upload.com'];
// Proveedores que solo se pueden mostrar con su propio reproductor incrustado.
const EMBED = ['ok.ru', 'voe.sx', 'vgfplay.com', 'vidguard.to', 'listeamed.net', 'hqq.tv', 'netu.tv', 'waaw.to',
  'streamwish.to', 'awish.pro', 'wishembed.pro', 'filemoon.sx', 'filemoon.to', 'byselapuix.com', 'uns.bio',
  'streamtape.com', 'mixdrop.ag', 'mixdrop.co', 'uqload.io', 'vidhidepro.com', 'dood.wf', 'doodstream.com'];
const hostIn = (host, list) => list.some(item => host === item || host.endsWith('.' + item));

export function classify(name, value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const label = String(name || url.hostname).slice(0, 40);
  // Sus segmentos HLS exigen la verificación de Cloudflare, así que solo sirve su reproductor.
  if (url.hostname === 'player.zilla-networks.com')
    return /^\/play\/[a-f0-9]{32}$/.test(url.pathname) ? { name: label, url: url.href, mode: 'embed' } : null;
  if (hostIn(url.hostname, DIRECT)) {
    if (url.hostname.endsWith('mp4upload.com')) {
      // Solo las páginas de reproductor incrustado se pueden resolver a un MP4.
      const id = /^\/(?:embed-)?([a-z0-9]{8,16})(?:\.html)?$/.exec(url.pathname)?.[1];
      return id ? { name: label, url: 'https://www.mp4upload.com/embed-' + id + '.html', mode: 'direct' } : null;
    }
    return { name: label, url: url.href, mode: 'direct' };
  }
  if (hostIn(url.hostname, EMBED)) return { name: label, url: url.href, mode: 'embed' };
  return null;
}
export function classifyAll(rows) {
  const seen = new Set(), result = [];
  for (const row of rows) {
    const item = classify(row.name, row.url);
    if (!item || seen.has(item.url)) continue;
    seen.add(item.url); result.push({ ...item, ...(row.tag ? { tag: row.tag } : {}), ...(row.source ? { source: row.source } : {}) });
  }
  // MEGA corta por cuota de descarga, así que va después de los MP4 directos.
  const rank = item => item.mode === 'embed' ? 2 : item.url.includes('mega.nz') ? 1 : 0;
  return result.sort((a, b) => rank(a) - rank(b));
}
