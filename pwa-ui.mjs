let promptEvent,installed=false;
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIos=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
let refresh=()=>{},entry,isHosted=false;
function update(){
 if(entry)entry.hidden=!isHosted||standalone()||installed;
 refresh();
}
async function requestInstallation(button,status){
 const event=promptEvent;
 if(!event)return false;
 promptEvent=null;button.disabled=true;let message='';
 try{
  await event.prompt();const choice=await event.userChoice;
  if(choice.outcome==='accepted'){
   installed=true;
   message='Instalación solicitada. Abre la app cuando tu navegador termine.';
  }else message='Puedes instalarla más tarde desde el menú ⋮ de Chrome.';
 }catch{
  message='Abre el menú ⋮ de Chrome y toca Instalar aplicación o Añadir a pantalla de inicio.';
 }finally{
  button.disabled=false;update();if(status&&message)status.textContent=message;
 }
 return true;
}
export function initMobile({hosted=false}={}){
 isHosted=hosted;
 entry=document.getElementById('installentry');
 if(entry){
  entry.hidden=!hosted||standalone();
  entry.onclick=()=>{
   if(promptEvent)requestInstallation(entry);
   else location.hash='#/celular';
  };
 }
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;update();});
 window.addEventListener('appinstalled',()=>{installed=true;promptEvent=null;update();});
 // Keep sticky reader controls below the header when mobile buttons wrap.
 const header=document.querySelector('header');
 if(header&&'ResizeObserver' in window)new ResizeObserver(()=>{
  document.documentElement.style.setProperty('--app-header-height',Math.ceil(header.getBoundingClientRect().height)+'px');
 }).observe(header);
 if(hosted&&isSecureContext&&'serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});
}
export function renderMobile(root){
 const ios=isIos();
 document.title='Instalar Anime Local';
 root.innerHTML='<div class="eyebrow">Anime local · En tu celular</div><section class="mobile-install"><img src="/pwa-icons/icon-192-v2.png" alt="" width="76" height="76"><h1>Anime Local,<br>en tu pantalla de inicio.</h1><p>Instala la app para abrir tus series y lecturas desde su propio icono.</p><button id="installmobile">Instalar Anime Local</button><p id="installstate" class="sub" role="status"></p></section><div id="installsteps" class="mobile-install-steps"><article'+(ios?' class="recommended"':'')+'><h2 tabindex="-1">iPhone / iPad</h2><ol><li>Abre esta web en Safari.</li><li>Toca <strong>Compartir</strong>.</li><li>Elige <strong>Añadir a pantalla de inicio</strong> y confirma.</li></ol></article><article'+(!ios?' class="recommended"':'')+'><h2 tabindex="-1">Android</h2><ol><li>Abre esta web directamente en <strong>Chrome</strong>.</li><li>Toca <strong>Instalar Anime Local</strong> si el navegador ofrece la instalación.</li><li>Si no aparece el diálogo, abre el menú <strong>⋮</strong> de Chrome, elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong> y confirma.</li></ol><p class="sub">Si llegaste desde WhatsApp, Instagram u otra app, abre este enlace en Chrome.</p></article></div><div class="notice"><strong>Tu biblioteca en este dispositivo.</strong><p>El catálogo, los capítulos y los videos necesitan internet. Usa exportar/importar en Mi lista para llevar tu biblioteca a otra instalación.</p></div><p class="sub">La instalación se realiza desde tu navegador.</p>';
 const steps=root.querySelector('.mobile-install-steps');if(!ios)steps.prepend(steps.lastElementChild);
 const button=root.querySelector('#installmobile'),status=root.querySelector('#installstate');
 const render=()=>{
  if(!button.isConnected)return;
  button.hidden=standalone()||installed;
  button.textContent=promptEvent?'Instalar Anime Local':'Ver pasos de instalación';
  status.textContent=standalone()?'Ya estás usando la app instalada.':installed?'Instalación solicitada. Abre la app cuando tu navegador termine.':promptEvent?'Toca el botón y confirma en el diálogo de tu navegador.':ios?'En Safari: Compartir → Añadir a pantalla de inicio.':'En Chrome: menú ⋮ → Instalar aplicación o Añadir a pantalla de inicio.';
 };
 refresh=render;render();
 button.onclick=async()=>{
  if(promptEvent){await requestInstallation(button,status);return;}
  steps.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  steps.querySelector('.recommended h2').focus({preventScroll:true});
 };
}
