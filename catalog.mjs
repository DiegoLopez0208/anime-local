import { load } from 'cheerio';
import { getText, parseEpisode } from './lib.mjs';

const base = 'https://tioanime.com';
const cache = new Map(), pending = new Map();
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
export function sourcePath(value, prefix) {
  const url = new URL(value, base);
  if (url.origin !== base || !url.pathname.startsWith(prefix) || !/^\/[a-zA-Z0-9/_-]+$/.test(url.pathname))
    throw new Error('Ruta de TioAnime no valida.');
  return url.pathname;
}
export function imagePath(value) {
  try {
    const url = new URL(value, base);
    return url.origin === base && /^\/uploads\/(portadas|thumbs)\/[\w-]+\.(jpg|jpeg|png|webp)$/i.test(url.pathname)
      ? '/image' + url.pathname : null;
  } catch { return null; }
}
export async function cachedText(path, ttl = 300000) {
  const entry = cache.get(path);
  if (entry && entry.until > Date.now()) return entry.html;
  if (pending.has(path)) return pending.get(path);
  const task = getText(base + path).then(html => {
    while (cache.size >= 120) cache.delete(cache.keys().next().value);
    cache.set(path, { html, until: Date.now() + ttl }); return html;
  }).finally(() => pending.delete(path));
  pending.set(path, task); return task;
}
function cards($, selector, prefix) {
  const result = [], seen = new Set();
  $(selector).each((_, element) => {
    const article = $(element), link = article.find('a[href]').first();
    try {
      const path = sourcePath(link.attr('href'), prefix);
      if (seen.has(path)) return;
      seen.add(path);
      result.push({ path, title: clean(article.find('.title').first().text() || link.text()),
        image: imagePath(article.find('img').first().attr('src')) });
    } catch {}
  });
  return result.filter(item => item.title);
}
export function parseHome(html) {
  const $ = load(html);
  const episodes = cards($, 'article.episode', '/ver/');
  const anime = cards($, 'article.anime:not(.media)', '/anime/');
  if (!episodes.length && !anime.length) throw new Error('No se pudo leer el catalogo de TioAnime.');
  return { episodes, anime, fetchedAt: new Date().toISOString() };
}
export function parseDirectory(html, page = 1) {
  const $ = load(html);
  if (!$('.animes').length) throw new Error('No se pudo leer el directorio de TioAnime.');
  const items = cards($, '.animes article.anime', '/anime/');
  const pages = [];
  $('.pagination a').each((_, element) => {
    try {
      const url = new URL($(element).attr('href'), base);
      if (url.origin !== base || url.pathname !== '/directorio') return;
      const number = Number(url.searchParams.get('p'));
      if (Number.isSafeInteger(number) && number > 0 && !pages.includes(number)) pages.push(number);
    } catch {}
  });
  const genres = [];
  $('select#genero option').each((_, element) => {
    const value = $(element).attr('value');
    if (value) genres.push({ value, label: clean($(element).text()) });
  });
  return { items, page, pages: pages.sort((a, b) => a - b), genres, fetchedAt: new Date().toISOString() };
}
function literal(html, name) {
  const match = html.match(new RegExp('\\bvar\\s+' + name + '\\s*=\\s*(\\[[^;]*\\])\\s*;'));
  if (!match) throw new Error('Faltan los datos de ' + name + '.');
  return JSON.parse(match[1]);
}
export function parseAnime(html, path) {
  const $ = load(html);
  const info = literal(html, 'anime_info'), numbers = literal(html, 'episodes');
  let dates = []; try { dates = literal(html, 'episodes_details'); } catch {}
  const slug = path.slice('/anime/'.length);
  const episodes = numbers.map((number, index) => {
    if (!/^(\d+)(\.\d+)?$/.test(String(number))) return null;
    return { number, path: '/ver/' + slug + '-' + number, date: clean(dates[index]) };
  }).filter(Boolean).sort((a, b) => Number(a.number) - Number(b.number));
  return {
    path, title: clean($('.anime-single h1').first().text() || info[2]),
    image: imagePath($('.anime-single .thumb img').first().attr('src')),
    synopsis: clean($('.sinopsis').first().text()), status: clean($('.anime-single .status').first().text()),
    year: clean($('.anime-single .year').first().text()),
    type: clean($('.anime-single .meta').children('span').first().text()),
    genres: $('.anime-single .genres a').map((_, element) => clean($(element).text())).get(),
    episodes, nextEpisode: info[3] || null
  };
}
export function parseEpisodePage(html, path) {
  const $ = load(html), nav = $('.episodes-nav a[href]');
  let anime = null, previous = null, next = null;
  nav.each((_, element) => {
    const a = $(element), href = a.attr('href');
    try {
      if (href.startsWith('/anime/')) anime = sourcePath(href, '/anime/');
      else if (href.startsWith('/ver/')) {
        const p = sourcePath(href, '/ver/');
        if (/anterior/i.test(a.text())) previous = p;
        if (/siguiente/i.test(a.text())) next = p;
      }
    } catch {}
  });
  return { path, title: clean($('h1').first().text()), anime, previous, next, servers: parseEpisode(html) };
}
export async function home() { return parseHome(await cachedText('/', 120000)); }
export async function directory(input = {}) {
  const page = Number(input.page || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new Error('Pagina no valida.');
  const params = new URLSearchParams({ p: String(page) });
  const query = clean(input.q).slice(0, 120);
  if (query) params.set('q', query);
  if (input.genre && /^[a-z0-9-]+$/.test(input.genre)) params.set('genero[]', input.genre);
  if (['1', '2', '3'].includes(String(input.status))) params.set('status', String(input.status));
  return parseDirectory(await cachedText('/directorio?' + params, 300000), page);
}
export async function anime(input) {
  const path = sourcePath(input, '/anime/');
  return parseAnime(await cachedText(path, 600000), path);
}
export async function episode(input) {
  const path = sourcePath(input, '/ver/');
  return parseEpisodePage(await cachedText(path, 60000), path);
}
