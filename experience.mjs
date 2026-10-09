const KEY='anime-local-settings-v1';
export function settings(){try{const value=JSON.parse(localStorage.getItem(KEY)||'{}');return {density:value.density==='compact'?'compact':'comfortable',readerWidth:[720,900,1100].includes(value.readerWidth)?value.readerWidth:900};}catch{return {density:'comfortable',readerWidth:900};}}
function apply(){const value=settings();document.documentElement.dataset.density=value.density;document.documentElement.style.setProperty('--reader-width',value.readerWidth+'px');}
export function initExperience(){
 apply();const dialog=document.getElementById('preferences');
 document.getElementById('preferencesopen').onclick=()=>dialog.showModal();document.getElementById('preferencesclose').onclick=()=>dialog.close();
 const density=document.getElementById('density'),width=document.getElementById('readerwidth');
 density.value=settings().density;width.value=String(settings().readerWidth);
 const save=()=>{localStorage.setItem(KEY,JSON.stringify({density:density.value,readerWidth:Number(width.value)}));apply();};
 density.onchange=save;width.onchange=save;
 document.addEventListener('keydown',event=>{if(event.key==='/'&&!/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName)&&!document.querySelector('dialog[open]')){event.preventDefault();document.getElementById('query').focus();}});
}
export function mountFavorite({element,item,profiles}){
 const button=document.createElement('button');button.className='secondary favorite-action';button.type='button';
 const update=()=>{const favorite=profiles.current().library[item.path]?.favorite;button.textContent=favorite?'♥ En favoritos':'♡ Favorito';button.setAttribute('aria-pressed',String(!!favorite));};update();
 button.onclick=()=>{profiles.setFavorite(item,!profiles.current().library[item.path]?.favorite);const select=element.querySelector('#animestatus,#readingstatus');if(select)select.value=profiles.current().library[item.path]?.status||'';update();};
 element.append(button);element.querySelector('#animestatus,#readingstatus')?.addEventListener('change',update);
}
export function renderDesktop(root){
 root.innerHTML='<div class="eyebrow">Anime local · Windows</div><section class="desktop-intro"><div><h1>Tu biblioteca.<br>En su propia ventana.</h1><p>Instala Anime Local y abre tus series y lecturas desde el escritorio. El servidor local viene incluido.</p><div class="intro-actions"><a class="button" href="https://github.com/DiegoLopez0208/anime-local/releases/latest/download/Anime-Local-Windows-Setup.exe">Descargar para Windows</a><a class="button secondary" href="https://github.com/DiegoLopez0208/anime-local/releases/latest/download/Anime-Local-Windows-x64.zip">Versión portable</a></div><p class="sub">Windows x64 · v0.4.0 · No requiere Node.js · Sin firma digital</p></div><div class="desktop-preview"><div class="window-dots"><i></i><i></i><i></i><span>Anime Local</span></div><div class="preview-library"><span>Mi biblioteca</span><strong>Lo que sigue,<br>a un clic.</strong><div class="preview-books"><i></i><i></i><i></i></div><span>Anime · Lecturas · Favoritos</span></div></div></section><div class="desktop-benefits"><article><span>01</span><h2>Abre y continúa</h2><p>Biblioteca, notas y progreso guardados en la app.</p></article><article><span>02</span><h2>Lee a tu ritmo</h2><p>Cinco páginas preparadas, modo de foco y controles de teclado.</p></article><article><span>03</span><h2>Todo incluido</h2><p>Reproductor, lector y servidor local. VLC es opcional.</p></article></div><div class="notice"><strong>Lleva tu lista contigo.</strong><p>Exporta la biblioteca desde la web e impórtala en la app. Cada versión guarda sus datos por separado. El catálogo y la reproducción necesitan internet.</p></div>';
}
export function enhanceReader({root,total,page,onNavigate}){
 const controller=new AbortController(),controls=root.querySelector('.readercontrols');
 controls.prepend(root.querySelector('#readmode'));
 controls.insertAdjacentHTML('beforeend','<button id="readerfocus" class="secondary" aria-pressed="false">Modo foco</button>');
 controls.insertAdjacentHTML('afterend','<div class="reading-progress"><span id="readingposition"></span><div><i id="readingbar"></i></div><small>← / → cambiar · Esc salir del foco</small></div>');
 const button=root.querySelector('#readerfocus');
 const focus=value=>{document.body.classList.toggle('reading-focus',value);button.setAttribute('aria-pressed',String(value));button.textContent=value?'Salir del foco':'Modo foco';};
 button.onclick=()=>focus(!document.body.classList.contains('reading-focus'));
 document.addEventListener('keydown',event=>{
  if(/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName)||document.querySelector('dialog[open]'))return;
  if(event.key==='Escape'){focus(false);return;}
  if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();onNavigate(event.key==='ArrowRight'?1:-1);}
 },{signal:controller.signal});
 return {update(value){root.querySelector('#readingposition').textContent='Página '+(value+1)+' de '+total;root.querySelector('#readingbar').style.width=((value+1)/total*100)+'%';},close(){controller.abort();document.body.classList.remove('reading-focus');}};
}
