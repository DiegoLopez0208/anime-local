import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHome, parseDirectory, parseAnime, parseEpisodePage, imagePath, sourcePath } from './catalog.mjs';
const card = (kind,path,image,title) => '<article class="'+kind+'"><a href="'+path+'"><img src="'+image+'"><h3 class="title">'+title+'</h3></a></article>';
test('home: episodios y animes nuevos, excluyendo bloques promocionales',()=>{
 const html=card('episode','/ver/test-1','/uploads/thumbs/1.jpg','Test 1')+card('anime','/anime/test','/uploads/portadas/1.jpg','Test')+card('anime media','/anime/promo','/uploads/portadas/2.jpg','Promo');
 const result=parseHome(html);assert.equal(result.episodes.length,1);assert.equal(result.anime.length,1);
 assert.equal(result.anime[0].image,'/image/uploads/portadas/1.jpg');
});
test('directorio: resultados, paginacion y filtros',()=>{
 const html='<select id="genero"><option value="accion">Acci&oacute;n</option></select><div class="animes">'+card('anime','/anime/test','/uploads/portadas/1.jpg','Test')+'</div><nav class="pagination"><a href="/directorio?q=test&p=1">1</a><a href="/directorio?q=test&p=2">2</a></nav>';
 const result=parseDirectory(html);assert.equal(result.items.length,1);assert.deepEqual(result.pages,[1,2]);assert.equal(result.genres[0].label,'Acción');
 assert.throws(()=>parseDirectory('<html>Blocked</html>'));
});
test('ficha: metadata, orden y rutas de episodios',()=>{
 const html='<div class="anime-single"><div class="thumb"><img src="/uploads/portadas/1.jpg"></div><h1>Test Series</h1><div class="meta"><span>TV</span><span class="year">2026</span></div><p class="genres"><a>Fantas&iacute;a</a></p><p class="sinopsis">A test synopsis.</p></div><script>var anime_info=["1","test","Test Series",null];var episodes=[2,1];var episodes_details=["Hoy","Ayer"];</script>';
 const result=parseAnime(html,'/anime/test');assert.equal(result.year,'2026');assert.equal(result.episodes[0].path,'/ver/test-1');assert.equal(result.episodes[0].date,'Ayer');assert.ok(result.genres.includes('Fantasía'));
 assert.throws(()=>parseAnime('<script>var episodes=[alert(1)];</script>','/anime/x'));
});
test('episodio: titulo, servidores y navegacion',()=>{
 const result=parseEpisodePage('<h1>A &amp; B 2</h1><div class="episodes-nav"><a href="/ver/a-1">Anterior</a><a href="/anime/a">Listado</a><a href="/ver/a-3">Siguiente</a></div><script>var videos=[["Mega","https://mega.nz/file/abc#key"]];</script>','/ver/a-2');
 assert.equal(result.title,'A & B 2');assert.equal(result.previous,'/ver/a-1');assert.equal(result.next,'/ver/a-3');assert.equal(result.anime,'/anime/a');assert.equal(result.servers.length,1);
});
test('solo rutas del catalogo y portadas, sin recursos publicitarios',()=>{
 assert.equal(imagePath('https://evil.example/ad.jpg'),null);assert.equal(imagePath('/uploads/imgs/banner.jpg'),null);
 assert.equal(imagePath('/uploads/portadas/1.jpg'),'/image/uploads/portadas/1.jpg');
 assert.throws(()=>sourcePath('https://evil.example/anime/x','/anime/'));assert.throws(()=>sourcePath('/anime/<script>','/anime/'));
});
