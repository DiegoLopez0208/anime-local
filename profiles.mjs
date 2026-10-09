const KEY = 'anime-local-profiles-v1';
export const STATUSES = { watching: 'Viendo', planned: 'Pendientes', completed: 'Terminados', paused: 'En pausa', dropped: 'Abandonados' };
const encode = bytes => Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
const decode = text => Uint8Array.from(text.match(/../g) || [], x => parseInt(x, 16));
export async function passwordHash(password, salt) {
 const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
 return encode(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: decode(salt), iterations: 600000, hash: 'SHA-256' }, key, 256)));
}
export class Profiles {
 constructor(local = localStorage, session = sessionStorage) {
  this.local = local; this.session = session;
  try { this.data = JSON.parse(local.getItem(KEY) || 'null'); } catch {}
  if (!this.data?.profiles || !this.data.guest) {
   let progress = {}; try { progress = JSON.parse(local.getItem('anime-local-progress') || '{}'); } catch {}
   this.data = { profiles: [], guest: { id: 'guest', name: 'Invitado', library: {}, progress } }; this.persist();
  }
 }
 persist() { this.local.setItem(KEY, JSON.stringify(this.data)); }
 current() { const id = this.session.getItem('anime-local-session'); return this.data.profiles.find(p => p.id === id) || this.data.guest; }
 loggedIn() { return this.current().id !== 'guest'; }
 async register(name, password) {
  name = name.trim();
  if (!/^[\p{L}\p{N} _.-]{2,32}$/u.test(name)) throw Error('Usa un nombre de 2 a 32 letras, números o espacios.');
  if (password.length < 8 || password.length > 256) throw Error('Usa una contraseña de 8 a 256 caracteres.');
  if (this.data.profiles.some(p => p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw Error('Ese perfil ya existe en este navegador.');
  const salt = encode(crypto.getRandomValues(new Uint8Array(16)));
  const profile = { id: crypto.randomUUID(), name, salt, hash: await passwordHash(password, salt), library: {}, progress: {} };
  this.data.profiles.push(profile); this.persist(); this.session.setItem('anime-local-session', profile.id); return profile;
 }
 async login(name, password) {
  const profile = this.data.profiles.find(p => p.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
  if (!profile || await passwordHash(password, profile.salt) !== profile.hash) throw Error('Nombre o contraseña incorrectos.');
  this.session.setItem('anime-local-session', profile.id); return profile;
 }
 logout() { this.session.removeItem('anime-local-session'); }
 setAnime(anime, status = 'watching', extra = {}) {
  if (!STATUSES[status]) throw Error('Estado no válido.');
  if (!/^\/(?:anime\/[a-zA-Z0-9_-]+|manga\/[a-f0-9-]{36})$/.test(anime.path)) throw Error('Anime no válido.');
  const library = this.current().library;
  const previous = library[anime.path];
  library[anime.path] = { path: anime.path, title: anime.title, image: anime.image, status, ...previous, ...extra, updated: Date.now() };
  library[anime.path].status = status;
  this.persist(); return library[anime.path];
 }
 removeAnime(path) { delete this.current().library[path]; this.persist(); }
 setFavorite(item, favorite) {
  if(typeof favorite!=='boolean')throw Error('Favorito no válido.');
  const previous=this.current().library[item.path];if(!previous&&!favorite)return;
  return this.setAnime(item,previous?.status||'planned',{favorite});
 }
 setRating(item, rating) {
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 10)) throw Error('La nota debe estar entre 1 y 10.');
  const previous = this.current().library[item.path];
  if (!previous && rating === null) return;
  return this.setAnime(item, previous?.status || 'planned', { rating });
 }
 saveProgress(path, time) {
  if (!Number.isFinite(time) || time < 0) return;
  const progress = this.current().progress; progress[path] = { time, updated: Date.now() };
  for (const key of Object.keys(progress).sort((a,b) => progress[b].updated-progress[a].updated).slice(100)) delete progress[key];
  this.persist();
 }
 exportData() { const current = this.current(); return { version: 1, name: current.name, library: current.library, progress: current.progress }; }
 importData(input) {
  if (input?.version !== 1 || !input.library || typeof input.library !== 'object' || !input.progress || typeof input.progress !== 'object') throw Error('Archivo de biblioteca no válido.');
  const library = {}, progress = {};
  const validAnime = /^\/(?:anime\/[a-zA-Z0-9_-]+|manga\/[a-f0-9-]{36})$/, validEpisode = /^\/(?:ver\/[a-zA-Z0-9_.-]+|leer\/[a-f0-9-]{36})$/;
  const rows = Object.values(input.library); if (rows.length > 5000) throw Error('La biblioteca es demasiado grande.');
  for (const row of rows) {
   if (!row || !validAnime.test(row.path) || !STATUSES[row.status] || typeof row.title !== 'string') throw Error('Anime no válido en el archivo.');
   library[row.path] = { path: row.path, title: row.title.slice(0, 300), image: /^(?:\/image\/uploads\/portadas\/[\w-]+\.(?:jpg|jpeg|png|webp)|(?:https:\/\/uploads\.mangadex\.org\/covers\/|\/manga-cover\/)[a-f0-9-]{36}\/[\w.-]+)$/i.test(row.image || '') ? row.image : null, status: row.status, updated: Date.now() };
   if (validEpisode.test(row.lastEpisode || '')) library[row.path].lastEpisode = row.lastEpisode;
   if(row.favorite!==undefined){if(typeof row.favorite!=='boolean')throw Error('Favorito no válido en el archivo.');library[row.path].favorite=row.favorite;}
   if (row.rating !== undefined && row.rating !== null) {
    if (!Number.isInteger(row.rating) || row.rating < 1 || row.rating > 10) throw Error('Nota no válida en el archivo.');
    library[row.path].rating = row.rating;
   }
  }
  for (const [path, value] of Object.entries(input.progress).slice(0, 100)) {
   if (validEpisode.test(path) && Number.isFinite(value?.time) && value.time >= 0) progress[path] = { time: value.time, updated: Date.now() };
  }
  this.current().library = library; this.current().progress = progress; this.persist();
 }
}
