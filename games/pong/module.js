// Файл игры Pong.  Загружает себя как обычный скрипт и регистрирует
// в глобальном объекте __DeepFlyGames, чтобы хаб смог вызвать mount().

(() => {
  const manifest = {
    slug: 'pong',
    name: 'Pong',
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
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const scoreEl = document.createElement('div');
    scoreEl.style.position = 'absolute';
    scoreEl.style.top = '6px';
    scoreEl.style.left = '50%';
    scoreEl.style.transform = 'translateX(-50%)';
    scoreEl.style.color = getComputedStyle(document.documentElement).getPropertyValue('--ink');
    scoreEl.style.font = '14px ui-monospace';
    scoreEl.style.userSelect = 'none';
    container.appendChild(scoreEl);

    const backBtn = document.createElement('button');
    backBtn.textContent = 'Назад';
    backBtn.className = 'btn ghost';
    backBtn.style.position = 'absolute';
    backBtn.style.bottom = '8px';
    backBtn.style.left = '8px';
    backBtn.onclick = () => { location.hash = ''; };
    container.appendChild(backBtn);

    const width = canvas.width;
    const height = canvas.height;
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
      const rect = canvas.getBoundingClientRect();
      const sy = (e.clientY - rect.top) / rect.height;
      pointerY = sy * height;
    }
    canvas.addEventListener('pointermove', onPointer);
    canvas.addEventListener('pointerdown', onPointer);
    function onKeyDown(e){ keys[e.key.toLowerCase()] = true; }
    function onKeyUp(e){ keys[e.key.toLowerCase()] = false; }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

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
      if(keys['arrowup'] || keys['arrowdown']) {
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
      }
      if(ball.x + ballSize >= width - paddleW && ball.y + ballSize > p2.y && ball.y < p2.y + paddleH) {
        ball.vx = -Math.abs(ball.vx);
        const impact = (ball.y + ballSize/2 - (p2.y + paddleH/2)) / (paddleH/2);
        ball.vy = impact * 1.5;
      }
      if(ball.x < -ballSize) { p2.score++; resetBall(); }
      if(ball.x > width + ballSize) { p1.score++; resetBall(); }
    }
    function render() {
      // фон
      const odd = getComputedStyle(document.documentElement).getPropertyValue('--grid-odd').trim();
      const even = getComputedStyle(document.documentElement).getPropertyValue('--grid-even').trim();
      for(let y=0; y<height; y+=16) {
        for(let x=0; x<width; x+=16) {
          ctx.fillStyle = ((x+y)/16 % 2 === 0) ? odd : even;
          ctx.fillRect(x,y,16,16);
        }
      }
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--highlight');
      for(let y=0; y<height; y+=6) ctx.fillRect(width/2 - 1, y, 2, 3);
      ctx.fillStyle = '#ff77bd'; ctx.fillRect(0, p1.y, paddleW, paddleH);
      ctx.fillStyle = '#68c7ff'; ctx.fillRect(width - paddleW, p2.y, paddleW, paddleH);
      ctx.fillStyle = '#ffd166'; ctx.fillRect(ball.x, ball.y, ballSize, ballSize);
      scoreEl.textContent = `${p1.score} : ${p2.score}`;
    }
    let animId;
    function loop(){
      update(); render();
      animId = requestAnimationFrame(loop);
    }
    loop();

    return {
      unmount(){
        running = false;
        cancelAnimationFrame(animId);
        canvas.removeEventListener('pointermove', onPointer);
        canvas.removeEventListener('pointerdown', onPointer);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        if(container.parentNode === root) root.removeChild(container);
      }
    };
  }
  // Регистрируем модуль в глобальном хранилище
  window.__DeepFlyGames = window.__DeepFlyGames || {};
  window.__DeepFlyGames['pong'] = { manifest, mount };
})();