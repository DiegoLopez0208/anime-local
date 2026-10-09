const {app,BrowserWindow,dialog,shell,Menu}=require('electron');
const {spawn}=require('node:child_process');
const {join}=require('node:path');
const {writeFileSync,readFileSync,mkdirSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {externalAllowed}=require('./policy.cjs');
const smoke=process.argv.includes('--smoke'),port=smoke?5199:5198,origin='http://127.0.0.1:'+port;
if(smoke)app.setPath('userData',join(tmpdir(),'anime-local-smoke-'+Date.now()));
let child,window,quitting=false;
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
 app.on('window-all-closed',()=>app.quit());
 app.on('before-quit',()=>{quitting=true;child?.kill();});
 app.whenReady().then(start).catch(error=>{
  if(smoke){console.error(error);child?.kill();app.exit(1);}
  else{dialog.showErrorBox('Anime Local',error.message);app.quit();}
 });
}
async function start(){
 Menu.setApplicationMenu(null);
 child=spawn(process.execPath,[join(app.getAppPath(),'local-server.mjs')],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1',PORT:String(port)},stdio:['ignore','pipe','pipe'],windowsHide:true});
 let errors='';
 child.stderr.on('data',chunk=>{errors=(errors+chunk.toString()).slice(-6000);});
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('El servidor local no pudo iniciar. '+errors)),15000);
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.once('exit',code=>{clearTimeout(timer);reject(Error('El servidor local terminó ('+code+'). '+errors));});
  child.stdout.on('data',chunk=>{if(chunk.toString().includes('Reproductor local:')){clearTimeout(timer);resolve();}});
 });
 let size={width:1360,height:900};
 try{const saved=JSON.parse(readFileSync(join(app.getPath('userData'),'window.json'),'utf8'));if(saved.width>=900&&saved.width<=4000&&saved.height>=640&&saved.height<=2500)size=saved;}catch{}
 window=new BrowserWindow({...size,minWidth:900,minHeight:640,title:'Anime Local',backgroundColor:'#101315',icon:join(__dirname,'icon.ico'),show:false,autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 window.webContents.session.setPermissionRequestHandler((contents,permission,callback)=>callback(contents.getURL().startsWith(origin+'/')&&permission==='fullscreen'));
 window.webContents.setWindowOpenHandler(({url})=>{if(externalAllowed(url,origin))shell.openExternal(url);return {action:'deny'};});
 window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin){event.preventDefault();if(externalAllowed(url,origin))shell.openExternal(url);}});
 window.on('close',()=>{if(smoke)return;const bounds=window.getNormalBounds();try{mkdirSync(app.getPath('userData'),{recursive:true});writeFileSync(join(app.getPath('userData'),'window.json'),JSON.stringify({width:bounds.width,height:bounds.height}));}catch{}});
 child.on('exit',()=>{if(!quitting&&!smoke){dialog.showErrorBox('Anime Local','El servidor local se cerró. Vuelve a abrir la app.');app.quit();}});
 if(!smoke)window.once('ready-to-show',()=>window.show());
 await window.loadURL(origin+(smoke?'/#/mi-lista':'/'));
 if(smoke){
  let result;
  for(let i=0;i<100;i++){
   result=await window.webContents.executeJavaScript("({title:document.title,library:!!document.getElementById('libraryfilter'),node:typeof require,process:typeof process,sidebar:!!document.querySelector('.app-sidebar')})");
   if(result.library)break;await new Promise(r=>setTimeout(r,100));
  }
  const license=await fetch(origin+'/license').then(r=>r.text());
  result={...result,license:license.startsWith('MIT License'),packaged:app.isPackaged,version:app.getVersion(),webPreferences:window.webContents.getLastWebPreferences()};
  if(process.env.ANIME_LOCAL_SMOKE_REPORT)writeFileSync(process.env.ANIME_LOCAL_SMOKE_REPORT,JSON.stringify(result,null,2));
  console.log(JSON.stringify({title:result.title,library:result.library,node:result.node,process:result.process,license:result.license,packaged:result.packaged,version:result.version}));
  if(!result.library||result.node!=='undefined'||result.process!=='undefined'||!result.license||!result.webPreferences.sandbox)throw Error('Desktop smoke failed.');
  if(process.env.ANIME_LOCAL_SMOKE_SCREENSHOT)writeFileSync(process.env.ANIME_LOCAL_SMOKE_SCREENSHOT,(await window.webContents.capturePage()).toPNG());
  quitting=true;child.kill();window.destroy();app.quit();
 }
}
