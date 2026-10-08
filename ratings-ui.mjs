export const ratingOptions=selected=>'<option value="">Sin nota</option>'+Array.from({length:10},(_,i)=>i+1).map(n=>'<option value="'+n+'" '+(Number(selected)===n?'selected':'')+'>'+n+' / 10</option>').join('');
export function mountRatings({element,item,kind,api,esc,profiles,active=()=>true}){
 const panel=document.createElement('div');panel.className='ratings-panel';
 panel.innerHTML='<div class="mal-rating" aria-live="polite"><span class="sub">Puntuación MyAnimeList</span><div class="mal-result">Consultando MAL…</div></div><div class="personal-rating"><label>Tu nota <select aria-label="Tu nota para '+esc(item.title)+'">'+ratingOptions(profiles.current().library[item.path]?.rating)+'</select></label><small class="rating-feedback" role="status">Guardada en este navegador</small></div>';
 element.append(panel);const result=panel.querySelector('.mal-result'),select=panel.querySelector('select'),feedback=panel.querySelector('.rating-feedback');
 element.querySelector('#animestatus,#readingstatus')?.addEventListener('change',()=>{select.value=profiles.current().library[item.path]?.rating||'';feedback.textContent=select.value?'Nota guardada en Mi lista':'Guardada en este navegador';});
 select.onchange=()=>{try{profiles.setRating(item,select.value?Number(select.value):null);const state=element.querySelector('#animestatus,#readingstatus');if(state)state.value=profiles.current().library[item.path]?.status||'';feedback.textContent=select.value?'Nota guardada en Mi lista':'Nota eliminada';}catch(e){feedback.textContent=e.message;}};
 const show=match=>{result.innerHTML='<a class="mal-value" target="_blank" rel="noopener noreferrer" href="'+esc(match.url)+'"><span>★ '+(match.score===null?'Sin nota':match.score.toFixed(2))+'</span><small>MyAnimeList ↗</small></a><div class="sub">'+esc(match.title)+' · '+Number(match.votes).toLocaleString('es')+' votos</div>';};
 const choose=matches=>{
  result.innerHTML='<label class="sub">Elige la ficha de MAL <select class="mal-match" aria-label="Ficha de MyAnimeList"><option value="">Seleccionar título</option>'+matches.map(m=>'<option value="'+m.id+'">'+esc(m.title)+'</option>').join('')+'</select></label>';
  result.querySelector('select').onchange=async e=>{if(!e.target.value)return;const id=e.target.value;result.textContent='Consultando puntuación…';try{const match=await api('ratings/detail',{kind,id});if(active()&&panel.isConnected)show(match);}catch(error){if(active()&&panel.isConnected)result.textContent=error.message;}};
 };
 (async()=>{try{
  const data=await api('ratings/lookup',{kind,title:item.title,...(item.malId?{id:item.malId}:{})});if(!active()||!panel.isConnected)return;
  if(data.match)show(data.match);else if(data.matches.length)choose(data.matches);else result.textContent='No encontramos una ficha de MAL para este título.';
 }catch{if(active()&&panel.isConnected){result.innerHTML='<span class="sub">MAL no está disponible ahora.</span> <button class="secondary mal-retry">Reintentar</button>';result.querySelector('button').onclick=()=>{panel.remove();mountRatings({element,item,kind,api,esc,profiles,active});};}}})();
 return panel;
}
export async function renderRanking({url,root,api,esc,active}){
 const kind=url.searchParams.get('tipo')==='manga'?'manga':'anime',data=await api('ratings/ranking',{kind});if(!active())return;
 root.innerHTML='<div class="eyebrow">MyAnimeList · Comunidad</div><div class="sectionhead"><h1>Las mejor puntuadas.</h1><div class="ranking-tabs"><a class="button '+(kind==='anime'?'':'secondary')+'" href="#/ranking">Anime</a><a class="button '+(kind==='manga'?'':'secondary')+'" href="#/ranking?tipo=manga">Manga</a></div></div><p>Busca una obra en nuestro catálogo o abre su ficha en MyAnimeList.</p><div class="ranking-list">'+data.items.map(row=>'<article class="ranking-row"><span class="ranking-number">'+row.rank+'</span><div><a class="ranking-title" href="'+esc((kind==='anime'?'#/directorio?q=':'#/mangas?q=')+encodeURIComponent(row.title))+'">'+esc(row.title)+'</a><div class="sub">'+esc(row.info)+'</div></div><strong class="ranking-score">★ '+row.score.toFixed(2)+'</strong><a class="mal-link" href="'+esc(row.url)+'" target="_blank" rel="noopener noreferrer" aria-label="Ver '+esc(row.title)+' en MyAnimeList">MAL ↗</a></article>').join('')+'</div><p class="sub">Puntuaciones consultadas '+esc(new Date(data.fetchedAt).toLocaleDateString('es'))+'.</p>';
}
