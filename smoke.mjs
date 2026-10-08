import assert from 'node:assert/strict';
const root = 'http://127.0.0.1:5189';
const episodeUrl = process.env.TIOANIME_EPISODE;
if (!episodeUrl) { console.log('Set TIOANIME_EPISODE to run live checks.'); process.exit(0); }
const page = await (await fetch(root)).text();
const token = page.match(/const token='([a-f0-9]+)'/)[1];
async function api(path, data) {
  const response = await fetch(root + '/api/' + path, { method: 'POST', headers: {
    'Content-Type': 'application/json', 'X-Local-Token': token
  }, body: JSON.stringify(data) });
  const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result)); return result;
}
const denied = await fetch(root + '/api/episode', { method: 'POST', body: '{}' });
assert.equal(denied.status, 403);
const home = await api('catalog/home', {});
assert.ok(home.episodes.length > 0 && home.anime.length > 0);
const chosen = await api('catalog/episode', { path: new URL(episodeUrl).pathname });
assert.ok(chosen.anime);
const info = await api('catalog/anime', { path: chosen.anime });
const search = await api('catalog/directory', { q: info.title });
assert.ok(search.items.some(x => x.path === info.path));
assert.ok(info.episodes.length > 0);
const detail = await api('catalog/episode', { path: info.episodes[0].path });
assert.ok(detail.servers.length > 0);
assert.equal((await fetch(root + info.image)).status, 200);
console.log('Catalogo, busqueda, ficha, episodios y portada correctos.');
const episode = await api('episode', { url: episodeUrl });
assert.ok(episode.servers.length > 0);
for (const provider of episode.servers) {
  const session = await api('play', { url: provider.url });
  try {
    const url = new URL(session.src, root);
    for (const [start, end] of [[0, 4095], [1000000, 1004095]]) {
      const response = await fetch(url, { headers: { Range: 'bytes=' + start + '-' + end }, signal: AbortSignal.timeout(30000) });
      const data = Buffer.from(await response.arrayBuffer());
      assert.equal(response.status, 206); assert.equal(data.length, end - start + 1);
      if (start === 0) assert.equal(data.subarray(4, 8).toString(), 'ftyp');
    }
    const interrupted = await fetch(url, { headers: { Range: 'bytes=0-' }, signal: AbortSignal.timeout(30000) });
    const reader = interrupted.body.getReader();
    await reader.read(); await reader.cancel();
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.equal((await fetch(root)).status, 200, 'El servidor debe sobrevivir a una cancelacion.');
    console.log(provider.name + ': API, cabecera MP4 y salto a 1 MB correctos.');
  } finally { await api('close', { id: session.id }); }
}
console.log('Control de acceso local correcto.');
