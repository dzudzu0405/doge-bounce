const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const startBtn = document.getElementById('startBtn');
const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletStatus = document.getElementById('walletStatus');
const walletPanel = document.querySelector('.wallet-panel');
let walletConnected = false;
let walletAddress = '';

const W = canvas.width;
const H = canvas.height;
const groundY = H - 58;
const gravity = 0.58;
const bouncePower = -10.8;

let doge, obstacles, coins, particles, score, best, speed, running, gameOver, spawnTimer, coinTimer, lastTime;

function initState() {
  doge = { x: 150, y: 245, r: 28, vy: 0, rot: 0 };
  obstacles = [];
  coins = [];
  particles = [];
  score = 0;
  speed = 4.8;
  running = false;
  gameOver = false;
  spawnTimer = 0;
  coinTimer = 40;
  lastTime = performance.now();
  best = Number(localStorage.getItem('dogeBounceBest') || 0);
  scoreEl.textContent = '0';
  bestEl.textContent = best;
}

function reset() {
  if (!walletConnected) { showWalletRequired(); return; }
  doge = { x: 150, y: 245, r: 28, vy: 0, rot: 0 };
  obstacles = [];
  coins = [];
  particles = [];
  score = 0;
  speed = 4.8;
  running = true;
  gameOver = false;
  spawnTimer = 0;
  coinTimer = 40;
  lastTime = performance.now();
  best = Number(localStorage.getItem('dogeBounceBest') || 0);
  bestEl.textContent = best;
}

function bounce() {
  if (!walletConnected) { showWalletRequired(); return; }
  if (!running || gameOver) return reset();
  doge.vy = bouncePower;
  pop(doge.x - 10, doge.y + 24, '#fff4a3', 8);
}

function pop(x, y, color, n = 12) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - .5) * 5,
      vy: (Math.random() - .8) * 5,
      life: 36,
      color
    });
  }
}

function spawnObstacle() {
  const h = 54 + Math.random() * 92;
  obstacles.push({ x: W + 40, y: groundY - h, w: 36 + Math.random() * 26, h });
}

function spawnCoin() {
  coins.push({ x: W + 40, y: 120 + Math.random() * 230, r: 14, taken: false });
}

function circleRect(c, r) {
  const nx = Math.max(r.x, Math.min(c.x, r.x + r.w));
  const ny = Math.max(r.y, Math.min(c.y, r.y + r.h));
  const dx = c.x - nx;
  const dy = c.y - ny;
  return dx * dx + dy * dy < c.r * c.r;
}

function update() {
  doge.vy += gravity;
  doge.y += doge.vy;
  doge.rot += doge.vy * 0.012;

  if (doge.y + doge.r > groundY) {
    doge.y = groundY - doge.r;
    doge.vy *= -0.46;
    if (Math.abs(doge.vy) < 3.2) doge.vy = 0;
  }
  if (doge.y - doge.r < 20) {
    doge.y = 20 + doge.r;
    doge.vy = 1;
  }

  spawnTimer--;
  coinTimer--;
  if (spawnTimer <= 0) {
    spawnObstacle();
    spawnTimer = 78 + Math.random() * 58 - speed * 3;
  }
  if (coinTimer <= 0) {
    spawnCoin();
    coinTimer = 70 + Math.random() * 75;
  }

  for (const o of obstacles) o.x -= speed;
  for (const c of coins) c.x -= speed;

  obstacles = obstacles.filter(o => o.x + o.w > -60);
  coins = coins.filter(c => c.x + c.r > -60 && !c.taken);

  for (const o of obstacles) {
    if (circleRect(doge, o)) endGame();
  }

  for (const c of coins) {
    const dx = doge.x - c.x, dy = doge.y - c.y;
    if (dx * dx + dy * dy < (doge.r + c.r) ** 2) {
      c.taken = true;
      score += 25;
      pop(c.x, c.y, '#ffd84d', 14);
    }
  }

  score += 0.08;
  speed = Math.min(9.2, speed + 0.0014);
  scoreEl.textContent = Math.floor(score);

  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .12; p.life--; });
  particles = particles.filter(p => p.life > 0);
}

