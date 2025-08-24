/* ============================================================
   MINIGAMES — FULL ARCADE UI, PURE CODE RENDER
   - Canvas thumbnails (no images)
   - WebAudio SFX (no assets)
   - CRT layers (scanlines, vignette, flicker, noise)
   - Palette switch, bloom, settings modal
   - Keyboard nav, two-per-row grid, mobile scaling
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
    games: [],
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
  let actx, master, sfxGain;
  const ensureAudio = () => {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain();
    sfxGain = actx.createGain();
    sfxGain.gain.value = state.sound ? state.volume : 0;
    sfxGain.connect(master);
    master.connect(actx.destination);
    // Фоновый гул автомата (низкая громкость)
    const hum = actx.createOscillator();
    const humGain = actx.createGain();
    hum.type = 'sine';
    hum.frequency.value = 50; // 50Гц словно трансформатор
    humGain.gain.value = 0.008;
    hum.connect(humGain).connect(master);
    hum.start();
  };

  const sfx = {
    beep(freq = 880, dur = 0.06) {
      if (!state.sound) return;
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
      if (!state.sound) return;
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
        img.data[i] = n; img.data[i+1] = n; img.data[i+2] = n; img.data[i+3] = (state.bloom?20:10);
      }
      ctx.globalCompositeOperation = 'screen';
      ctx.putImageData(img, (w-128)/2 + Math.sin(t*0.02)*6, (h-72)/2 + Math.cos(t*0.018)*6);
      ctx.drawImage(crt,0,0,w,h);
      ctx.globalCompositeOperation = 'source-over';
    })();
  }

  /* -------------------- Palettes -------------------- */
  const palettes = {
    pico8: ['#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8', '#ff004d', '#ffa300', '#ffec27', '#00e756', '#29adff', '#83769c', '#ff77a8', '#ffccaa', '#00b543'],
    c64:   ['#000000','#352879','#218d3b','#55a049','#8e2f4f','#5e5c9d','#83769c','#ffffff','#68372b','#70a4b2','#6f3d86','#588d43','#352879','#b8c76f','#6f4f25','#433900'],
    gb:    ['#0f380f','#306230','#8bac0f','#9bbc0f','#0f380f','#306230','#8bac0f','#9bbc0f'],
    nes:   ['#7C7C7C','#0000FC','#0000BC','#4428BC','#940084','#A80020','#A81000','#881400','#503000','#007800','#006800','#005800','#004058','#000000','#BCBCBC','#0078F8']
  };

  function applyPalette(name) {
    state.palette = name;
    document.documentElement.classList.remove('palette-pico8','palette-c64','palette-gb','palette-nes');
    document.documentElement.classList.add(`palette-${name}`);
    $('#paletteName').textContent = name.toUpperCase().replace('PICO8','PICO-8');
    // Перерисовать превью игр под палитру
    state.games.forEach(g => drawGamePreview(g.canvas, g.previewSeed, name));
    saveState();
  }

  /* -------------------- Games List -------------------- */
  const sourceGames = [
    { id:'space-blaster', title:'SPACE BLASTER', hiscore: 12840 },
    { id:'dungeon-run',  title:'DUNGEON RUN',  hiscore:  8450 },
    { id:'turbo-racer',  title:'TURBO RACER',  hiscore: 15200 },
    { id:'puzzle-core',  title:'PUZZLE CORE',  hiscore:  4390 },
    { id:'sky-guardian', title:'SKY GUARDIAN', hiscore: 10480 },
    { id:'neon-tennis',  title:'NEON TENNIS',  hiscore:  9920 }
  ];

  function createGameCard({ id, title, hiscore }, idx) {
    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.tabIndex = 0;
    wrap.setAttribute('role','listitem');
    wrap.dataset.index = idx;
    wrap.innerHTML = `
      <div class="card-title">${title}</div>
      <canvas class="card-canvas" width="160" height="120" aria-hidden="true"></canvas>
      <div class="card-footer">
        <div class="hiscore">HI-SCORE ${pad2(Math.floor(hiscore/100))}${String(hiscore%100).padStart(2,'0')}</div>
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
    // Фон — звёзды/шахматка/грид в зависимости от игры (по seed)
    const pal = palettes[paletteName] || palettes.pico8;
    const bg = pal[(seed>>3) % pal.length];
    const fg = pal[(seed>>7) % pal.length];
    const ex = pal[(seed>>11) % pal.length];
    // Градиентный космос
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, bg+'ee'); g.addColorStop(1, '#000000ff');
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
      ctx.globalAlpha = 0.12 + (r%6===0?0.08:0);
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
    ctx.fillStyle = '#00000088';
    ctx.fillRect(0,H-20,W,20);
    for(let x=0;x<W;x+=8){
      ctx.fillStyle = pal[(x>>3)%pal.length]+'88';
      ctx.fillRect(x,H-2,4,2);
    }
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

    if (state.ui.nick) state.ui.nick.textContent = state.ui.nick.textContent || '@player';
    $('#nickDisplay').textContent = state.ui.nickDisplay?.textContent || (JSON.parse(localStorage.getItem(storageKey)||'{}').nick || '@player');
    drawAvatar(state.ui.avatar, $('#nickDisplay').textContent);
    state.ui.credits.textContent = pad2(state.credits);

    // Games
    state.games = [];
    sourceGames.forEach((g, idx) => {
      const card = createGameCard(g, idx);
      state.games.push(card);
      state.ui.gamesGrid.appendChild(card.el);
    });
    focusCard(state.focusedIndex);

    // Palettes + toggles
    applyPalette(state.palette);
    $('#paletteSelect').value = state.palette;
    $('#soundToggle').checked = state.sound;
    $('#bloomToggle').checked = state.bloom;
    $('#scanToggle').checked = state.scan;
    $('#noiseToggle').checked = state.noise;
    $('#volumeRange').value = String(state.volume);

    // Effects
    document.querySelector(':root').style.setProperty('--scan-alpha', state.scan ? '0.12' : '0.0');
    setupCrtCanvas();
    if (!state.bloom) document.body.classList.add('no-bloom');
  }

  /* -------------------- Focus / Navigation -------------------- */
  function focusCard(i, smooth=true) {
    state.focusedIndex = clamp(i, 0, state.games.length-1);
    state.games.forEach((g, ix)=> g.el.dataset.focused = (ix===state.focusedIndex) ? 'true' : 'false');
    const el = state.games[state.focusedIndex].el;
    el.focus({ preventScroll:true });
    el.scrollIntoView({ block:'nearest', behavior: smooth? 'smooth' : 'auto' });
    sfx.click();
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
    const g = sourceGames[idx];
    // Показываем псевдо-загрузку
    hud(`LOADING ${g.title}...`, 1200);
    // Контент игры не требуется — здесь «демо»
    setTimeout(()=> hud(`${g.title} — COMING SOON`, 1200), 1200);
  }

  function hud(text, ms=1000) {
    const h = state.ui.hud;
    h.textContent = text;
    h.style.opacity = '1';
    setTimeout(()=>{ h.style.opacity='0'; }, ms);
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
    document.querySelector(':root').style.setProperty('--scan-alpha', scn ? '0.12' : '0.0');
    document.body.classList.toggle('no-bloom', !blm);
    applyPalette(pal);
    saveState();
    dlg.close();
    sfx.confirm();
  }

  /* -------------------- Events -------------------- */
  function bindEvents() {
    $('#insertCoinBtn').addEventListener('click', ()=>{
      ensureAudio();
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
      document.querySelector(':root').style.setProperty('--scan-alpha', state.scan ? '0.12' : '0.0');
      hud(state.scan?'SCANLINES ON':'SCANLINES OFF', 700);
      saveState();
    });

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
        const dlg = $('#settingsModal');
        if (dlg.open) { dlg.close(); sfx.deny(); }
      }
    });

    // Навигация кнопками
    $$('[data-nav]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const dir = btn.dataset.nav;
        moveFocus(dir);
      });
    });

    // Settings modal submission
    $('#settingsModal').addEventListener('close', (e)=>{
      // ничего: обработку делаем по кнопкам ниже
    });
    // Интерцепт кликов по OK/Cancel
    $('.px-modal-inner').addEventListener('click', (e)=>{
      if (e.target instanceof HTMLButtonElement) {
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
  }

  /* -------------------- Init -------------------- */
  document.addEventListener('DOMContentLoaded', ()=>{
    build();
    bindEvents();
  });

})();
