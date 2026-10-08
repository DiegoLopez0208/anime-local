import { inspect } from './sources.mjs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { getText, parseEpisode, resolveYourUpload, resolveMega, createMegaBridge, probeYourUpload } from './lib.mjs';
import { openVlc } from './player.mjs';
const args = process.argv.slice(2);
const terminal = createInterface({ input: stdin, output: stdout });
let bridge;
try {
  const url = args.find(a => a.startsWith('https://')) || (await terminal.question('URL del episodio de TioAnime o JKAnime: ')).trim();
  const choices = (await inspect(url)).servers;
  if (!choices.length) throw new Error('No hay servidores YourUpload o MEGA para este episodio.');
  if (args.includes('--list')) { console.log(JSON.stringify(choices, null, 2)); }
  else {
    const flag = args.indexOf('--server');
    let selected;
    if (flag >= 0) selected = choices.find(x => x.name.toLowerCase() === args[flag + 1]?.toLowerCase());
    else {
      choices.forEach((x, i) => console.log((i + 1) + '. ' + x.name));
      const answer = await terminal.question('Servidor (Enter = YourUpload): ');
      selected = answer.trim() ? choices[Number(answer) - 1] : choices.find(x => /yourupload/i.test(x.name)) || choices[0];
    }
    if (!selected) throw new Error('Servidor no disponible.');
    if (new URL(selected.url).hostname.endsWith('yourupload.com')) {
      const video = await resolveYourUpload(selected.url);
      console.log('MP4 comprobado:', await probeYourUpload(video));
      if (!args.includes('--probe')) {
        const child = openVlc(video.url, video.referrer);
        child.on('error', error => { console.error(error.message); process.exitCode = 1; });
        child.unref(); console.log('Abierto en VLC.');
      }
    } else {
      const file = await resolveMega(selected.url);
      console.log(file.name + ' (' + file.size + ' bytes)');
      bridge = await createMegaBridge(file);
      if (args.includes('--probe')) {
        const response = await fetch(bridge.url, { headers: { Range: 'bytes=0-4095' }, signal: AbortSignal.timeout(30000) });
        const bytes = Buffer.from(await response.arrayBuffer());
        if (response.status !== 206 || bytes.length !== 4096 || bytes.subarray(4, 8).toString() !== 'ftyp')
          throw new Error('MEGA no entrego un MP4 valido: HTTP ' + response.status);
        console.log('MEGA: 4096 bytes descifrados y cabecera MP4 comprobada.');
        await bridge.close(); bridge = null;
      } else {
        console.log('Puente local activo. Cerra VLC o pulsa Ctrl+C para terminar.');
        const child = openVlc(bridge.url);
        child.on('error', async error => { console.error(error.message); await bridge.close(); });
        child.on('exit', async () => { await bridge.close(); });
      }
    }
  }
} catch (error) {
  console.error('Error:', error.message); process.exitCode = 1;
  if (bridge) await bridge.close();
} finally { terminal.close(); }
process.on('SIGINT', async () => { if (bridge) await bridge.close(); process.exit(); });
