// Файл игры Pong.  Загружает себя как обычный скрипт и регистрирует
// в глобальном объекте __DeepFlyGames, чтобы хаб смог вызвать mount().

(() => {
  const manifest = {
    slug: 'pong',
    name: 'Pong',
    caption: 'Классика 1v1',
    icon: '🏓',
    version: '1.0.0',
    players: 2
  };

  async function mount(root, context) {
    const container = document.createElement('div');
    container.className = 'game-pong';
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = '100%';
    // очищаем корень и добавляем контейнер
    root.innerHTML = '';
    root.appendChild(container);

    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 100;
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
    scoreEl.style.left = '50%';
    scoreEl.style.transform = 'translateX(-50%)';
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
    let ai = true;
    const backCanvas=document.createElement('canvas');
    backCanvas.className='pixel'; backCanvas.width=64; backCanvas.height=16;
    backCanvas.style.position='absolute'; backCanvas.style.left='8px'; backCanvas.style.bottom='8px';
    container.appendChild(backCanvas);
    makeCanvasButton(backCanvas,{label:'Назад',onClick(){ location.hash=''; }});
    const aiCanvas=document.createElement('canvas');
    aiCanvas.className='pixel'; aiCanvas.width=64; aiCanvas.height=16;
    aiCanvas.style.position='absolute'; aiCanvas.style.left='8px'; aiCanvas.style.top='8px';
    container.appendChild(aiCanvas);
    const aiBtn = makeCanvasButton(aiCanvas,{label:'ИИ: вкл',onClick(){ ai=!ai; aiBtn.setLabel('ИИ: '+(ai?'вкл':'выкл')); }});
    const paddleW = 2;
    const paddleH = 16;
    const ballSize = 2;
    let p1 = { y: height/2 - paddleH/2, score: 0 };
    let p2 = { y: height/2 - paddleH/2, score: 0 };
    let ball = { x: width/2, y: height/2, vx: 1.8, vy: 1.2 };
    let running = true;
    let pointerY = null;
    const keys = {};

    function onPointer(e) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sy = (e.clientY - rect.top) / rect.height;
      pointerY = sy * height;
    }
    canvas.addEventListener('pointermove', onPointer, {passive:false});
    canvas.addEventListener('pointerdown', onPointer, {passive:false});
    function onKeyDown(e){ keys[e.key.toLowerCase()] = true; }
    function onKeyUp(e){ keys[e.key.toLowerCase()] = false; }
    function onEsc(e){ if(e.key==='Escape') location.hash=''; }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('keydown', onEsc);

    function resetBall() {
      ball.x = width/2;
      ball.y = height/2;
      ball.vx = (Math.random() > 0.5 ? 1 : -1) * 1.8;
      ball.vy = (Math.random() - 0.5) * 2;
    }

    function update() {
      if(!running) return;
      if(pointerY !== null) {
        const target = pointerY - paddleH/2;
        p1.y += (target - p1.y) * 0.2;
      } else {
        if(keys['w']) p1.y -= 2;
        if(keys['s']) p1.y += 2;
      }
      if(!ai && (keys['arrowup'] || keys['arrowdown'])) {
        if(keys['arrowup']) p2.y -= 2;
        if(keys['arrowdown']) p2.y += 2;
      } else {
        const target = ball.y - paddleH/2;
        p2.y += (target - p2.y) * 0.05;
      }
      p1.y = Math.max(0, Math.min(height - paddleH, p1.y));
      p2.y = Math.max(0, Math.min(height - paddleH, p2.y));
      ball.x += ball.vx;
      ball.y += ball.vy;
      if(ball.y <= 0 || ball.y >= height - ballSize) {
        ball.vy *= -1;
        ball.y = Math.max(0, Math.min(height - ballSize, ball.y));
      }
      if(ball.x <= paddleW && ball.y + ballSize > p1.y && ball.y < p1.y + paddleH) {
        ball.vx = Math.abs(ball.vx);
        const impact = (ball.y + ballSize/2 - (p1.y + paddleH/2)) / (paddleH/2);
        ball.vy = impact * 1.5;
        if(vfx) for(let i=0;i<3;i++) sparks.push({x:ball.x,y:ball.y,vx:Math.random()*1,vy:(Math.random()-0.5)*1,life:20});
      }
      if(ball.x + ballSize >= width - paddleW && ball.y + ballSize > p2.y && ball.y < p2.y + paddleH) {
        ball.vx = -Math.abs(ball.vx);
        const impact = (ball.y + ballSize/2 - (p2.y + paddleH/2)) / (paddleH/2);
        ball.vy = impact * 1.5;
        if(vfx) for(let i=0;i<3;i++) sparks.push({x:ball.x,y:ball.y,vx:-Math.random()*1,vy:(Math.random()-0.5)*1,life:20});
      }
      if(ball.x < -ballSize) { if(vfx) shake=5; p2.score++; resetBall(); }
      if(ball.x > width + ballSize) { if(vfx) shake=5; p1.score++; resetBall(); }
    }
    function render() {
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
      for(let y=0; y<height; y+=6) ctx.fillRect(width/2 - 1, y, 2, 3);
      ctx.fillStyle = '#ff77bd'; ctx.fillRect(0, p1.y, paddleW, paddleH);
      ctx.fillStyle = '#68c7ff'; ctx.fillRect(width - paddleW, p2.y, paddleW, paddleH);
      ctx.fillStyle = '#ffd166'; ctx.fillRect(ball.x, ball.y, ballSize, ballSize);
      if(vfx){
        for(let i=sparks.length-1;i>=0;i--){
          const s=sparks[i]; s.life--; s.x+=s.vx; s.y+=s.vy;
          ctx.fillStyle='#fff'; ctx.fillRect(s.x,s.y,1,1);
          if(s.life<=0) sparks.splice(i,1);
        }
      }
      scoreEl.textContent = `${p1.score} : ${p2.score}`;
    }
    let animId; let shake=0; const vfx = context && context.store ? context.store.get('settings.vfx', true) : true; const sparks=[];
    function loop(){
      update(); render();
      if(shake>0){ shake--; container.style.transform=`translate(${(Math.random()-0.5)*2}px,${(Math.random()-0.5)*2}px)`; }
      else container.style.transform='';
      animId = requestAnimationFrame(loop);
    }
    loop();

    return {
      unmount(){
        running = false;
        cancelAnimationFrame(animId);
        canvas.removeEventListener('pointermove', onPointer);
        canvas.removeEventListener('pointerdown', onPointer);
        ro.disconnect();
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('keydown', onEsc);
        if(container.parentNode === root) root.removeChild(container);
      }
    };
  }
  // Регистрируем модуль в глобальном хранилище
  window.__DeepFlyGames = window.__DeepFlyGames || {};
  if(!window.__DeepFlyGames['pong']) window.__DeepFlyGames['pong'] = { manifest, mount };
})();
