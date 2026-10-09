let promptEvent,installed=false;
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
let refresh=()=>{};
export function initMobile({hosted=false}={}){
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;refresh();});
 window.addEventListener('appinstalled',()=>{installed=true;promptEvent=null;refresh();});
 if(hosted&&isSecureContext&&'serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});
}
export function renderMobile(root){
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 root.innerHTML='<div class="eyebrow">Anime local · En tu celular</div><section class="mobile-install"><img src="/pwa-icons/icon-192.png" alt="" width="76" height="76"><h1>Tu próxima historia,<br>a un toque.</h1><p>Agrega Anime Local a tu pantalla de inicio y ábrelo en su propia ventana.</p><button id="installmobile" hidden>Instalar Anime Local</button><p id="installstate" class="sub" role="status"></p></section><div class="mobile-install-steps"><article'+(ios?' class="recommended"':'')+'><h2>iPhone / iPad</h2><ol><li>Abre esta web en Safari.</li><li>Toca <strong>Compartir</strong>.</li><li>Elige <strong>Añadir a pantalla de inicio</strong> y confirma.</li></ol></article><article'+(!ios?' class="recommended"':'')+'><h2>Android</h2><ol><li>Abre esta web en Chrome.</li><li>Toca <strong>Instalar Anime Local</strong> si aparece arriba.</li><li>También puedes abrir el menú ⋮ y elegir <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.</li></ol></article></div><div class="notice"><strong>Tu biblioteca en este dispositivo.</strong><p>El catálogo, los capítulos y los videos necesitan internet. Usa exportar/importar en Mi lista para llevar tu biblioteca a otra instalación.</p></div><p class="sub">Se instala desde el navegador. Esta versión no es un archivo APK.</p>';
 const button=root.querySelector('#installmobile'),status=root.querySelector('#installstate');
 const update=()=>{
  if(!button.isConnected)return;
  button.hidden=standalone()||installed||!promptEvent;
  status.textContent=standalone()?'Ya estás usando la app instalada.':installed?'App instalada. Ábrela desde tu pantalla de inicio.':promptEvent?'Lista para instalar desde este navegador.':ios?'Sigue los pasos de Safari que aparecen abajo.':'Si el botón no aparece, usa el menú de tu navegador.';
 };
 refresh=update;update();
 button.onclick=async()=>{
  const event=promptEvent;if(!event)return;
  button.disabled=true;
  try{await event.prompt();const choice=await event.userChoice;promptEvent=null;update();status.textContent=choice.outcome==='accepted'?'Instalación solicitada. Espera a que tu navegador termine.':'Puedes instalarla más tarde desde el menú del navegador.';}
  catch{promptEvent=null;update();status.textContent='Abre el menú de tu navegador para instalar la app.';}
  finally{button.disabled=false;}
 };
}
