const CACHE='anime-local-mobile-v3';
const OFFLINE='/offline.html';
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([OFFLINE,'/pwa-icons/icon-192.png'])).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('anime-local-mobile-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(url.pathname==='/pwa-icons/icon-192.png'){
  event.respondWith(caches.match(url.pathname).then(cached=>cached||fetch(request)));return;
 }
 if(request.mode!=='navigate'||!['/','/reproductor'].includes(url.pathname))return;
 event.respondWith(fetch(request).catch(async()=>{
  const fallback=await caches.match(OFFLINE);
  return fallback||new Response('Sin conexión. Vuelve a abrir Anime Local cuando tengas internet.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 }));
});
