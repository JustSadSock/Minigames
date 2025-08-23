// Модуль раннера.  Саморегистрируется в window.__DeepFlyGames, чтобы хаб мог
// вызвать mount() без использования dynamic import.

(() => {
  const manifest = {
    slug: 'runner',
    name: 'Runner',
    caption: 'Прыгай и беги',
    icon: '🏃',
    version: '1.0.0',
    players: 1
  };

  async function mount(root, context) {
    const container = document.createElement('div');
    container.className = 'game-runner';
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = '100%';
    root.innerHTML = '';
    root.appendChild(container);

    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    canvas.className = 'pixel';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const ro = new ResizeObserver(()=>{
      const w = container.clientWidth; const h = container.clientHeight;
      const scale = Math.max(1, Math.floor(Math.min(w/canvas.width, h/canvas.height)));
      canvas.style.width = canvas.width*scale+'px';
      canvas.style.height = canvas.height*scale+'px';
    });
    ro.observe(container);

    const scoreEl = document.createElement('div');
    scoreEl.style.position = 'absolute';
    scoreEl.style.top = '6px';
    scoreEl.style.left = '8px';
    scoreEl.style.color = getComputedStyle(document.documentElement).getPropertyValue('--ink');
    scoreEl.style.font = '14px ui-monospace';
    scoreEl.style.userSelect = 'none';
    container.appendChild(scoreEl);

    function makeCanvasButton(canvas, { label, onClick, fontPx=8, width=canvas.width, height=canvas.height }){
      const ctx=canvas.getContext('2d');
      ctx.imageSmoothingEnabled=false; canvas.width=width; canvas.height=height;
      let st=0; let enabled=true;
      function draw(){
        const bg=['#1a1d31','#232742','#0f1223'][st];
        ctx.clearRect(0,0,width,height);
        ctx.fillStyle=bg; ctx.fillRect(0,0,width,height);
        ctx.strokeStyle='#000'; ctx.strokeRect(0.5,0.5,width-1,height-1);
        ctx.fillStyle=enabled?'#e6ebff':'#8c92b8';
        ctx.font=`${fontPx}px ui-monospace`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(label,width/2,height/2+1);
      }
      function setEnabled(v){ enabled=!!v; draw(); }
      function setLabel(v){ label=v; canvas.setAttribute('aria-label',v); draw(); }
      canvas.tabIndex=0; canvas.setAttribute('role','button'); canvas.setAttribute('aria-label',label);
      canvas.addEventListener('pointerenter',()=>{ if(enabled){st=1;draw();} });
      canvas.addEventListener('pointerleave',()=>{ if(enabled){st=0;draw();} });
      canvas.addEventListener('pointerdown',e=>{ if(enabled){e.preventDefault();st=2;draw();} });
      canvas.addEventListener('pointerup',()=>{ if(enabled){st=1;draw();onClick&&onClick();} });
      canvas.addEventListener('keydown',e=>{ if(enabled && (e.key==='Enter'||e.key===' ')){ onClick&&onClick(); } });
      draw();
      return { setEnabled, setLabel };
    }
    const width = canvas.width;
    const height = canvas.height;
    const backCanvas=document.createElement('canvas');
    backCanvas.className='pixel'; backCanvas.width=64; backCanvas.height=16;
    backCanvas.style.position='absolute'; backCanvas.style.left='8px'; backCanvas.style.bottom='8px';
    container.appendChild(backCanvas);
    makeCanvasButton(backCanvas,{label:'Назад',onClick(){location.hash='';}});
    const groundY = height - 10;
    const gravity = 0.2;
    const player = { x: 20, y: groundY - 8, vy: 0, w: 8, h: 8, jumping: false };
    let obstacles = [];
    let spawnTimer = 0;
    let score = 0;
    let running = true;
    let gameOver = false;

    function resetGame(){
      player.y = groundY - player.h;
      player.vy = 0;
      player.jumping = false;
      obstacles = [];
      spawnTimer = 0;
      score = 0;
      gameOver = false;
      running = true;
    }

    function jump(){
      if(!player.jumping && !gameOver){
        player.vy = -4.2;
        player.jumping = true;
      }
      if(gameOver){ resetGame(); }
    }

    function onPointer(e){ e.preventDefault(); jump(); }
    function onKey(e){ if(e.key === ' '){ e.preventDefault(); jump(); } }
    function onEsc(e){ if(e.key==='Escape') location.hash=''; }
    canvas.addEventListener('pointerdown', onPointer, {passive:false});
    window.addEventListener('keydown', onKey);
    window.addEventListener('keydown', onEsc);

    function update() {
      if(!running) return;
      player.vy += gravity;
      player.y += player.vy;
      if(player.y >= groundY - player.h) {
        if(player.jumping && vfx){ for(let i=0;i<3;i++) particles.push({x:player.x,y:groundY-1,vx:Math.random()*1,vy:-Math.random()*1,life:20}); }
        player.y = groundY - player.h;
        player.vy = 0;
        player.jumping = false;
      }
      spawnTimer--;
      if(spawnTimer <= 0) {
        const obsH = 12 + Math.floor(Math.random()*10);
        obstacles.push({ x: width, y: groundY - obsH, w: 6, h: obsH });
        spawnTimer = 80 + Math.random()*60;
      }
      for(let i=obstacles.length-1; i>=0; i--){
        const o = obstacles[i];
        o.x -= 1.8;
        if(!gameOver && o.x < player.x + player.w && o.x + o.w > player.x && o.y < player.y + player.h && o.y + o.h > player.y) {
          gameOver = true;
          running = false;
          if(score > best){ best = score; context && context.store && context.store.set('games.runner.best', best); }
        }
        if(o.x + o.w < 0){ obstacles.splice(i,1); if(!gameOver) score++; }
      }
    }

    function drawPlayer(){
      const px = (x,y,s,c) => { ctx.fillStyle = c; ctx.fillRect(x*s, y*s, s, s); };
      const s = 1;
      const offX = Math.floor(player.x);
      const offY = Math.floor(player.y);
      // тело
      px(offX+1, offY+3, s, '#ff77bd');
      px(offX+2, offY+3, s, '#ff77bd');
      px(offX+1, offY+4, s, '#ff77bd');
      px(offX+2, offY+4, s, '#ff77bd');
      px(offX+1, offY+5, s, '#ff77bd');
      px(offX+2, offY+5, s, '#ff77bd');
      // голова
      px(offX+1, offY+1, s, '#ffd166');
      px(offX+2, offY+1, s, '#ffd166');
      px(offX+1, offY+2, s, '#ffd166');
      px(offX+2, offY+2, s, '#ffd166');
      // глаза
      px(offX+1, offY+2, s, '#10131e');
      px(offX+2, offY+2, s, '#10131e');
    }

    function render(){
      const styles = getComputedStyle(document.documentElement);
      const odd = styles.getPropertyValue('--grid-odd').trim();
      const even = styles.getPropertyValue('--grid-even').trim();
      const highlight = styles.getPropertyValue('--highlight');
      for(let y=0; y<height; y+=16) {
        for(let x=0; x<width; x+=16) {
          ctx.fillStyle = ((x+y)/16 % 2 === 0) ? odd : even;
          ctx.fillRect(x,y,16,16);
        }
      }
      ctx.fillStyle = highlight;
      ctx.fillRect(0, groundY, width, 1);
      drawPlayer();
      ctx.fillStyle = '#ff6b6b';
      obstacles.forEach(o => { ctx.fillRect(o.x, o.y, o.w, o.h); });
      if(vfx){
        for(let i=particles.length-1;i>=0;i--){
          const p=particles[i]; p.life--; p.x+=p.vx; p.y+=p.vy; p.vy+=0.05;
          ctx.fillStyle='#ccc'; ctx.fillRect(p.x,p.y,1,1);
          if(p.life<=0) particles.splice(i,1);
        }
      }
      scoreEl.textContent = gameOver ? `Game Over — счет: ${score} (лучший: ${best})` : `Очки: ${score} (лучший: ${best})`;
    }

    let animId; const particles=[]; const vfx = context && context.store ? context.store.get('settings.vfx', true) : true; let best = context && context.store ? context.store.get('games.runner.best',0) : 0;
    function loop(){
      update();
      render();
      animId = requestAnimationFrame(loop);
    }
    loop();

    return {
      unmount(){
        running = false;
        cancelAnimationFrame(animId);
        canvas.removeEventListener('pointerdown', onPointer);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keydown', onEsc);
        ro.disconnect();
        if(container.parentNode === root) root.removeChild(container);
      }
    };
  }
  window.__DeepFlyGames = window.__DeepFlyGames || {};
  if(!window.__DeepFlyGames['runner']) window.__DeepFlyGames['runner'] = { manifest, mount };
})();
