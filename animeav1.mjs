import { load } from 'cheerio';
import { getText } from './lib.mjs';

const BASE = 'https://animeav1.com';
const slugs = new Map();
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const normalize = value => clean(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const TAGS = { SUB: 'Sub', DUB: 'Latino' };

export function parseSearch(html) {
  const $ = load(html), rows = [], seen = new Set();
  $('a[href^="/media/"]').each((_, element) => {
    const link = $(element), slug = /^\/media\/([a-z0-9-]+)$/.exec(link.attr('href') || '')?.[1];
    const title = clean(link.parent().find('h3').first().text());
    if (slug && title && !seen.has(slug)) { seen.add(slug); rows.push({ slug, title }); }
  });
  return rows;
}
export function pickSlug(rows, title) {
  const wanted = normalize(title);
  return (rows.find(row => normalize(row.title) === wanted) || null)?.slug || null;
}
// La página incluye los datos como literal de JavaScript (claves sin comillas), no JSON.
export function parseEmbeds(html) {
  const start = html.indexOf('embeds:{');
  if (start < 0) return [];
  const end = html.indexOf(',downloads:', start), block = html.slice(start, end > start ? end : start + 6000), rows = [];
  for (const section of block.matchAll(/\b(SUB|DUB):\[([^\]]*)\]/g))
    for (const item of section[2].matchAll(/server:"([^"]+)",url:"(https:[^"]+)"/g))
      rows.push({ name: item[1], url: item[2], tag: TAGS[section[1]], source: 'AnimeAV1' });
  return rows;
}
async function slugFor(title) {
  const key = normalize(title), hit = slugs.get(key);
  if (hit && hit.until > Date.now()) return hit.slug;
  const slug = pickSlug(parseSearch(await getText(BASE + '/catalogo?search=' + encodeURIComponent(title))), title);
  while (slugs.size >= 200) slugs.delete(slugs.keys().next().value);
  slugs.set(key, { slug, until: Date.now() + 600000 });
  return slug;
}
export async function servers(title, number) {
  if (!/^\d{1,4}$/.test(String(number))) return [];
  const slug = await slugFor(title);
  if (!slug) return [];
  return parseEmbeds(await getText(BASE + '/media/' + slug + '/' + number));
}
