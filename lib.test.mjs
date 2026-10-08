import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { parseEpisode, normalizeMega, parseRange, createMegaBridge } from './lib.mjs';
test('extrae los proveedores compatibles sin ejecutar JavaScript', () => {
  const html = 'var videos = [["Mega","https://mega.nz/embed/!abc!key",0],["Voe","https://voe.sx/e/x"],["YourUpload","https://www.yourupload.com/embed/x"]];';
  assert.deepEqual(parseEpisode(html).map(x => x.name), ['Mega', 'YourUpload']);
  assert.throws(() => parseEpisode('var videos = [alert(1)];'));
});
test('convierte MEGA embed conservando la clave', () => {
  assert.equal(normalizeMega('https://mega.nz/embed/!abc!key'), 'https://mega.nz/file/abc#key');
  assert.throws(() => normalizeMega('https://example.com/embed/!abc!key'));
});
test('rangos completos, abiertos y de sufijo; rechaza rangos invalidos', () => {
  assert.deepEqual(parseRange('bytes=8-', 10), { start: 8, end: 9, partial: true });
  assert.deepEqual(parseRange('bytes=-3', 10), { start: 7, end: 9, partial: true });
  assert.deepEqual(parseRange('bytes=0-99', 10), { start: 0, end: 9, partial: true });
  for (const range of ['bytes=10-', 'bytes=4-2', 'bytes=-0', 'bytes=0-1,4-5', 'bytes=-'])
    assert.throws(() => parseRange(range, 10));
});
test('puente MEGA: bytes exactos, HEAD, 416 y token privado', async () => {
  const data = Buffer.from('0123456789');
  const bridge = await createMegaBridge({ size: data.length, name: 'test.mp4',
    download: ({ start, end }) => Readable.from([data.subarray(start, end + 1)]) });
  try {
    for (const [range, expected] of [['bytes=0-0', '0'], ['bytes=3-5', '345'], ['bytes=-2', '89']]) {
      const response = await fetch(bridge.url, { headers: { Range: range } });
      assert.equal(response.status, 206);
      assert.equal(await response.text(), expected);
    }
    const head = await fetch(bridge.url, { method: 'HEAD' });
    assert.equal(head.headers.get('content-length'), '10');
    assert.equal(await head.text(), '');
    assert.equal((await fetch(bridge.url, { headers: { Range: 'bytes=20-' } })).status, 416);
    assert.equal((await fetch(new URL('/video', bridge.url))).status, 404);
  } finally { await bridge.close(); }
});
test('el puente informa errores del proveedor sin simular un video', async () => {
  const bridge = await createMegaBridge({ size: 10, name: 'test.mp4', download: () =>
    new Readable({ read() { this.destroy(new Error('Quota exceeded')); } }) });
  try { assert.equal((await fetch(bridge.url)).status, 502); }
  finally { await bridge.close(); }
});
