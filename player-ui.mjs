const KEY = 'anime-local-player-v1';
export const DEFAULT_SKIP = 85;
export const SKIP_LABELS = { op: 'Saltar opening', 'mixed-op': 'Saltar opening', recap: 'Saltar intro', ed: 'Saltar ending', 'mixed-ed': 'Saltar ending' };

export function activeSkip(ranges, time) {
  return (ranges || []).find(range => time >= range.start - 0.5 && time < range.end - 0.5) || null;
}
export function formatTime(value) {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const total = Math.floor(value), h = Math.floor(total / 3600), m = Math.floor(total % 3600 / 60), s = total % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}
function readPrefs() {
  try { return { autonext: true, autoskip: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { autonext: true, autoskip: false }; }
}
function writePrefs(value) { try { localStorage.setItem(KEY, JSON.stringify(value)); } catch {} }

const CSS = `
.vp{position:relative;background:#000;aspect-ratio:16/9;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.vp video,.vp iframe{position:absolute;inset:0;width:100%;height:100%;aspect-ratio:auto;border:0;background:#000;object-fit:contain}
.vp-zone{position:absolute;top:0;bottom:64px;width:34%;z-index:2}.vp-zone.l{left:0}.vp-zone.r{right:0}
.vp-center{position:absolute;inset:0;margin:auto;width:68px;height:68px;border-radius:50%;background:#000a;color:#fff;font-size:26px;padding:0;z-index:3;border:1px solid #fff3;backdrop-filter:blur(6px)}
.vp-toast{position:absolute;top:14%;left:50%;transform:translateX(-50%);background:#000b;color:#fff;padding:7px 14px;border-radius:20px;font-size:13px;z-index:6;pointer-events:none;opacity:0;transition:opacity .2s;white-space:nowrap}.vp-toast.on{opacity:1}
.vp-top{position:absolute;top:0;right:0;left:0;display:flex;justify-content:flex-end;padding:calc(8px + env(safe-area-inset-top,0px)) calc(8px + env(safe-area-inset-right,0px)) 0 8px;background:linear-gradient(#000a,#0000);z-index:5;transition:opacity .2s}
.vp-bar{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;gap:6px;padding:26px calc(10px + env(safe-area-inset-right,0px)) calc(8px + env(safe-area-inset-bottom,0px)) calc(10px + env(safe-area-inset-left,0px));background:linear-gradient(#0000,#000c);z-index:5;transition:opacity .2s}
.vp button.vp-btn{background:transparent;color:#fff;border:0;padding:0;min-width:44px;height:44px;border-radius:10px;font-size:15px;display:inline-flex;align-items:center;justify-content:center}
.vp button.vp-btn:active{background:#fff2}.vp-time{font-size:12px;color:#e8ece9;min-width:84px;text-align:center;font-variant-numeric:tabular-nums}
.vp input[type=range]{flex:1;min-width:0;height:44px;padding:0;margin:0;background:transparent;accent-color:var(--accent,#f0cb78);border:0}
.vp.idle .vp-bar,.vp.idle .vp-top{opacity:0;pointer-events:none}.vp.idle{cursor:none}
.vp-actions{position:absolute;right:calc(12px + env(safe-area-inset-right,0px));bottom:calc(76px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;align-items:flex-end;gap:8px;z-index:6}
.vp.idle .vp-actions{bottom:calc(18px + env(safe-area-inset-bottom,0px))}
.vp-actions button{background:#101315e8;color:#fff;border:1px solid #fff4;border-radius:10px;padding:0 16px;height:44px;font-size:14px;font-weight:650;backdrop-filter:blur(8px)}
.vp-actions button.primary{background:var(--accent,#f0cb78);color:#17201d;border-color:transparent}
.vp-menu{position:absolute;right:calc(10px + env(safe-area-inset-right,0px));bottom:calc(72px + env(safe-area-inset-bottom,0px));background:#101315f4;border:1px solid #fff3;border-radius:12px;padding:6px 14px;z-index:7;min-width:230px}
.vp-menu label{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:12px 0;font-size:13px;color:#eef1ef;border-bottom:1px solid #fff1}.vp-menu label:last-child{border:0}.vp-menu input,.vp-menu select{accent-color:var(--accent,#f0cb78);width:auto}
.vp.is-embed .vp-zone,.vp.is-embed .vp-center,.vp.is-embed .vp-bar,.vp.is-embed .vp-skip{display:none}.vp.is-embed .vp-top{position:absolute;pointer-events:none;background:none}.vp.is-embed .vp-top button{pointer-events:auto;background:#101315cc}.vp.is-embed .vp-actions{bottom:calc(14px + env(safe-area-inset-bottom,0px))}
.vp.is-embed.idle .vp-top{opacity:1;pointer-events:none}
.vp.fs{position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;aspect-ratio:auto;z-index:1000;border-radius:0}
body.vp-lock{overflow:hidden;overscroll-behavior:none}body.vp-lock .app-sidebar,body.vp-lock header,body.vp-lock footer{visibility:hidden}
.videoarea:has(.vp.fs){overflow:visible}
@media(max-width:760px){.vp-time{min-width:74px;font-size:11px}.vp-bar{gap:2px}.vp button.vp-btn{min-width:40px}.vp-center{width:60px;height:60px}}
@media(max-width:760px) and (orientation:landscape){.vp-zone{bottom:56px}}
@media(prefers-reduced-motion:reduce){.vp *{transition:none!important}}
`;

export function playerMarkup() {
  return '<div class="vp" tabindex="0" aria-label="Reproductor de video">'
    + '<video id="video" playsinline preload="metadata"></video>'
    + '<iframe id="embed" hidden title="Reproductor del proveedor" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"></iframe>'
    + '<div class="vp-zone l" data-zone="-10"></div><div class="vp-zone r" data-zone="10"></div>'
    + '<button class="vp-center" aria-label="Reproducir o pausar">▶</button><div class="vp-toast" role="status"></div>'
    + '<div class="vp-top"><button class="vp-btn" data-act="fs" aria-label="Pantalla completa">⛶</button></div>'
    + '<div class="vp-actions"><button class="vp-skip" data-act="skip" hidden></button><button data-act="cancelnext" hidden>Cancelar</button><button class="primary" data-act="next" hidden></button></div>'
    + '<div class="vp-menu" hidden><label>Siguiente automático<input type="checkbox" data-pref="autonext"></label><label>Saltar opening solo<input type="checkbox" data-pref="autoskip"></label><label>Velocidad<select data-act="speed"><option>0.75</option><option selected>1</option><option>1.25</option><option>1.5</option><option>2</option></select></label></div>'
    + '<div class="vp-bar"><button class="vp-btn" data-act="play" aria-label="Reproducir o pausar">▶</button><button class="vp-btn" data-zone="-10" aria-label="Retroceder 10 segundos">↺10</button><input type="range" min="0" max="1000" value="0" aria-label="Posición"><span class="vp-time">0:00 / 0:00</span><button class="vp-btn" data-act="plus" aria-label="Adelantar 85 segundos">+85</button><button class="vp-btn" data-act="menu" aria-label="Ajustes del reproductor">⚙</button></div>'
    + '</div>';
}

let styled = false;
export function initPlayer({ root, nextPath, onNext }) {
  if (!styled) { const style = document.createElement('style'); style.textContent = CSS; document.head.append(style); styled = true; }
  const $ = selector => root.querySelector(selector), video = $('video'), frame = $('iframe');
  const seek = $('input[type=range]'), time = $('.vp-time'), toast = $('.vp-toast'), menu = $('.vp-menu');
  const skipButton = $('.vp-skip'), nextButton = $('[data-act=next]'), cancelButton = $('[data-act=cancelnext]');
  const prefs = readPrefs();
  let ranges = [], idleTimer = 0, toastTimer = 0, countdown = 0, remaining = 0, embed = false, scrubbing = false, autoSkipped = new Set(), tap = { at: 0, side: 0, timer: 0 };

  nextButton.textContent = nextPath ? 'Siguiente capítulo ▶' : '';
  for (const box of menu.querySelectorAll('[data-pref]')) { box.checked = !!prefs[box.dataset.pref]; box.onchange = () => { prefs[box.dataset.pref] = box.checked; writePrefs(prefs); }; }

  const say = text => { toast.textContent = text; toast.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on'), 1300); };
  const wake = () => {
    root.classList.remove('idle'); clearTimeout(idleTimer);
    if (!video.paused && !embed && menu.hidden) idleTimer = setTimeout(() => root.classList.add('idle'), 3200);
  };
  const jump = seconds => { if (embed) return; video.currentTime = Math.max(0, Math.min((video.duration || Infinity) - 0.2, video.currentTime + seconds)); say((seconds > 0 ? '+' : '') + seconds + ' s'); wake(); };
  const toggle = () => { if (embed) return; if (video.paused) video.play().catch(() => {}); else video.pause(); wake(); };
  const goNext = () => { if (!nextPath) return; stopCountdown(); onNext(nextPath); };
  function stopCountdown() { clearInterval(countdown); countdown = 0; cancelButton.hidden = true; nextButton.textContent = nextPath ? 'Siguiente capítulo ▶' : ''; }
  function startCountdown() {
    if (!nextPath || !prefs.autonext || countdown) return;
    remaining = 8; cancelButton.hidden = false;
    const paintCount = () => { nextButton.textContent = 'Siguiente en ' + remaining + ' ▶'; };
    paintCount();
    countdown = setInterval(() => { remaining -= 1; if (remaining <= 0) goNext(); else paintCount(); }, 1000);
  }

  // Pantalla completa propia: la API nativa muestra el aviso del navegador con la dirección del sitio.
  // Un cambio de capítulo también dispara popstate, pero con otro hash: ahí la pantalla completa debe seguir.
  let enterHash = location.hash;
  const onPop = () => { if (root.classList.contains('fs') && location.hash === enterHash) setFull(false, false); };
  function setFull(on, fromButton = true) {
    if (on) enterHash = location.hash;
    root.classList.toggle('fs', on); document.body.classList.toggle('vp-lock', on);
    try { sessionStorage.setItem('anime-local-fs', on ? '1' : '0'); } catch {}
    if (on && fromButton !== 'restore') history.pushState({ vpfs: 1 }, '', location.href);
    if (!on && fromButton && history.state?.vpfs) history.back();
    wake();
  }
  window.addEventListener('popstate', onPop);

  function paint() {
    const playing = !video.paused && !video.ended;
    for (const button of [$('.vp-center'), $('[data-act=play]')]) button.textContent = playing ? '❚❚' : '▶';
    $('.vp-center').style.display = playing || embed ? 'none' : '';
  }
  function tick() {
    const t = video.currentTime || 0, d = video.duration || 0;
    if (!scrubbing) seek.value = d ? Math.round(t / d * 1000) : 0;
    time.textContent = formatTime(t) + ' / ' + formatTime(d);
    const range = activeSkip(ranges, t), reachesEnd = range && d && range.end >= d - 4;
    if (range && !(reachesEnd && nextPath)) {
      skipButton.hidden = false; skipButton.textContent = SKIP_LABELS[range.type] || 'Saltar';
      skipButton.onclick = () => { video.currentTime = range.end; say('Saltado'); };
      if (prefs.autoskip && /op/.test(range.type) && !autoSkipped.has(range.start)) { autoSkipped.add(range.start); video.currentTime = range.end; say('Opening saltado'); }
    } else skipButton.hidden = true;
    const nearEnd = nextPath && d > 0 && (d - t <= 40 || reachesEnd);
    nextButton.hidden = !(nextPath && (nearEnd || video.ended || countdown));
  }
  video.addEventListener('timeupdate', tick);
  video.addEventListener('durationchange', tick);
  video.addEventListener('play', () => { paint(); wake(); stopCountdown(); });
  video.addEventListener('pause', () => { paint(); wake(); });
  video.addEventListener('ended', () => { paint(); tick(); nextButton.hidden = !nextPath; startCountdown(); });
  video.addEventListener('seeking', () => { if (countdown && video.currentTime < (video.duration || 0) - 2) stopCountdown(); });
  seek.addEventListener('input', () => { scrubbing = true; if (video.duration) time.textContent = formatTime(seek.value / 1000 * video.duration) + ' / ' + formatTime(video.duration); });
  seek.addEventListener('change', () => { if (video.duration) video.currentTime = seek.value / 1000 * video.duration; scrubbing = false; });

  root.addEventListener('pointermove', wake);
  root.addEventListener('click', event => {
    const target = event.target.closest('[data-act],[data-zone],.vp-center,[data-pref],input,select');
    if (!target) { if (embed) return; if (root.classList.contains('idle')) wake(); else if (!menu.hidden) menu.hidden = true; else root.classList.add('idle'); return; }
    const act = target.dataset.act;
    if (target.classList.contains('vp-center') || act === 'play') toggle();
    else if (act === 'fs') setFull(!root.classList.contains('fs'));
    else if (act === 'plus') jump(DEFAULT_SKIP);
    else if (act === 'next') goNext();
    else if (act === 'cancelnext') { stopCountdown(); say('Autoplay cancelado'); }
    else if (act === 'menu') { menu.hidden = !menu.hidden; wake(); }
    else if (target.dataset.zone && target.classList.contains('vp-zone')) {
      const side = Number(target.dataset.zone), now = Date.now();
      if (now - tap.at < 320 && tap.side === side) { clearTimeout(tap.timer); tap.at = 0; jump(side); }
      else tap = { at: now, side, timer: setTimeout(() => { tap.at = 0; if (root.classList.contains('idle')) wake(); else root.classList.add('idle'); }, 320) };
    } else if (target.dataset.zone) jump(Number(target.dataset.zone));
  });
  $('[data-act=speed]').onchange = event => { video.playbackRate = Number(event.target.value); say(event.target.value + '×'); };

  const onKey = event => {
    if (!document.body.contains(root) || /^(input|select|textarea)$/i.test(event.target.tagName) && event.target.type !== 'range' || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'escape' && root.classList.contains('fs')) { setFull(false); event.preventDefault(); return; }
    const handled = { ' ': toggle, k: toggle, arrowleft: () => jump(-5), arrowright: () => jump(5), j: () => jump(-10), l: () => jump(10),
      f: () => setFull(!root.classList.contains('fs')), n: goNext, m: () => { video.muted = !video.muted; say(video.muted ? 'Silencio' : 'Sonido'); },
      s: () => (skipButton.hidden ? jump(DEFAULT_SKIP) : skipButton.click()) }[key];
    if (handled && (!embed || key === 'f' || key === 'n')) { event.preventDefault(); handled(); }
  };
  document.addEventListener('keydown', onKey);

  try { if (sessionStorage.getItem('anime-local-fs') === '1') setFull(true, 'restore'); } catch {}
  paint(); wake();

  return {
    ranges(list) { ranges = Array.isArray(list) ? list : []; autoSkipped = new Set(); tick(); },
    mode(kind) {
      embed = kind === 'embed'; root.classList.toggle('is-embed', embed); frame.hidden = !embed; video.hidden = embed;
      if (embed) { video.pause(); video.removeAttribute('src'); video.load(); skipButton.hidden = true; nextButton.hidden = !nextPath; } else frame.removeAttribute('src');
      paint(); wake();
    },
    embed(url) { frame.src = url; },
    destroy() {
      clearInterval(countdown); clearTimeout(idleTimer); clearTimeout(toastTimer); clearTimeout(tap.timer);
      document.removeEventListener('keydown', onKey); window.removeEventListener('popstate', onPop);
      document.body.classList.remove('vp-lock');
    }
  };
}
