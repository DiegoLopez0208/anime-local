let readerObserver;
export async function renderManga(ctx) {
 readerObserver?.disconnect();
 const {url,root,api,esc,grid,image,profiles,statusOptions,active}=ctx;
 const path=url.pathname, id=path.split('/')[2], language=url.searchParams.get('idioma')||'es', offset=Number(url.searchParams.get('offset'))||0;
 const params=(data)=>{const p=new URLSearchParams(data);return p.size?'?'+p:'';};
 const languages='<option value="es">Español</option><option value="es-la">Español latino</option><option value="en">English</option>';
 const paginate=(base,data)=>'<nav class="pages" aria-label="Páginas">'+(data.offset>0?'<a href="'+esc(base+params({idioma:language,offset:Math.max(0,data.offset-data.limit),q:url.searchParams.get('q')||'',tipo:url.searchParams.get('tipo')||''}))+'">← Anterior</a>':'')+(data.offset+data.limit<data.total?'<a href="'+esc(base+params({idioma:language,offset:data.offset+data.limit,q:url.searchParams.get('q')||'',tipo:url.searchParams.get('tipo')||''}))+'">Siguiente →</a>':'')+'</nav>';
 if(path==='/mangas'){
  const q=url.searchParams.get('q')||'', type=url.searchParams.get('tipo')||'';
  const data=await api('manga/search',{q,type,language,offset});if(!active())return true;
  root.innerHTML='<div class="eyebrow">MangaDex · Lectura</div><h1>Manga, manhwa y manhua.</h1><p>Encuentra capítulos en tu idioma. La disponibilidad depende de MangaDex.</p><form id="mangasearch" class="filters"><input id="mangaquery" aria-label="Buscar manga" placeholder="Buscar una obra…" maxlength="120" value="'+esc(q)+'"><select id="mangatype" aria-label="Tipo de obra"><option value="">Todos</option><option value="ja">Manga · Japón</option><option value="ko">Manhwa · Corea</option><option value="zh">Manhua · China</option></select><select id="mangalanguage" aria-label="Idioma de capítulos">'+languages+'</select><button>Buscar</button></form><p class="sub">'+data.total+' obras · '+data.items.length+' en esta página</p>'+(data.items.length?grid(data.items):'<div class="notice">No hay obras con capítulos disponibles para estos filtros.</div>')+paginate('#/mangas',data);
  root.querySelector('#mangatype').value=type;root.querySelector('#mangalanguage').value=language;
  root.querySelector('#mangasearch').onsubmit=e=>{e.preventDefault();location.hash='#/mangas'+params({q:root.querySelector('#mangaquery').value.trim(),tipo:root.querySelector('#mangatype').value,idioma:root.querySelector('#mangalanguage').value});};
  return true;
 }
 if(path.startsWith('/manga/')){
  const data=await api('manga/detail',{id,language,offset});if(!active())return true;
  document.title=data.title+' · Anime local';
  const saved=profiles.current().library[data.path];
  root.innerHTML='<div class="crumb"><a href="#/mangas">Lecturas</a> / '+esc(data.type)+'</div><section class="detail">'+image(data.image,data.title,'class="poster"')+'<div><div class="eyebrow">'+esc(data.type)+' · MangaDex</div><h1>'+esc(data.title)+'</h1><div class="chips">'+data.tags.slice(0,12).map(t=>'<span class="chip">'+esc(t)+'</span>').join('')+'</div><div class="listselect"><label for="readingstatus">Mi lista</label><select id="readingstatus"><option value="">Añadir a mi lista</option>'+statusOptions(saved?.status)+'</select></div></div><p class="synopsis">'+esc(data.synopsis||'Sin sinopsis disponible.')+'</p></section><div class="sectionhead"><h2>Capítulos</h2><select id="chapterlanguage" aria-label="Idioma de capítulos">'+languages+'</select></div><p class="sub">'+data.total+' versiones de capítulos. Puede haber varias traducciones del mismo capítulo.</p><div class="episodelist">'+data.chapters.map(ch=>ch.externalUrl?'<div class="episodeitem">Capítulo '+esc(ch.number||'Especial')+'<small>Disponible en el sitio del editor</small></div>':'<a class="episodeitem" href="#'+esc(ch.path+params({idioma:language,offset}))+'">Capítulo '+esc(ch.number||'Especial')+'<small>'+esc(ch.title||ch.pages+' páginas')+'</small></a>').join('')+'</div>'+(data.chapters.length?'':'<div class="notice">No hay capítulos en este idioma. Prueba otra opción.</div>')+paginate('#'+data.path,data);
  root.querySelector('#readingstatus').value=saved?.status||'';
  root.querySelector('#readingstatus').onchange=e=>{if(e.target.value)profiles.setAnime(data,e.target.value);else profiles.removeAnime(data.path);};
  root.querySelector('#chapterlanguage').value=language;root.querySelector('#chapterlanguage').onchange=e=>location.hash='#'+data.path+params({idioma:e.target.value});
  return true;
 }
 if(path.startsWith('/leer/')){
  const data=await api('manga/chapter',{id});if(!active())return true;
  const lang=['es','es-la','en'].includes(data.language)?data.language:language;
  const feed=await api('manga/detail',{id:data.manga.id,language:lang,offset});if(!active())return true;
  const list=feed.chapters.filter(ch=>!ch.externalUrl), index=list.findIndex(ch=>ch.id===id);
  const chapterLink=ch=>'#'+ch.path+params({idioma:lang,offset});
  const prior=profiles.current().library[data.manga.path];
  profiles.setAnime(data.manga,prior&&prior.status!=='planned'?prior.status:'watching',{lastEpisode:data.id?'/leer/'+data.id:null,lastWatchedAt:Date.now()});
  let page=Math.max(0,Math.min(data.pages.length-1,Math.floor(profiles.current().progress[path]?.time||0))),mode='page';
  document.title=data.manga.title+' · Capítulo '+data.number;
  root.innerHTML='<div class="crumb"><a href="#'+esc(data.manga.path+params({idioma:lang,offset}))+'">'+esc(data.manga.title)+'</a> / Capítulo '+esc(data.number||'Especial')+'</div><div class="sectionhead"><h1>Capítulo '+esc(data.number||'Especial')+'</h1><select id="readmode" aria-label="Modo de lectura"><option value="page">Página por página</option><option value="vertical">Lectura vertical</option></select></div><div class="readercontrols"><button id="pageprevious" class="secondary">← Página</button><select id="readpage" aria-label="Página del capítulo">'+data.pages.map((_,i)=>'<option value="'+i+'">Página '+(i+1)+' / '+data.pages.length+'</option>').join('')+'</select><button id="pagenext" class="secondary">Página →</button></div><p id="readstatus" role="status" class="sub">Cargando página…</p><div id="reader" class="reader"></div><div class="watchbar">'+(index>0?'<a class="button secondary" href="'+esc(chapterLink(list[index-1]))+'">← Capítulo anterior</a>':'')+'<a class="button secondary" href="#'+esc(data.manga.path+params({idioma:lang,offset}))+'">Lista de capítulos</a>'+(index>=0&&index<list.length-1?'<a class="button" href="'+esc(chapterLink(list[index+1]))+'">Siguiente capítulo →</a>':'')+'</div>';
  const reader=root.querySelector('#reader'), select=root.querySelector('#readpage'), status=root.querySelector('#readstatus');
  const attach=img=>{
   img.onload=()=>{if(!active())return;status.textContent='Capítulo guardado en Mi lista.';if(mode==='page')profiles.saveProgress(path,page);};
   img.onerror=()=>{if(active())status.textContent='La imagen no pudo cargar. Vuelve a abrir el capítulo para renovar sus enlaces.';};
  };
  const draw=()=>{
   readerObserver?.disconnect();
   if(mode==='vertical')readerObserver=new IntersectionObserver(entries=>{if(!active())return;const visible=entries.filter(x=>x.isIntersecting).sort((a,b)=>Math.abs(a.boundingClientRect.top)-Math.abs(b.boundingClientRect.top));if(visible[0]){page=Number(visible[0].target.dataset.page);select.value=page;profiles.saveProgress(path,page);}},{rootMargin:'0px 0px -70% 0px',threshold:0});
   select.value=page;root.querySelector('#pageprevious').disabled=page===0;root.querySelector('#pagenext').disabled=page>=data.pages.length-1;
   reader.replaceChildren();status.textContent='Cargando página…';
   const indexes=mode==='vertical'?data.pages.map((_,i)=>i):[page];
   for(const i of indexes){const img=document.createElement('img');img.alt='Página '+(i+1);img.referrerPolicy='no-referrer';img.loading=mode==='vertical'?'lazy':'eager';attach(img);img.dataset.page=i;reader.append(img);img.src=data.pages[i];if(mode==='vertical')readerObserver.observe(img);}
  };
  const change=n=>{page=Math.max(0,Math.min(data.pages.length-1,n));mode='page';root.querySelector('#readmode').value=mode;draw();};
  root.querySelector('#pageprevious').onclick=()=>change(page-1);root.querySelector('#pagenext').onclick=()=>change(page+1);select.onchange=()=>change(Number(select.value));
  root.querySelector('#readmode').onchange=e=>{mode=e.target.value;draw();};
  draw();return true;
 }
 return false;
}
