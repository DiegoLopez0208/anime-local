import * as ratings from './ratings.mjs';

const API = 'https://api.aniskip.com/v2/skip-times/';
const TYPES = ['op', 'ed', 'recap', 'mixed-op', 'mixed-ed'];
const cache = new Map();

export function parseSkip(data) {
  if (!data?.found || !Array.isArray(data.results)) return [];
  return data.results
    .filter(row => TYPES.includes(row.skipType) && Number.isFinite(row.interval?.startTime) && Number.isFinite(row.interval?.endTime) && row.interval.endTime > row.interval.startTime)
    .map(row => ({ type: row.skipType, start: row.interval.startTime, end: row.interval.endTime }))
    .sort((a, b) => a.start - b.start);
}
const normalize = value => String(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const stripSeason = value => value.replace(/\s*(?:\d+(?:st|nd|rd|th)\s+season|season\s+\d+|part\s+\d+|cour\s+\d+)\b.*$/i, '').trim();
// MAL a veces no encuentra títulos con la temporada al final; se reintenta sin ella y se exige coincidencia exacta.
async function findId(title, lookup) {
  const found = await lookup({ kind: 'anime', title });
  const first = found.match?.id || found.matches?.[0]?.id;
  if (first) return first;
  const base = stripSeason(title);
  if (base.length < 2 || base === title) return null;
  const second = await lookup({ kind: 'anime', title: base });
  return second.matches?.find(row => normalize(row.title) === normalize(title))?.id || null;
}
export async function skipTimes(input = {}, lookup = ratings.lookup, fetcher = fetch) {
  const title = String(input.title || '').replace(/\s+/g, ' ').trim().slice(0, 120), episode = Number(input.episode);
  if (title.length < 2 || !Number.isSafeInteger(episode) || episode < 1 || episode > 5000) throw Error('Datos de episodio no válidos.');
  const key = title.toLowerCase() + '|' + episode, hit = cache.get(key);
  if (hit?.until > Date.now()) return hit.value;
  let ranges = [];
  try {
    const id = await findId(title, lookup);
    if (id) {
      const params = new URLSearchParams(TYPES.map(type => ['types', type]));
      params.set('episodeLength', '0');
      const response = await fetcher(API + id + '/' + episode + '?' + params, { signal: AbortSignal.timeout(10000) });
      if (response.ok) ranges = parseSkip(await response.json());
    }
  } catch {}
  const value = { ranges };
  while (cache.size >= 300) cache.delete(cache.keys().next().value);
  cache.set(key, { value, until: Date.now() + (ranges.length ? 6 * 3600000 : 600000) });
  return value;
}
