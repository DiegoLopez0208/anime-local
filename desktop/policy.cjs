function externalAllowed(value,origin){
 try{const u=new URL(value);if(u.username||u.password)return false;
 if(u.origin===origin&&u.pathname==='/license')return true;
 return u.protocol==='https:'&&(
  u.origin==='https://myanimelist.net'&&/^\/(anime|manga)\/\d+(?:\/[^/]*)?\/?$/.test(u.pathname)||
  u.origin==='https://github.com'&&u.pathname.startsWith('/DiegoLopez0208/anime-local/releases/')
 );
 }catch{return false;}
}
module.exports={externalAllowed};
