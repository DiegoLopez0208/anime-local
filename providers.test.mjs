import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, classifyAll } from './providers.mjs';
import { parseSearch, pickSlug, parseEmbeds } from './animeav1.mjs';
import { parseSkip, skipTimes } from './skip.mjs';
import { activeSkip, formatTime, playerMarkup } from './player-ui.mjs';

test('clasifica proveedores directos, HLS y embebidos, y rechaza el resto', () => {
  assert.equal(classify('Mega', 'https://mega.nz/embed/!a!b').mode, 'direct');
  assert.equal(classify('MP4Upload', 'https://www.mp4upload.com/9yc389vqj86v').url, 'https://www.mp4upload.com/embed-9yc389vqj86v.html');
  assert.equal(classify('HLS', 'https://player.zilla-networks.com/play/' + 'a'.repeat(32)).mode, 'embed');
  assert.equal(classify('Voe', 'https://voe.sx/e/abc').mode, 'embed');
  assert.equal(classify('Ok', 'https://ok.ru/videoembed/1').mode, 'embed');
  for (const bad of ['http://voe.sx/e/abc', 'https://evil.example/e/abc', 'https://user:pw@voe.sx/e/abc', 'https://voe.sx.evil.example/e/a', 'https://player.zilla-networks.com/play/../x', 'javascript:alert(1)'])
    assert.equal(classify('x', bad), null, bad);
});
test('classifyAll ordena directos antes que embeds y quita duplicados', () => {
  const rows = classifyAll([
    { name: 'Voe', url: 'https://voe.sx/e/a' }, { name: 'Mega', url: 'https://mega.nz/embed/!a!b' },
    { name: 'Voe', url: 'https://voe.sx/e/a' }, { name: 'HLS', url: 'https://player.zilla-networks.com/play/' + 'b'.repeat(32), tag: 'Sub' }]);
  assert.deepEqual(rows.map(row => row.mode), ['direct', 'embed', 'embed']);
  assert.equal(rows[2].tag, 'Sub');
});
test('AnimeAV1: busca por título exacto y lee servidores Sub y Latino', () => {
  const rows = parseSearch('<div><header><h3>Sousou no Frieren 2nd Season</h3></header><a href="/media/sousou-no-frieren-2nd-season">Ver</a></div><div><h3>Otra</h3><a href="/media/otra">x</a></div><a href="/evil">x</a>');
  assert.deepEqual(rows.map(row => row.slug), ['sousou-no-frieren-2nd-season', 'otra']);
  assert.equal(pickSlug(rows, 'Sousou no Frieren 2nd Season'), 'sousou-no-frieren-2nd-season');
  assert.equal(pickSlug(rows, 'Sousou no Frieren'), null);
  const html = 'x embeds:{SUB:[{server:"HLS",url:"https://player.zilla-networks.com/play/' + 'c'.repeat(32) + '"},{server:"Voe",url:"https://voe.sx/e/z"}],DUB:[{server:"MP4Upload",url:"https://www.mp4upload.com/embed-abc12345.html"}]},downloads:{SUB:[{server:"Mega",url:"https://mega.nz/file/x#y"}]}';
  const servers = parseEmbeds(html);
  assert.deepEqual(servers.map(row => row.name + ':' + row.tag), ['HLS:Sub', 'Voe:Sub', 'MP4Upload:Latino']);
  assert.deepEqual(parseEmbeds('sin datos'), []);
});
test('AniSkip: filtra tipos y tiempos no válidos', () => {
  const ranges = parseSkip({ found: true, results: [
    { skipType: 'ed', interval: { startTime: 1370, endTime: 1460 } }, { skipType: 'op', interval: { startTime: 153.3, endTime: 243.3 } },
    { skipType: 'hack', interval: { startTime: 1, endTime: 2 } }, { skipType: 'op', interval: { startTime: 9, endTime: 3 } }] });
  assert.deepEqual(ranges.map(row => row.type), ['op', 'ed']);
  assert.deepEqual(parseSkip({ found: false }), []);
});
test('skipTimes: usa la primera coincidencia de MAL, cachea y valida la entrada', async () => {
  let calls = 0;
  const lookup = async () => ({ matches: [{ id: 52991 }], match: null });
  const fetcher = async url => { calls++; assert.match(String(url), /52991\/7\?/); return { ok: true, json: async () => ({ found: true, results: [{ skipType: 'op', interval: { startTime: 10, endTime: 95 } }] }) }; };
  const first = await skipTimes({ title: 'Test Show', episode: 7 }, lookup, fetcher);
  await skipTimes({ title: 'Test Show', episode: 7 }, lookup, fetcher);
  assert.equal(calls, 1);
  assert.deepEqual(first.ranges, [{ type: 'op', start: 10, end: 95 }]);
  await assert.rejects(skipTimes({ title: 'x', episode: 0 }));
  assert.deepEqual((await skipTimes({ title: 'Falla Total', episode: 1 }, async () => { throw Error('MAL caído'); }, fetcher)).ranges, []);
});
test('skipTimes: reintenta sin la temporada y exige título exacto', async () => {
  const queries = [];
  const lookup = async ({ title }) => { queries.push(title); return title === 'Show X' ? { matches: [{ id: 1, title: 'Show X' }, { id: 2, title: 'Show X 2nd Season' }] } : { matches: [] }; };
  const seen = [];
  const fetcher = async url => { seen.push(String(url)); return { ok: true, json: async () => ({ found: false }) }; };
  await skipTimes({ title: 'Show X 2nd Season', episode: 3 }, lookup, fetcher);
  assert.deepEqual(queries, ['Show X 2nd Season', 'Show X']);
  assert.match(seen[0], /\/2\/3\?/);
  const none = await skipTimes({ title: 'Show Y 3rd Season', episode: 3 }, async () => ({ matches: [] }), fetcher);
  assert.deepEqual(none.ranges, []);
  assert.equal(seen.length, 1);
});
test('reproductor: salto activo, formato de tiempo y marcado', () => {
  const ranges = [{ type: 'op', start: 100, end: 190 }];
  assert.equal(activeSkip(ranges, 99.8)?.type, 'op');
  assert.equal(activeSkip(ranges, 190), null);
  assert.equal(activeSkip([], 5), null);
  assert.equal(formatTime(3725), '1:02:05');
  assert.equal(formatTime(65), '1:05');
  assert.equal(formatTime(NaN), '0:00');
  assert.match(playerMarkup(), /sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"/);
  assert.doesNotMatch(playerMarkup(), /allow-popups/);
});
