import { readFile } from 'node:fs/promises';
const types={
 '/manifest.webmanifest':'application/manifest+json; charset=utf-8',
 '/sw.js':'text/javascript; charset=utf-8',
 '/offline.html':'text/html; charset=utf-8',
 '/pwa-icons/icon-192.png':'image/png',
 '/pwa-icons/icon-512.png':'image/png',
 '/pwa-icons/maskable-512.png':'image/png',
 '/pwa-icons/apple-180.png':'image/png'
};
export function pwaAsset(path){return Object.hasOwn(types,path)?{file:new URL('./public'+path,import.meta.url),type:types[path]}:null;}
export async function servePwa(req,res){
 const url=new URL(req.url,'http://localhost');
 const path=req.query?.asset||url.searchParams.get('asset')||url.pathname;
 const asset=pwaAsset(path);if(!asset)return false;
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return true;}
 const headers={'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'};
 if(path==='/sw.js')headers['Service-Worker-Allowed']='/';
 if(path==='/offline.html')headers['Content-Security-Policy']="default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
 const body=await readFile(asset.file);res.writeHead(200,headers).end(req.method==='HEAD'?undefined:body);return true;
}
