export function previews({root,api,button}){
 let enabled=localStorage.getItem('anime-local-previews')!=='off',serial=0,timer,deadline,current,session,controller;
 const capable=()=>matchMedia('(hover: hover) and (pointer: fine)').matches&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!navigator.connection?.saveData;
 const update=()=>{button.setAttribute('aria-pressed',String(enabled));button.textContent='Vistas previas: '+(enabled?'sí':'no');button.title='Reproduce hasta 5 segundos, sin sonido, al mantener el mouse sobre una tarjeta. En las tarjetas compatibles.';};
 async function stop(){
  serial++;clearTimeout(timer);clearTimeout(deadline);controller?.abort();controller=null;
  const card=current;current=null;card?.classList.remove('preview-loading','preview-playing');card?.querySelector('.preview-label')?.remove();
  const video=card?.querySelector('.preview-video');if(video){video.pause();video.removeAttribute('src');video.load();video.remove();}
  const old=session;session=null;if(old)api('close',{id:old.id}).catch(()=>{});
 }
 button.onclick=()=>{enabled=!enabled;localStorage.setItem('anime-local-previews',enabled?'on':'off');update();if(!enabled)stop();};update();
 async function start(card){
  await stop();if(!enabled||!capable()||!card.matches(':hover'))return;
  const ticket=serial;current=card;controller=new AbortController();const signal=controller.signal;
  const label=document.createElement('span');label.className='preview-label';label.textContent='Preparando vista previa…';card.querySelector('.art').append(label);card.classList.add('preview-loading');
  deadline=setTimeout(stop,20000);
  try{
   let path=card.dataset.preview;
   if(path.startsWith('/anime/')){const info=await api('catalog/anime',{path},signal);path=info.episodes[0]?.path;if(!path)throw Error('Sin episodio');}
   const info=await api('catalog/episode',{path},signal);if(ticket!==serial)return;
   const source=info.servers.find(x=>x.name.toLowerCase()==='yourupload');if(!source)throw Error('Sin vista previa');
   const result=await api('play',{url:source.url,preview:true});if(ticket!==serial){api('close',{id:result.id}).catch(()=>{});return;}
   session=result;const video=document.createElement('video');video.className='preview-video';video.muted=true;video.playsInline=true;video.preload='metadata';video.setAttribute('aria-hidden','true');card.querySelector('.art').append(video);
   let from=0;
   video.addEventListener('loadedmetadata',()=>{if(ticket!==serial)return;from=Math.min(45,Math.max(0,video.duration-6));video.currentTime=from;video.play().catch(()=>stop());},{once:true});
   video.addEventListener('playing',()=>{if(ticket!==serial)return;card.classList.remove('preview-loading');card.classList.add('preview-playing');label.textContent='Vista previa · 5 s · sin sonido';clearTimeout(deadline);deadline=setTimeout(stop,5000);},{once:true});
   video.addEventListener('timeupdate',()=>{if(video.currentTime>=from+5)stop();});video.addEventListener('error',()=>stop(),{once:true});video.src=result.src;
  }catch{if(ticket===serial)stop();}
 }
 function enter(event){const card=event.target.closest('[data-preview]');if(!card||card.contains(event.relatedTarget)||!enabled||!capable())return;stop();timer=setTimeout(()=>start(card),750);}
 function leave(event){const card=event.target.closest('[data-preview]');if(card&&!card.contains(event.relatedTarget))stop();}
 root.addEventListener('pointerover',enter);root.addEventListener('pointerout',leave);
 const hide=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',stop);
 return {stop};
}
