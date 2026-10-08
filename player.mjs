import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
export function openVlc(url, referrer) {
  const locations = [process.env.VLC_PATH, 'C:/Program Files/VideoLAN/VLC/vlc.exe', 'C:/Program Files (x86)/VideoLAN/VLC/vlc.exe'].filter(Boolean);
  const exe = locations.find(existsSync);
  if (!exe) throw new Error('No se encontro VLC. Configura VLC_PATH o instala VLC.');
  const args = ['--no-one-instance'];
  if (referrer) args.push('--http-referrer=' + referrer);
  args.push(url);
  const child = spawn(exe, args, { stdio: 'ignore' });
  return child;
}