function endGame() {
  if (gameOver) return;
  gameOver = true;
  running = false;
  pop(doge.x, doge.y, '#ff5a6b', 26);
  best = Math.max(best, Math.floor(score));
  localStorage.setItem('dogeBounceBest', best);
  bestEl.textContent = best;
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#74d2ff');
  sky.addColorStop(.65, '#b8efff');
  sky.addColorStop(1, '#ffeab1');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,255,255,.7)';
  for (let i = 0; i < 7; i++) {
    const x = (i * 170 + (score * .25)) % (W + 220) - 120;
    const y = 55 + (i % 3) * 42;
    cloud(x, y, 1 + (i % 2) * .35);
  }

  ctx.fillStyle = '#57b85a';
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = '#3e8e3f';
  for (let x = -20; x < W + 20; x += 32) {
    ctx.fillRect(x - (score * speed * .03) % 32, groundY, 18, 8);
  }
}

function cloud(x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
  ctx.arc(x + 25 * s, y - 10 * s, 28 * s, 0, Math.PI * 2);
  ctx.arc(x + 55 * s, y, 22 * s, 0, Math.PI * 2);
  ctx.rect(x, y - 2 * s, 58 * s, 24 * s);
  ctx.fill();
}

function drawDoge() {
  ctx.save();
  ctx.translate(doge.x, doge.y);
  ctx.rotate(doge.rot);

  ctx.fillStyle = '#d69b45';
  ctx.beginPath();
  ctx.arc(0, 0, doge.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#b9782c';
  ctx.beginPath();
  ctx.moveTo(-18, -18); ctx.lineTo(-34, -42); ctx.lineTo(-2, -27); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(18, -18); ctx.lineTo(34, -42); ctx.lineTo(2, -27); ctx.fill();

  ctx.fillStyle = '#fff1c2';
  ctx.beginPath();
  ctx.ellipse(0, 8, 18, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1e160b';
  ctx.beginPath(); ctx.arc(-10, -4, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(11, -4, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 5, 4, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#1e160b';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 7, 10, .2, Math.PI - .2); ctx.stroke();

  ctx.restore();
}

function draw() {
  drawBackground();

  for (const c of coins) {
    ctx.fillStyle = '#ffd84d';
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9c6b00';
    ctx.font = 'bold 16px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('D', c.x, c.y + 1);
  }

  for (const o of obstacles) {
    ctx.fillStyle = '#ff5a6b';
    roundRect(o.x, o.y, o.w, o.h, 10);
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.fillRect(o.x + 8, o.y + 10, 8, o.h - 20);
  }

  particles.forEach(p => {
    ctx.globalAlpha = p.life / 36;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  });

  drawDoge();

  if (!running) {
    ctx.fillStyle = 'rgba(16, 19, 31, .58)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff8d8';
    ctx.textAlign = 'center';
    ctx.font = '900 58px system-ui';
    ctx.fillText(gameOver ? 'Game Over' : 'DogeBounce', W / 2, H / 2 - 46);
    ctx.font = '700 24px system-ui';
    ctx.fillText(gameOver ? 'Tap / Space to restart' : 'Tap / Space to bounce', W / 2, H / 2 + 8);
    ctx.fillStyle = '#ffd84d';
    ctx.fillText('Much bounce. Very wow.', W / 2, H / 2 + 48);
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function loop(now) {
  if (running) update(Math.min(32, now - lastTime));
  lastTime = now;
  draw();
  requestAnimationFrame(loop);
}

function shortAddress(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function showWalletRequired() {
  walletStatus.textContent = 'Please connect MetaMask before playing DogeBounce.';
}

async function connectWallet() {
  if (!window.ethereum) {
    walletStatus.innerHTML = 'MetaMask not found. Install it from <a href="https://metamask.io/" target="_blank" rel="noreferrer">metamask.io</a>.';
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    walletAddress = accounts[0] || '';
    walletConnected = Boolean(walletAddress);

    if (walletConnected) {
      walletStatus.textContent = `Connected: ${shortAddress(walletAddress)}. Game unlocked.`;
      walletPanel.classList.add('connected');
      connectWalletBtn.textContent = 'Wallet Connected';
      startBtn.disabled = false;
    }
  } catch (err) {
    walletStatus.textContent = 'Wallet connection rejected or failed.';
  }
}

connectWalletBtn.addEventListener('click', connectWallet);
startBtn.addEventListener('click', reset);

window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); bounce(); }
});
canvas.addEventListener('pointerdown', bounce);

initState();
startBtn.disabled = true;
draw();
requestAnimationFrame(loop);
