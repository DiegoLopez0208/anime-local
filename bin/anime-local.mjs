#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const args=process.argv.slice(2);
const cli=args[0]==='--cli';
const file=fileURLToPath(new URL(cli?'../cli.mjs':'../server.mjs',import.meta.url));
const child=spawn(process.execPath,[file,...(cli?args.slice(1):[])],{stdio:'inherit'});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>process.exit(code||0));
if(!cli&&!args.includes('--no-open')){
 const port=Number(process.env.PORT||5189);
 if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error('Invalid PORT');
 const url='http://127.0.0.1:'+port;
 for(let i=0;i<30;i++){
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(1000)});
   if(response.ok){
    const command=process.platform==='win32'?'cmd.exe':process.platform==='darwin'?'open':'xdg-open';
    const launch=spawn(command,process.platform==='win32'?['/c','start','',url]:[url],{stdio:'ignore',windowsHide:true});
    launch.on('error',()=>console.log('Open '+url+' in your browser.'));launch.unref();break;
   }
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
}
process.on('SIGINT',()=>child.kill('SIGINT'));
process.on('SIGTERM',()=>child.kill('SIGTERM'));
