import { enhanceReader } from '/experience.mjs?v=0.4.0';
import { createReaderCache } from '/reader-cache.mjs?v=0.4.0';
let readerObserver, loaderObserver, readerCache, readerExperience;
function clearImages() {
 readerObserver?.disconnect(); loaderObserver?.disconnect();
 readerCache?.close();readerCache=null;readerExperience?.close();readerExperience=null;
}
export async function renderManga(ctx) {
 clearImages();
 const {url,root,api,esc,grid,image,profiles,statusOptions,active,mountRatings,mountFavorite}=ctx;
 const path=url.pathname, id=path.split('/')[2], language=url.searchParams.get('idioma')==='en'?'en':'es', offset=Number(url.searchParams.get('offset'))||0;
 const params=(data)=>{const p=new URLSearchParams(data);return p.size?'?'+p:'';};
 const languages='<option value="es">Español y latino</option><option value="en">English</option>';
 const paginate=(base,data)=>'<nav class="pages" aria-label="Páginas">'+(data.offset>0?'<a href="'+esc(base+params({idioma:language,offset:Math.max(0,data.offset-data.limit),q:url.searchParams.get('q')||'',tipo:url.searchParams.get('tipo')||''}))+'">← Anterior</a>':'')+(data.offset+data.limit<data.total?'<a href="'+esc(base+params({idioma:language,offset:data.offset+data.limit,q:url.searchParams.get('q')||'',tipo:url.searchParams.get('tipo')||''}))+'">Siguiente →</a>':'')+'</nav>';
 if(path==='/mangas'){
  const q=url.searchParams.get('q')||'', type=url.searchParams.get('tipo')||'';
  const data=await api('manga/search',{q,type,language,offset});if(!active())return true;
  root.innerHTML='<div class="eyebrow">Tu biblioteca · Lecturas</div><h1>Manga, manhwa y manhua.</h1><p>Encuentra tu próxima lectura y elige los capítulos en tu idioma.</p><form id="mangasearch" class="filters"><input id="mangaquery" aria-label="Buscar manga" placeholder="Buscar una obra…" maxlength="120" value="'+esc(q)+'"><select id="mangatype" aria-label="Tipo de obra"><option value="">Todos</option><option value="ja">Manga · Japón</option><option value="ko">Manhwa · Corea</option><option value="zh">Manhua · China</option></select><select id="mangalanguage" aria-label="Idioma de capítulos">'+languages+'</select><button>Buscar</button></form><p class="sub">'+data.items.length+' obras con capítulos disponibles en esta página</p>'+(data.items.length?grid(data.items,false,params({idioma:language})):'<div class="notice">No hay lecturas disponibles en esta página con estos filtros. Prueba otro idioma o avanza a la siguiente página.</div>')+paginate('#/mangas',data);
  root.querySelector('#mangatype').value=type;root.querySelector('#mangalanguage').value=language;
  root.querySelector('#mangasearch').onsubmit=e=>{e.preventDefault();location.hash='#/mangas'+params({q:root.querySelector('#mangaquery').value.trim(),tipo:root.querySelector('#mangatype').value,idioma:root.querySelector('#mangalanguage').value});};
  return true;
 }
 if(path.startsWith('/manga/')){
  const data=await api('manga/detail',{id,language,offset});if(!active())return true;
  document.title=data.title+' · Anime local';
  const saved=profiles.current().library[data.path];
  root.innerHTML='<div class="crumb"><a href="#/mangas">Lecturas</a> / '+esc(data.type)+'</div><section class="detail">'+image(data.image,data.title,'class="poster"')+'<div><div class="eyebrow">'+esc(data.type)+' · Lecturas</div><h1>'+esc(data.title)+'</h1><div class="chips">'+data.tags.slice(0,12).map(t=>'<span class="chip">'+esc(t)+'</span>').join('')+'</div><div class="listselect"><label for="readingstatus">Mi lista</label><select id="readingstatus"><option value="">Añadir a mi lista</option>'+statusOptions(saved?.status)+'</select></div></div><p class="synopsis">'+esc(data.synopsis||'Sin sinopsis disponible.')+'</p></section><div class="sectionhead"><h2>Capítulos</h2><select id="chapterlanguage" aria-label="Idioma de capítulos">'+languages+'</select></div><p class="sub">'+data.total+' versiones de capítulos. Puede haber varias traducciones del mismo capítulo.</p><div class="episodelist">'+data.chapters.map(ch=>ch.externalUrl?'<div class="episodeitem">Capítulo '+esc(ch.number||'Especial')+'<small>Lectura no disponible aquí</small></div>':'<a class="episodeitem" href="#'+esc(ch.path+params({idioma:language,offset}))+'">Capítulo '+esc(ch.number||'Especial')+'<small>'+esc(ch.title||ch.pages+' páginas')+' · '+(ch.language==='en'?'Inglés':ch.language==='es-la'?'Español latino':'Español')+'</small></a>').join('')+'</div>'+(data.chapters.length?'':'<div class="notice">'+(data.alternatives.length?'No hay capítulos disponibles en este idioma. '+data.alternatives.map(a=>'<a class="button secondary" href="#'+esc(data.path+params({idioma:a.language}))+'">Ver '+a.total+' capítulos en '+(a.language==='en'?'inglés':'español')+'</a>').join(' '):'Esta obra no tiene capítulos disponibles en español ni inglés. <a class="button secondary" href="#/mangas">Explorar lecturas</a>')+'</div>')+paginate('#'+data.path,data);
  mountRatings({element:root.querySelector('.detail>div'),item:data,kind:'manga',api,esc,profiles,active});mountFavorite({element:root.querySelector('.detail>div'),item:data,profiles});
  root.querySelector('#readingstatus').value=saved?.status||'';
  root.querySelector('#readingstatus').onchange=e=>{if(e.target.value)profiles.setAnime(data,e.target.value);else profiles.removeAnime(data.path);};
  root.querySelector('#chapterlanguage').value=data.language;root.querySelector('#chapterlanguage').onchange=e=>location.hash='#'+data.path+params({idioma:e.target.value});
  return true;
 }
 if(path.startsWith('/leer/')){
  const data=await api('manga/chapter',{id});if(!active())return true;
  const lang=data.language==='en'?'en':'es';
  const feed=await api('manga/detail',{id:data.manga.id,language:lang,offset});if(!active())return true;
  const list=feed.chapters.filter(ch=>!ch.externalUrl), index=list.findIndex(ch=>ch.id===id);
  const chapterLink=ch=>'#'+ch.path+params({idioma:lang,offset});
  const prior=profiles.current().library[data.manga.path];
  profiles.setAnime(data.manga,prior&&prior.status!=='planned'?prior.status:'watching',{lastEpisode:data.id?'/leer/'+data.id:null,lastWatchedAt:Date.now()});
  let page=Math.max(0,Math.min(data.pages.length-1,Math.floor(profiles.current().progress[path]?.time||0))),mode=['five','page','vertical'].includes(localStorage.getItem('anime-local-reader-mode'))?localStorage.getItem('anime-local-reader-mode'):'five',readingPage=page;
  document.title=data.manga.title+' · Capítulo '+data.number;
  root.innerHTML='<div class="crumb"><a href="#'+esc(data.manga.path+params({idioma:lang,offset}))+'">'+esc(data.manga.title)+'</a> / Capítulo '+esc(data.number||'Especial')+'</div><div class="sectionhead"><h1>Capítulo '+esc(data.number||'Especial')+'</h1><select id="readmode" aria-label="Modo de lectura"><option value="five">5 páginas seguidas</option><option value="page">Página por página</option><option value="vertical">Lectura vertical</option></select></div><div class="readercontrols"><button id="pageprevious" class="secondary">← Página</button><select id="readpage" aria-label="Página del capítulo">'+data.pages.map((_,i)=>'<option value="'+i+'">Página '+(i+1)+' / '+data.pages.length+'</option>').join('')+'</select><button id="pagenext" class="secondary">Página →</button></div><p id="readstatus" role="status" class="sub">Cargando página…</p><div id="reader" class="reader"></div><div class="watchbar">'+(index>0?'<a class="button secondary" href="'+esc(chapterLink(list[index-1]))+'">← Capítulo anterior</a>':'')+'<a class="button secondary" href="#'+esc(data.manga.path+params({idioma:lang,offset}))+'">Lista de capítulos</a>'+(index>=0&&index<list.length-1?'<a class="button" href="'+esc(chapterLink(list[index+1]))+'">Siguiente capítulo →</a>':'')+'</div>';
  const reader=root.querySelector('#reader'), select=root.querySelector('#readpage'), status=root.querySelector('#readstatus');
  async function fetchPage(i,signal,retry=true){
   try{
    const response=await fetch('/manga-page/'+id+'/'+i,{credentials:'omit',referrerPolicy:'no-referrer',signal});
    const blob=await response.blob();
    if(!response.ok||!blob.type.startsWith('image/'))throw Error('Imagen no disponible.');
    return blob;
   }catch(error){
    if(signal.aborted||!active())throw error;
    if(retry){const renewed=await api('manga/chapter',{id,refresh:true},signal);data.pages=renewed.pages;return fetchPage(i,signal,false);}
    throw error;
   }
  }
  const cache=createReaderCache({load:fetchPage});readerCache=cache;
  const windowPages=()=>Array.from({length:Math.min(5,data.pages.length-page)},(_,i)=>page+i);
  function loadPage(img,i){
   cache.get(i).then(url=>{
    if(!active()||!img.isConnected)return;
    img.src=url;
   }).catch(error=>{
    if(error.name!=='AbortError'&&active()&&img.isConnected)status.textContent='La página '+(i+1)+' no pudo cargar. Vuelve a elegirla para reintentar.';
   });
  }
  const attach=img=>{
   img.onload=()=>{if(!active()||!img.isConnected)return;img.style.minHeight='0';status.textContent='Capítulo guardado en Mi lista.';if(mode==='page')profiles.saveProgress(path,page);};
   img.onerror=()=>{if(active()&&img.isConnected)status.textContent='La imagen no pudo cargar. Vuelve a abrir el capítulo para renovar sus enlaces.';};
  };
  const draw=()=>{
   readerObserver?.disconnect();loaderObserver?.disconnect();
   const ahead=windowPages();cache.retain(mode==='vertical'?null:ahead);
   select.value=page;
   const step=mode==='five'?5:1,previous=root.querySelector('#pageprevious'),next=root.querySelector('#pagenext');
   previous.disabled=page===0;next.disabled=page+step>=data.pages.length;
   previous.textContent=mode==='five'?'← 5 anteriores':'← Página';next.textContent=mode==='five'?'5 siguientes →':'Página →';
   reader.replaceChildren();status.textContent=mode==='five'?'Cargando páginas '+(page+1)+' a '+(ahead.at(-1)+1)+'…':'Cargando página…';
   const indexes=mode==='vertical'?data.pages.map((_,i)=>i):mode==='five'?ahead:[page];
   if(mode!=='page')readerObserver=new IntersectionObserver(entries=>{
    if(!active())return;
    const visible=entries.filter(x=>x.isIntersecting).sort((a,b)=>Math.abs(a.boundingClientRect.top)-Math.abs(b.boundingClientRect.top));
    if(visible[0]){
     readingPage=Number(visible[0].target.dataset.page);readerExperience?.update(readingPage);profiles.saveProgress(path,readingPage);
     if(mode==='vertical'){page=readingPage;select.value=page;previous.disabled=page===0;next.disabled=page>=data.pages.length-1;}
    }
   },{rootMargin:'0px 0px -70% 0px',threshold:0});
   if(mode==='vertical')loaderObserver=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){loaderObserver.unobserve(entry.target);loadPage(entry.target,Number(entry.target.dataset.page));}
   },{rootMargin:'800px 0px'});
   for(const i of indexes){
    const img=document.createElement('img');img.alt='Página '+(i+1);img.style.minHeight='500px';attach(img);img.dataset.page=i;reader.append(img);
    if(mode!=='page')readerObserver.observe(img);
    if(mode==='vertical')loaderObserver.observe(img);else loadPage(img,i);
   }
   // In single-page mode the same five-page window is prepared in the background.
   if(mode==='page')for(const i of ahead)cache.get(i).catch(()=>{});
  };
  const change=n=>{
   page=Math.max(0,Math.min(data.pages.length-1,n));readingPage=page;
   profiles.saveProgress(path,page);readerExperience?.update(page);
   if(mode==='vertical')mode='five';
   root.querySelector('#readmode').value=mode;draw();
  };
  root.querySelector('#pageprevious').onclick=()=>change(page-(mode==='five'?5:1));
  root.querySelector('#pagenext').onclick=()=>change(page+(mode==='five'?5:1));select.onchange=()=>change(Number(select.value));
  root.querySelector('#readmode').onchange=e=>{mode=e.target.value;localStorage.setItem('anime-local-reader-mode',mode);page=readingPage;draw();};
  readerExperience=enhanceReader({root,total:data.pages.length,page,onNavigate:direction=>{const button=root.querySelector(direction>0?'#pagenext':'#pageprevious');if(!button.disabled)button.click();}});readerExperience.update(page);root.querySelector('#readmode').value=mode;
  draw();return true;
 }
 return false;
}
