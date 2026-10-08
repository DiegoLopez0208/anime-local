import { createServer } from 'node:http';
import handler from './api/index.mjs';
createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:5190');let route,action='',path='',id='',page='',file='';
 if(url.pathname==='/')route='home';
 else if(url.pathname==='/reproductor')route='manual';
 else if(['/ratings-ui.mjs','/previews.mjs'].includes(url.pathname))route=url.pathname.slice(1,-4);
 else if(url.pathname==='/manga-ui.mjs')route='manga-ui';
 else if(url.pathname==='/profiles.mjs')route='profiles';
 else if(url.pathname.startsWith('/manga-cover/')){route='manga-cover';[, ,id,file]=url.pathname.split('/');}
 else if(url.pathname.startsWith('/manga-page/')){route='manga-image';[, ,id,page]=url.pathname.split('/');}
 else if(url.pathname.startsWith('/image/')){route='image';path=url.pathname.slice(7);}
 else if(url.pathname.startsWith('/preview-video/')){route='preview-video';id=url.pathname.split('/')[2];}
 else if(url.pathname.startsWith('/video/')){route='video';id=url.pathname.slice(7);}
 else if(url.pathname.startsWith('/api/')){route='api';action=url.pathname.slice(5);}
 else {res.writeHead(404).end();return;}
 req.query={route,action,path,id,page,file};handler(req,res);
}).listen(5190,'127.0.0.1',()=>console.log('Cloud adapter test: http://127.0.0.1:5190'));
