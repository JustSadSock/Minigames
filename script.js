/* ============================================================
   MINIGAMES — RETRO PIXEL CABINET
   - Loads real games from ./games/<slug>/module.js (manifest + mount/unmount)
   - Pixel canvases for UI panels (header/status/footer)
   - Canvas thumbnails, avatar editor (pixel face)
   - Safe WebAudio (only after gesture)
   - Two-per-row grid, keyboard nav
   ============================================================ */
(function () {
  'use strict';

  /* -------------------- State -------------------- */
  const $ = (sel, p = document) => p.querySelector(sel);
  const $$ = (sel, p = document) => Array.from(p.querySelectorAll(sel));

  const state = {
    sound: true,
    bloom: true,
    scan: true,
    noise: true,
    volume: 0.35,
    credits: 0,
    palette: 'pico8',
    games: [],             // cards (only loaded)
    loadedGames: {},       // slug -> module
    slugsTried: new Set(),
    focusedIndex: 0,
    ui: {}
  };

  /* -------------------- LocalStorage -------------------- */
  const storageKey = 'minigames.arcade.ui';
  const saveState = () => {
    const s = { sound: state.sound, bloom: state.bloom, scan: state.scan, noise: state.noise, volume: state.volume, palette: state.palette, nick: state.ui.nickDisplay?.textContent || '@player', credits: state.credits };
    localStorage.setItem(storageKey, JSON.stringify(s));
  };
  const loadState = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const s = JSON.parse(raw);
      Object.assign(state, s);
    } catch {}
  };

  /* -------------------- WebAudio -------------------- */
  let actx, master, sfxGain, audioUnlocked = false;
  const ensureAudio = () => {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain();
    sfxGain = actx.createGain();
    sfxGain.gain.value = state.sound ? state.volume : 0;
    sfxGain.connect(master);
    master.connect(actx.destination);
    // Гул автомата включаем только после разблокировки аудио
  };
  function unlockAudio() {
    if (!actx) ensureAudio();
    if (audioUnlocked) return;
    const startHum = () => {
      const hum = actx.createOscillator();
      const humGain = actx.createGain();
      hum.type = 'sine';
      hum.frequency.value = 50;
      humGain.gain.value = 0.006;
      hum.connect(humGain).connect(master);
      hum.start();
    };
    actx.resume().then(()=>{ audioUnlocked = true; startHum(); }).catch(()=>{ /* ignore */ });
  }

  const sfx = {
    beep(freq = 880, dur = 0.06) {
      if (!audioUnlocked || !state.sound) return;
      ensureAudio();
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.value = 0.0001;
      o.connect(g).connect(sfxGain);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.2, actx.currentTime + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.stop(actx.currentTime + dur + 0.02);
    },
    click() { this.beep(220, 0.02); },
    confirm() { this.beep(660, 0.07); },
    deny() { this.beep(110, 0.12); },
    coin() {
      if (!audioUnlocked || !state.sound) return;
      ensureAudio();
      // «Монетка»: скат тире-генератор + щелчок
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(1200, actx.currentTime);
      o.frequency.exponentialRampToValueAtTime(200, actx.currentTime + 0.25);
      g.gain.value = 0.0001;
      o.connect(g).connect(sfxGain);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.35, actx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.28);
      o.stop(actx.currentTime + 0.3);
    }
  };

  /* -------------------- Utils -------------------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad2 = (n) => String(n).padStart(2, '0');
  const rng = (seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2**32)(0xC0FFEE);
  const seededRng = (seed) => {
    let x = seed >>> 0;
    return () => (x = (x * 1664525 + 1013904223) >>> 0) / 2**32;
  };

  /* -------------------- Color helpers -------------------- */
  function hexToRgb(hex) {
    if (!hex) return { r: 0, g: 0, b: 0 };
    const m = hex.replace('#', '').trim();
    const n = m.length === 3
      ? m.split('').map(c => c + c).join('')
      : m.padEnd(6, '0').slice(0, 6);
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    return { r, g, b };
  }
  function withAlpha(hex, a = 1) {
    const { r, g, b } = hexToRgb(hex);
    const alpha = Math.max(0, Math.min(1, a));
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* -------------------- Avatar Identicon -------------------- */
  function drawAvatar(canvas, nick) {
    const ctx = canvas.getContext('2d', { alpha: false });
    const size = 32, cell = 4, n = size / cell;
    const rand = seededRng(
      Array.from(nick).reduce((a,c)=>((a<<5)-a + c.charCodeAt(0))>>>0, 2166136261)
    );
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#031c1c'; ctx.fillRect(0,0,size,size);
    for (let y=0; y<n; y++) {
      for (let x=0; x<n/2; x++) {
        const on = rand() > 0.5;
        const col = on ? `hsl(${Math.floor(rand()*360)},100%,${rand()*50+35}%)` : '#052';
        ctx.fillStyle = col;
        if (on) {
          ctx.fillRect(x*cell, y*cell, cell, cell);
          ctx.fillRect((n-1-x)*cell, y*cell, cell, cell);
        }
      }
    }
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(20,255,210,0.25)';
    ctx.fillRect(0,0,size,size);
    ctx.globalCompositeOperation = 'source-over';
  }

  /* -------------------- CRT Canvas Noise -------------------- */
  function setupCrtCanvas() {
    const crt = $('#crt-canvas');
    const dpr = Math.max(devicePixelRatio || 1, 1);
    function resize() {
      crt.width = innerWidth * dpr;
      crt.height = innerHeight * dpr;
      crt.style.width = innerWidth + 'px';
      crt.style.height = innerHeight + 'px';
    }
    resize();
    addEventListener('resize', resize);
    const ctx = crt.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let t = 0;
    (function loop(){
      requestAnimationFrame(loop);
      t += 1;
      if (!state.noise) { ctx.clearRect(0,0,crt.width, crt.height); return; }
      const w = crt.width, h = crt.height;
      const img = ctx.createImageData(128, 72);
      for (let i=0; i<img.data.length; i+=4) {
        const n = (Math.random()*255)|0;
        img.data[i] = n; img.data[i+1] = n; img.data[i+2] = n; img.data[i+3] = (state.bloom ? 14 : 8); // чуть тише
      }
      ctx.globalCompositeOperation = 'screen';
      ctx.putImageData(img, (w-128)/2 + Math.sin(t*0.02)*6, (h-72)/2 + Math.cos(t*0.018)*6);
      ctx.drawImage(crt,0,0,w,h);
      ctx.globalCompositeOperation = 'source-over';
    })();
  }

  /* -------------------- Palettes -------------------- */
  const palettes = {
    // Мягкие ретро-палитры без кислотности
    pico8: ['#1d2b53', '#7e2553', '#008751', '#5f574f', '#c2c3c7', '#fff1e8', '#ff004d', '#ffa300', '#ffec27', '#00e756', '#29adff', '#83769c', '#ff77a8', '#ffccaa', '#2e4057', '#223e36'],
    c64:   ['#000000','#352879','#218d3b','#55a049','#8e2f4f','#5e5c9d','#83769c','#ffffff','#68372b','#70a4b2','#6f3d86','#588d43','#352879','#b8c76f','#6f4f25','#433900'],
    gb:    ['#0f380f','#306230','#8bac0f','#9bbc0f','#0f380f','#306230','#8bac0f','#9bbc0f'],
    nes:   ['#7C7C7C','#5454b8','#34349c','#4428BC','#8c3a7a','#a83434','#a86a34','#784020','#503000','#2a7c4a','#2a6848','#285848','#244058','#000000','#BCBCBC','#7aa8f8']
  };

  function applyPalette(name) {
    state.palette = name;
    document.documentElement.classList.remove('palette-pico8','palette-c64','palette-gb','palette-nes');
    document.documentElement.classList.add(`palette-${name}`);
    $('#paletteName').textContent = (name === 'pico8' ? 'PICO-8' : name.toUpperCase());
    // Перерисовать превью игр под палитру
    state.games.forEach(g => drawGamePreview(g.canvas, g.previewSeed, name));
    saveState();
    // Перерисовать панельные пиксельные слои
    drawPanelCanvas($('#px-header'), 'header');
    drawPanelCanvas($('#px-status'), 'status');
    drawPanelCanvas($('#px-footer'), 'footer');
  }

  /* -------------------- Games List -------------------- */
  // Укажи здесь слаги реальных игр из /games (мы подгрузим manifest динамически).
  const GAME_SLUGS = ['pong','runner','breakout','rogue','tactics'];

  function createGameCard({ slug, title, caption = '', hiscore = 0 }, idx) {
    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.tabIndex = 0;
    wrap.setAttribute('role','listitem');
    wrap.dataset.index = idx;
    wrap.innerHTML = `
      <div class="card-title">${(title||slug||'GAME').toUpperCase()}</div>
      <canvas class="card-canvas" width="160" height="120" aria-hidden="true"></canvas>
      <div class="card-footer">
        <div class="hiscore">${caption ? caption : `HI-SCORE ${pad2(Math.floor(hiscore/100))}${String(hiscore%100).padStart(2,'0')}`}</div>
        <button class="start">START</button>
      </div>
    `;
    const cv = $('.card-canvas', wrap);
    const seed = Math.floor(rng()*1e9) ^ idx * 2654435761;
    drawGamePreview(cv, seed, state.palette);
    const startBtn = $('.start', wrap);
    startBtn.addEventListener('click', () => tryStartGame(idx));
    wrap.addEventListener('focus', () => focusCard(idx));
    wrap.addEventListener('pointerdown', () => focusCard(idx));
    return { el: wrap, canvas: cv, previewSeed: seed };
  }

  function drawGamePreview(canvas, seed, paletteName) {
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
    const W = canvas.width, H = canvas.height;
    const rnd = seededRng(seed);
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
    // Безопасная палитра (fallback, чтобы не было undefined)
    const pal = (palettes && palettes[paletteName] && palettes[paletteName].length)
      ? palettes[paletteName] : palettes.pico8;
    const bg = pal[(Math.abs(seed>>3)) % pal.length] || '#1d2b53';
    const fg = pal[(Math.abs(seed>>7)) % pal.length] || '#c2c3c7';
    const ex = pal[(Math.abs(seed>>11)) % pal.length] || '#ffec27';
    // Градиент (rgba вместо хакового '#xxxxxxee')
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, withAlpha(bg, 0.9));
    g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    // Звёзды
    for (let i=0;i<160;i++){
      const x = (rnd()*W)|0, y=(rnd()*H)|0;
      const c = i%7==0? ex : '#ffffff';
      ctx.fillStyle = c;
      ctx.fillRect(x,y,1,1);
      if ((i&3)==0) ctx.fillRect(x+1,y,1,1);
    }
    // «Игровой объект» — всё кодом
    ctx.fillStyle = fg;
    const cx = (W/2)|0, cy=(H/2)|0;
    for (let r=24; r>3; r-=3) {
      ctx.globalAlpha = 0.08 + (r%6===0?0.06:0);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Пиксельный корабль/щит
    const S = 2, B = [
      "0010000",
      "0111000",
      "1111100",
      "1111110",
      "0111111",
      "0111111",
      "1111111",
      "0010100",
      "0100010",
    ];
    ctx.fillStyle = ex;
    const ox = cx - (B[0].length*S/2)|0, oy = cy - (B.length*S/2)|0;
    for(let y=0;y<B.length;y++){
      for(let x=0;x<B[0].length;x++){
        if (B[y][x]==='1') ctx.fillRect(ox+x*S, oy+y*S, S, S);
      }
    }
    // Нижняя «земля/панель»
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(0,H-20,W,20);
    for(let x=0;x<W;x+=8){
      ctx.fillStyle = withAlpha(pal[(x>>3)%pal.length] || '#5f574f', .55);
      ctx.fillRect(x,H-2,4,2);
    }
  }

  /* -------------------- Pixel panels for UI -------------------- */
  function drawPanelCanvas(canvas, kind) {
    if (!canvas) return;
    const dpr = Math.max(1, devicePixelRatio || 1);
    const w = canvas.parentElement.clientWidth || innerWidth;
    const h = canvas.parentElement.clientHeight || 60;
    canvas.width = Math.max(1, w * dpr);
    canvas.height = Math.max(1, h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    // Палитра
    const pal = palettes[state.palette] || palettes.pico8;
    const base = pal[0] || '#1d2b53';
    const edge = pal[4] || '#5f574f';
    // Подложка
    ctx.fillStyle = withAlpha(base, 0.25);
    ctx.fillRect(0,0,w,h);
    // Шахматный паттерн
    ctx.fillStyle = withAlpha(edge, 0.08);
    for (let y=0; y<h; y+=6) for (let x= (y/6)%2?0:3; x<w; x+=6) ctx.fillRect(x,y,3,3);
    // Рамки 2px
    ctx.strokeStyle = withAlpha('#000', 0.8);
    ctx.lineWidth = 2;
    ctx.strokeRect(1,1,w-2,h-2);
    ctx.strokeStyle = withAlpha(edge, 0.7);
    ctx.strokeRect(3,3,w-6,h-6);
  }

  function resizePanels() {
    drawPanelCanvas($('#px-header'), 'header');
    drawPanelCanvas($('#px-status'), 'status');
    drawPanelCanvas($('#px-footer'), 'footer');
  }

  /* -------------------- Build UI -------------------- */
  function build() {
    loadState();
    state.ui.nickDisplay = $('#nickDisplay');
    state.ui.avatar = $('#avatar');
    state.ui.credits = $('#credits');
    state.ui.coinLed = $('#coinLed');
    state.ui.gamesGrid = $('#gamesGrid');
    state.ui.hud = $('#hud');
    state.ui.gameOverlay = $('#gameOverlay');
    state.ui.gameMount = $('#gameMount');
    state.ui.gameTitle = $('#gameTitle');

    // ник
    $('#nickDisplay').textContent = state.ui.nickDisplay?.textContent || (JSON.parse(localStorage.getItem(storageKey)||'{}').nick || '@player');
    drawAvatar(state.ui.avatar, $('#nickDisplay').textContent);
    state.ui.credits.textContent = pad2(state.credits);

    // UI pixel panels
    resizePanels();

    // Games: попытаемся загрузить каждый slug и, если модуль зарегистрировался, добавим карточку
    state.games = [];
    let idx = 0;
    GAME_SLUGS.forEach((slug) => {
      tryLoadManifest(slug).then((man) => {
        const card = createGameCard({ slug, title: man.name || slug, caption: man.caption || '' }, idx++);
        state.games.push(card);
        state.ui.gamesGrid.appendChild(card.el);
        if (state.games.length === 1) focusCard(0, false);
      }).catch(()=>{/* пропускаем отсутствующие игры */});
    });

    // Palettes + toggles
    applyPalette(state.palette);
    $('#paletteSelect').value = state.palette;
    $('#soundToggle').checked = state.sound;
    $('#bloomToggle').checked = state.bloom;
    $('#scanToggle').checked = state.scan;
    $('#noiseToggle').checked = state.noise;
    $('#volumeRange').value = String(state.volume);

    // Effects
    document.querySelector(':root').style.setProperty('--scan-alpha', state.scan ? '0.06' : '0.0'); // деликатнее
    setupCrtCanvas();
    if (!state.bloom) document.body.classList.add('no-bloom');
  }

  /* -------------------- Focus / Navigation -------------------- */
  function focusCard(i, smooth=true) {
    state.focusedIndex = clamp(i, 0, state.games.length-1);
    state.games.forEach((g, ix)=> g.el.dataset.focused = (ix===state.focusedIndex) ? 'true' : 'false');
    const el = state.games[state.focusedIndex]?.el;
    if (!el) return;
    el.focus({ preventScroll:true });
    el.scrollIntoView({ block:'nearest', behavior: smooth? 'smooth' : 'auto' });
    // не трогаем звук до первого жеста
  }
  function moveFocus(delta) {
    // два столбца: вверх/вниз с шагом 2, влево/вправо с шагом 1
    const cols = 2;
    const rows = Math.ceil(state.games.length/cols);
    let idx = state.focusedIndex;
    if (delta==='up') idx -= cols;
    if (delta==='down') idx += cols;
    if (delta==='left') idx -= 1;
    if (delta==='right') idx += 1;
    focusCard(clamp(idx,0,state.games.length-1));
  }

  /* -------------------- Start Game / Credits -------------------- */
  function tryStartGame(idx) {
    if (state.credits<=0) {
      hud('INSERT COIN', 900);
      sfx.deny();
      return;
    }
    state.credits -= 1;
    state.ui.credits.textContent = pad2(state.credits);
    saveState();
    sfx.confirm();
    launchGame(idx);
  }

  function launchGame(idx) {
    const card = state.games[idx];
    if (!card) return;
    const slug = GAME_SLUGS[idx] || card.el.querySelector('.card-title')?.textContent?.toLowerCase().replace(/\s+/g,'-') || '';
    openGameBySlug(slug);
  }

  function hud(text, ms=1000) {
    const h = state.ui.hud;
    h.textContent = text;
    h.style.opacity = '1';
    setTimeout(()=>{ h.style.opacity='0'; }, ms);
  }

  /* -------------------- Game Loader -------------------- */
  function tryLoadManifest(slug) {
    return new Promise((resolve, reject) => {
      if (!slug || state.slugsTried.has(slug)) {
        // может уже зарегистрирован
        const mod = getRegisteredModule(slug);
        if (mod && mod.manifest) return resolve(mod.manifest);
      }
      state.slugsTried.add(slug);
      const existing = getRegisteredModule(slug);
      if (existing && existing.manifest) return resolve(existing.manifest);
      const s = document.createElement('script');
      s.src = `./games/${slug}/module.js`;
      s.async = true;
      s.onload = () => {
        const mod = getRegisteredModule(slug);
        if (mod && mod.manifest) resolve(mod.manifest);
        else reject(new Error(`Модуль ${slug} не зарегистрирован`));
      };
      s.onerror = () => reject(new Error(`Не удалось загрузить games/${slug}/module.js`));
      document.head.appendChild(s);
    });
  }
  function getRegisteredModule(slug) {
    const scope = (window.__Minigames || window.__DeepFlyGames || {});
    return scope[slug];
  }
  let currentGame = null, currentSlug = '';
  async function openGameBySlug(slug) {
    try {
      const mod = getRegisteredModule(slug) || await (async()=>{ await tryLoadManifest(slug); return getRegisteredModule(slug); })();
      if (!mod || !mod.mount) throw new Error('Bad module');
      // Показать оверлей
      state.ui.gameOverlay.classList.remove('hidden');
      state.ui.gameOverlay.setAttribute('aria-hidden','false');
      state.ui.gameTitle.textContent = (mod.manifest?.name || slug).toUpperCase();
      // Очистить предыдущее
      state.ui.gameMount.innerHTML = '';
      // Контекст для игр (минимальный)
      const ctx = {
        root: state.ui.gameMount,
        store: { get:(k,d)=>{ try{ return JSON.parse(localStorage.getItem('game.'+slug+'.'+k)) ?? d; }catch{ return d; } },
                 set:(k,v)=>localStorage.setItem('game.'+slug+'.'+k, JSON.stringify(v)) },
        bus: new EventTarget()
      };
      if (currentGame && currentGame.unmount) { try{ currentGame.unmount(); }catch{} }
      currentGame = await mod.mount(state.ui.gameMount, ctx);
      currentSlug = slug;
      location.hash = `#game=${encodeURIComponent(slug)}`;
    } catch (e) {
      hud(`CAN'T LOAD: ${slug}`, 1200);
    }
  }
  function closeGame() {
    if (currentGame && currentGame.unmount) { try{ currentGame.unmount(); }catch{} }
    currentGame = null; currentSlug='';
    state.ui.gameOverlay.classList.add('hidden');
    state.ui.gameOverlay.setAttribute('aria-hidden','true');
    state.ui.gameMount.innerHTML = '';
    if (location.hash.includes('game=')) history.replaceState(null,'', location.pathname + location.search);
  }
  // deep link
  function syncFromHash() {
    const m = location.hash.match(/game=([\w-]+)/);
    if (m) openGameBySlug(m[1]);
    else closeGame();
  }

  /* -------------------- Settings -------------------- */
  function openSettings() {
    const dlg = $('#settingsModal');
    dlg.showModal();
    sfx.click();
  }
  function applySettingsFromUI(ok) {
    const dlg = $('#settingsModal');
    if (!ok) { dlg.close(); sfx.deny(); return; }
    const snd = $('#soundToggle').checked;
    const blm = $('#bloomToggle').checked;
    const scn = $('#scanToggle').checked;
    const nse = $('#noiseToggle').checked;
    const vol = parseFloat($('#volumeRange').value);
    const pal = $('#paletteSelect').value;
    state.sound = snd;
    state.bloom = blm;
    state.scan  = scn;
    state.noise = nse;
    state.volume = vol;
    sfxGain && (sfxGain.gain.value = snd ? vol : 0);
    document.querySelector(':root').style.setProperty('--scan-alpha', scn ? '0.06' : '0.0');
    document.body.classList.toggle('no-bloom', !blm);
    applyPalette(pal);
    saveState();
    dlg.close();
    sfx.confirm();
  }

  /* -------------------- Events -------------------- */
  function bindEvents() {
    $('#insertCoinBtn').addEventListener('click', ()=>{
      unlockAudio();
      state.credits = clamp(state.credits + 1, 0, 99);
      state.ui.credits.textContent = pad2(state.credits);
      state.ui.coinLed.style.filter = 'brightness(2)';
      setTimeout(()=> state.ui.coinLed.style.filter = '', 120);
      sfx.coin(); saveState();
    });
    $('#changeNickBtn').addEventListener('click', ()=>{
      sfx.click();
      const curr = $('#nickDisplay').textContent || '@player';
      let nick = prompt('Новый ник (без пробелов, 3-16 символов):', curr.replace(/^@/,''));
      if (!nick) return;
      nick = nick.trim().replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'').slice(0,16);
      if (nick.length<3) { hud('НИК КОРОТКИЙ', 800); sfx.deny(); return; }
      $('#nickDisplay').textContent = '@'+nick;
      drawAvatar(state.ui.avatar, '@'+nick);
      saveState();
      sfx.confirm();
    });
    $('#settingsBtn').addEventListener('click', openSettings);
    $('#avatarBtn').addEventListener('click', openAvatar);
    $('#startBtn').addEventListener('click', ()=> tryStartGame(state.focusedIndex));
    $('#randomBtn').addEventListener('click', ()=>{
      const i = (Math.random()*state.games.length)|0;
      focusCard(i); sfx.click();
    });
    $('#muteBtn').addEventListener('click', ()=>{
      state.sound = !state.sound;
      sfxGain && (sfxGain.gain.value = state.sound ? state.volume : 0);
      hud(state.sound?'SOUND ON':'SOUND OFF', 700);
      saveState();
    });
    $('#scanBtn').addEventListener('click', ()=>{
      state.scan = !state.scan;
      document.querySelector(':root').style.setProperty('--scan-alpha', state.scan ? '0.06' : '0.0');
      hud(state.scan?'SCANLINES ON':'SCANLINES OFF', 700);
      saveState();
    });
    $('#btnBackToMenu').addEventListener('click', ()=>{ closeGame(); });

    // Навигация с клавиатуры
    addEventListener('keydown', (e)=>{
      if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus('up'); }
      if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus('down'); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); moveFocus('left'); }
      if (e.key === 'ArrowRight') { e.preventDefault(); moveFocus('right'); }
      if (e.key.toLowerCase() === 'c') { $('#insertCoinBtn').click(); }
      if (e.key.toLowerCase() === 'm') { $('#muteBtn').click(); }
      if (e.key.toLowerCase() === 'r') { $('#randomBtn').click(); }
      if (e.key === 'Enter') { tryStartGame(state.focusedIndex); }
      if (e.key === 'Escape') {
        const sdlg = $('#settingsModal');
        const adlg = $('#avatarModal');
        if (sdlg.open) { sdlg.close(); sfx.deny(); return; }
        if (adlg.open) { adlg.close('cancel'); sfx.deny(); return; }
        if (!state.ui.gameOverlay.classList.contains('hidden')) { closeGame(); return; }
      }
    });
    // Разблокировка аудио на первый жест
    addEventListener('pointerdown', unlockAudio, { once:true, passive:true });
    addEventListener('keydown', unlockAudio, { once:true });

    // Навигация кнопками
    $$('[data-nav]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const dir = btn.dataset.nav;
        moveFocus(dir);
      });
    });

    // Settings modal submission
    // чтобы «Enter» в форме не закрывал модалку как cancel
    $('#settingsModal').addEventListener('cancel', (e)=>{ e.preventDefault(); });
    // Интерцепт кликов по OK/Cancel
    $('.px-modal-inner').addEventListener('click', (e)=>{
      if (e.target && e.target.tagName === 'BUTTON') {
        const v = e.target.value;
        if (v === 'ok') applySettingsFromUI(true);
        if (v === 'cancel') applySettingsFromUI(false);
      }
    });
    // Изменение палитры в рантайме
    $('#paletteSelect').addEventListener('change', (e)=>{
      applyPalette(e.target.value);
      sfx.click();
    });

    // Hash routing for games
    window.addEventListener('hashchange', syncFromHash);
    syncFromHash();

    // Resize pixel panels
    addEventListener('resize', resizePanels, { passive:true });
  }

  /* -------------------- Avatar Editor -------------------- */
  const AV = {
    skin: ['#f7e6d3','#eac9a2','#d8a577','#b37b4f','#8f5a36','#6b3f26'],
    hairColors: ['#2b2b2b','#4b3a2a','#6b4b3b','#8c6a4a','#b58a5a','#e0c08a','#c72e2e','#6e37a6','#2e6eb0'],
    eyes: [
      (ctx,S,x,y)=>{ ctx.fillStyle='#0b0b0f'; ctx.fillRect(x+5*S,y+6*S,S,S); ctx.fillRect(x+10*S,y+6*S,S,S); },
      (ctx,S,x,y)=>{ ctx.fillStyle='#0b0b0f'; ctx.fillRect(x+5*S,y+6*S,2*S,S); ctx.fillRect(x+9*S,y+6*S,2*S,S); },
      (ctx,S,x,y)=>{ ctx.fillStyle='#0b0b0f'; ctx.fillRect(x+5*S,y+6*S,S,2*S); ctx.fillRect(x+10*S,y+6*S,S,2*S); },
      (ctx,S,x,y)=>{ ctx.fillStyle='#0b0b0f'; ctx.fillRect(x+5*S,y+6*S,2*S,2*S); ctx.fillRect(x+9*S,y+6*S,2*S,2*S); },
    ],
    mouths: [
      (ctx,S,x,y)=>{ ctx.fillStyle='#7a3b2a'; ctx.fillRect(x+7*S,y+10*S,S,S); },
      (ctx,S,x,y)=>{ ctx.fillStyle='#7a3b2a'; ctx.fillRect(x+7*S,y+10*S,2*S,S); },
      (ctx,S,x,y)=>{ ctx.fillStyle='#7a3b2a'; ctx.fillRect(x+7*S,y+10*S,3*S,S); },
      (ctx,S,x,y)=>{ ctx.fillStyle='#7a3b2a'; ctx.fillRect(x+7*S,y+11*S,2*S,S); },
    ],
    hairStyles: [
      (ctx,S,x,y,color)=>{ ctx.fillStyle=color; for(let i=3;i<13;i++) ctx.fillRect(x+i*S,y+2*S,S,S); for(let i=4;i<12;i++) ctx.fillRect(x+i*S,y+3*S,S,S); },
      (ctx,S,x,y,color)=>{ ctx.fillStyle=color; for(let i=3;i<13;i++) ctx.fillRect(x+i*S,y+2*S,S,S); for(let i=4;i<12;i++) ctx.fillRect(x+i*S,y+3*S,S,S); ctx.fillRect(x+4*S,y+4*S,S,S); ctx.fillRect(x+11*S,y+4*S,S,S); },
      (ctx,S,x,y,color)=>{ ctx.fillStyle=color; for(let i=3;i<13;i++) ctx.fillRect(x+i*S,y+2*S,S,S); for(let i=4;i<12;i++) ctx.fillRect(x+i*S,y+3*S,S,S); ctx.fillRect(x+13*S,y+4*S,S,S); ctx.fillRect(x+14*S,y+5*S,S,S); },
      (ctx,S,x,y,color)=>{ ctx.fillStyle=color; for(let i=3;i<13;i++) ctx.fillRect(x+i*S,y+2*S,S,S); for(let i=4;i<12;i++) ctx.fillRect(x+i*S,y+3*S,S,S); [5,7,9,11].forEach(ix=>ctx.fillRect(x+ix*S,y+1*S,S,S)); },
      (ctx,S,x,y,color)=>{ ctx.fillStyle=color; for(let i=3;i<13;i++) ctx.fillRect(x+i*S,y+2*S,S,S); for(let i=4;i<12;i++) ctx.fillRect(x+i*S,y+3*S,S,S); for(let j=3;j<6;j++) ctx.fillRect(x+3*S,y+j*S,S,S); },
      (ctx,S,x,y,color)=>{ ctx.fillStyle=color; for(let i=3;i<13;i++) ctx.fillRect(x+i*S,y+2*S,S,S); for(let i=4;i<12;i++) ctx.fillRect(x+i*S,y+3*S,S,S); ctx.fillRect(x+3*S,y+4*S,S,S); ctx.fillRect(x+12*S,y+4*S,S,S); ctx.fillRect(x+3*S,y+5*S,S,S); ctx.fillRect(x+12*S,y+5*S,S,S); },
    ]
  };
  let avatarData = { skin:0, hairStyle:0, hairColor:0, eyes:0, mouth:0 };
  function drawAvatarEditorPreview(canvas, data) {
    const ctx = canvas.getContext('2d');
    const W=16,H=16,S=8, x=0, y=0;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // bg
    ctx.fillStyle = '#0b0f14'; ctx.fillRect(0,0,canvas.width,canvas.height);
    // head
    const skin = AV.skin[data.skin] || AV.skin[0];
    const rows=[[5,10],[4,11],[3,12],[3,12],[3,12],[3,12],[4,11],[5,10]];
    for(let i=0;i<rows.length;i++){ const [a,b]=rows[i]; for(let xx=a;xx<b;xx++) ctx.fillStyle=skin, ctx.fillRect((x+xx)*S,(y+3+i)*S,S,S); }
    for(let xx=6;xx<10;xx++) ctx.fillRect((x+xx)*S,(y+11)*S,S,S);
    ctx.fillRect((x+2)*S,(y+6)*S,S,S); ctx.fillRect((x+13)*S,(y+6)*S,S,S);
    // hair
    const hcol = AV.hairColors[data.hairColor] || AV.hairColors[0];
    AV.hairStyles[data.hairStyle%AV.hairStyles.length](ctx,S,x,y,hcol);
    // eyes
    AV.eyes[data.eyes%AV.eyes.length](ctx,S,x,y);
    // mouth
    AV.mouths[data.mouth%AV.mouths.length](ctx,S,x,y);
    // shine
    ctx.fillStyle='rgba(255,255,255,.15)'; ctx.fillRect((x+5)*S,(y+4)*S,S,S);
  }
  function applyAvatarToHeader() {
    drawAvatar(state.ui.avatar, $('#nickDisplay').textContent);
  }
  function openAvatar() {
    const dlg = $('#avatarModal');
    const skinSel = $('#skinSelect'), hairSel = $('#hairSelect'), hairColSel = $('#hairColorSelect'), eyesSel = $('#eyesSelect'), mouthSel = $('#mouthSelect');
    skinSel.innerHTML = AV.skin.map((c,i)=>`<option value="${i}">${i+1}</option>`).join('');
    hairSel.innerHTML = AV.hairStyles.map((_,i)=>`<option value="${i}">${i+1}</option>`).join('');
    hairColSel.innerHTML = AV.hairColors.map((c,i)=>`<option value="${i}">${i+1}</option>`).join('');
    eyesSel.innerHTML = AV.eyes.map((_,i)=>`<option value="${i}">${i+1}</option>`).join('');
    mouthSel.innerHTML = AV.mouths.map((_,i)=>`<option value="${i}">${i+1}</option>`).join('');
    const persisted = JSON.parse(localStorage.getItem('avatar.data')||'null');
    if (persisted) avatarData = persisted;
    skinSel.value = avatarData.skin; hairSel.value = avatarData.hairStyle; hairColSel.value = avatarData.hairColor; eyesSel.value = avatarData.eyes; mouthSel.value = avatarData.mouth;
    const editor = $('#avatarEditor');
    const redraw = ()=> drawAvatarEditorPreview(editor, avatarData);
    [skinSel,hairSel,hairColSel,eyesSel,mouthSel].forEach(sel=>{
      sel.onchange = ()=>{ avatarData.skin=+skinSel.value; avatarData.hairStyle=+hairSel.value; avatarData.hairColor=+hairColSel.value; avatarData.eyes=+eyesSel.value; avatarData.mouth=+mouthSel.value; redraw(); };
    });
    redraw();
    dlg.showModal();
    dlg.addEventListener('click', (e)=>{
      if (e.target && e.target.tagName==='BUTTON') {
        if (e.target.value==='save') {
          localStorage.setItem('avatar.data', JSON.stringify(avatarData));
          applyAvatarToHeader();
          dlg.close();
          sfx.confirm();
        } else if (e.target.value==='cancel') {
          dlg.close(); sfx.deny();
        }
      }
    }, { once:true });
  }

  /* -------------------- Init -------------------- */
  document.addEventListener('DOMContentLoaded', ()=>{
    build();
    bindEvents();
  });

})();
