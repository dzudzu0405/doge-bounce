const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const startBtn = document.getElementById('startBtn');
const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletStatus = document.getElementById('walletStatus');
const walletPanel = document.querySelector('.wallet-panel');

const W = canvas.width;
const H = canvas.height;
const gravity = 0.42;
const jumpPower = -15.6;
const moveEase = 0.18;
const maxVX = 8.4;
const playerW = 76;
const playerH = 76;
const platformW = 120;
const platformH = 20;

const dogeImg = new Image();
dogeImg.src = 'assets/doge-oh-v2.png?v=3';
const bgImg = new Image();
bgImg.src = 'assets/background.jpg?v=2';

let walletConnected = false;
let walletAddress = '';
let score = 0;
let best = Number(localStorage.getItem('dogeBounceBest') || 0);
let lives = 3;
let gameStarted = false;
let gameOver = false;
let cameraY = 0;
let highestY = 0;
let targetX = W / 2;
let player;
let platforms = [];
let bombs = [];
let particles = [];
let message = 'Connect wallet, then start bouncing.';
let damageCooldown = 0;

function shortAddress(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function setWalletConnected(addr, silent = false) {
  walletAddress = addr;
  walletConnected = Boolean(addr);
  if (!walletConnected) return;
  localStorage.setItem('dogeBounceWallet', walletAddress);
  walletStatus.textContent = `Connected: ${shortAddress(walletAddress)}. Wallet remembered.`;
  walletPanel.classList.add('connected');
  connectWalletBtn.textContent = 'Wallet Connected';
  startBtn.disabled = false;
  message = silent ? 'Wallet remembered. Press Start.' : 'Wallet connected. Press Start.';
}

async function connectWallet() {
  if (!window.ethereum) {
    walletStatus.innerHTML = 'MetaMask not found. Open this page in MetaMask Browser or install it from <a href="https://metamask.io/" target="_blank" rel="noreferrer">metamask.io</a>.';
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (accounts[0]) setWalletConnected(accounts[0]);
  } catch (err) {
    walletStatus.textContent = 'Wallet connection rejected or failed.';
  }
}

async function restoreWallet() {
  const saved = localStorage.getItem('dogeBounceWallet');
  if (!saved) return;
  setWalletConnected(saved, true);

  // If MetaMask is present, quietly verify the account when permission already exists.
  try {
    if (window.ethereum) {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts[0]) setWalletConnected(accounts[0], true);
    }
  } catch (_) {}
}

function rand(min, max) { return min + Math.random() * (max - min); }

function resetGame() {
  score = 0;
  lives = 3;
  cameraY = 0;
  highestY = 0;
  gameStarted = true;
  gameOver = false;
  damageCooldown = 0;
  particles = [];
  bombs = [];
  targetX = W / 2;
  player = { x: W / 2 - playerW / 2, y: H - 145, vx: 0, vy: jumpPower, w: playerW, h: playerH };
  platforms = [];

  platforms.push({ x: W / 2 - platformW / 2, y: H - 60, w: platformW, h: platformH, spike: false });
  let y = H - 135;
  for (let i = 0; i < 18; i++) {
    platforms.push(makePlatform(y, i));
    y -= rand(72, 102);
  }

  message = 'Move left/right with mouse. Bounce on ice!';
  startBtn.textContent = 'Restart';
  updateHud();
}

function makePlatform(y, index = 0) {
  const spike = index > 2 && Math.random() < 0.18;
  return { x: rand(35, W - platformW - 35), y, w: platformW, h: platformH, spike };
}

function spawnMorePlatforms() {
  let topY = Math.min(...platforms.map(p => p.y));
  while (topY > cameraY - 180) {
    topY -= rand(72, 102);
    platforms.push(makePlatform(topY, platforms.length));
    if (Math.random() < 0.22) bombs.push({ x: rand(55, W - 55), y: topY - rand(40, 90), r: 18, drift: rand(-0.8, 0.8) });
  }
  platforms = platforms.filter(p => p.y - cameraY < H + 140);
  bombs = bombs.filter(b => b.y - cameraY < H + 130);
}

function updateHud() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
}

function burst(x, y, color, n = 16) {
  for (let i = 0; i < n; i++) {
    particles.push({ x, y, vx: rand(-4, 4), vy: rand(-5, 2), life: 34, color });
  }
}

function hitDamage(reason) {
  if (damageCooldown > 0 || gameOver) return;
  lives--;
  score = Math.max(0, score - 75);
  damageCooldown = 70;
  message = reason;
  burst(player.x + player.w / 2, player.y + player.h / 2, '#ff5a6b', 28);
  player.vy = jumpPower * 0.85;
  if (lives <= 0) endGame();
  updateHud();
}

function endGame() {
  gameOver = true;
  gameStarted = false;
  best = Math.max(best, score);
  localStorage.setItem('dogeBounceBest', best);
  message = 'Game Over. Press Restart.';
  startBtn.textContent = 'Restart';
  updateHud();
}

function update() {
  if (!gameStarted || gameOver) {
    updateParticles();
    return;
  }

  damageCooldown = Math.max(0, damageCooldown - 1);

  const center = player.x + player.w / 2;
  player.vx += (targetX - center) * moveEase * 0.035;
  player.vx = Math.max(-maxVX, Math.min(maxVX, player.vx));
  player.vx *= 0.94;
  player.vy += gravity;
  player.x += player.vx;
  player.y += player.vy;

  // Wrap horizontally, like Doodle Jump.
  if (player.x > W) player.x = -player.w;
  if (player.x + player.w < 0) player.x = W;

  // Bounce on ice platforms only while falling.
  if (player.vy > 0) {
    for (const p of platforms) {
      const feet = player.y + player.h;
      const prevFeet = feet - player.vy;
      const overlapX = player.x + player.w * 0.78 > p.x && player.x + player.w * 0.22 < p.x + p.w;
      if (overlapX && prevFeet <= p.y && feet >= p.y && feet <= p.y + p.h + 18) {
        player.y = p.y - player.h;
        player.vy = jumpPower;
        burst(player.x + player.w / 2, p.y, p.spike ? '#ff5a6b' : '#bff4ff', p.spike ? 20 : 10);
        if (p.spike) hitDamage('Ouch! Spike ice. -75 points.');
        else message = 'Boing!';
        break;
      }
    }
  }

  // Bomb collision.
  for (const b of bombs) {
    b.x += b.drift;
    if (b.x < 28 || b.x > W - 28) b.drift *= -1;
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    if (Math.hypot(cx - b.x, cy - b.y) < b.r + 30) {
      b.y = cameraY + H + 999;
      hitDamage('Boom! Bomb hit. -75 points.');
    }
  }

  // Camera follows upward progress.
  const screenY = player.y - cameraY;
  if (screenY < H * 0.38) cameraY = player.y - H * 0.38;

  highestY = Math.min(highestY, player.y);
  score = Math.max(score, Math.floor((-highestY) / 4));
  best = Math.max(best, score);
  updateHud();

  spawnMorePlatforms();

  // Fell below screen.
  if (player.y - cameraY > H + 120) {
    hitDamage('You fell! Lost one life.');
    if (!gameOver) {
      player.x = W / 2 - player.w / 2;
      player.y = cameraY + H - 170;
      player.vx = 0;
      player.vy = jumpPower;
    }
  }

  updateParticles();
}

function updateParticles() {
  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.16; p.life--; });
  particles = particles.filter(p => p.life > 0);
}

function drawRounded(x, y, w, h, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function drawPlayer() {
  const sx = player.x;
  const sy = player.y - cameraY;
  ctx.save();
  ctx.globalAlpha = damageCooldown > 0 && Math.floor(damageCooldown / 5) % 2 === 0 ? 0.45 : 1;
  if (dogeImg.complete && dogeImg.naturalWidth) {
    const renderH = 122;
    const renderW = renderH * (dogeImg.naturalWidth / dogeImg.naturalHeight);
    ctx.drawImage(dogeImg, sx + player.w / 2 - renderW / 2, sy + player.h - renderH + 8, renderW, renderH);
  } else {
    ctx.fillStyle = '#d99532';
    ctx.beginPath();
    ctx.arc(sx + player.w / 2, sy + player.h / 2, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a1808';
    ctx.font = '900 18px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Doge-OH', sx + player.w / 2, sy + player.h / 2 + 6);
  }
  ctx.restore();
}

function drawPlatform(p) {
  const y = p.y - cameraY;
  drawRounded(p.x, y, p.w, p.h, 10, p.spike ? '#8ee7ff' : '#bff4ff');
  ctx.fillStyle = 'rgba(255,255,255,.72)';
  ctx.fillRect(p.x + 12, y + 4, p.w - 24, 4);
  ctx.strokeStyle = '#58bcd4';
  ctx.lineWidth = 2;
  ctx.strokeRect(p.x + 3, y + 3, p.w - 6, p.h - 6);

  if (p.spike) {
    ctx.fillStyle = '#ff3e5f';
    for (let x = p.x + 12; x < p.x + p.w - 10; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 10, y - 25);
      ctx.lineTo(x + 20, y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawBomb(b) {
  const y = b.y - cameraY;
  ctx.fillStyle = '#1f2430';
  ctx.beginPath();
  ctx.arc(b.x, y, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffcf3f';
  ctx.beginPath();
  ctx.arc(b.x + 7, y - 8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffcf3f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(b.x + 10, y - 13);
  ctx.quadraticCurveTo(b.x + 22, y - 25, b.x + 13, y - 31);
  ctx.stroke();
}

function draw() {
  if (bgImg.complete && bgImg.naturalWidth) {
    const scale = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight);
    const sw = bgImg.naturalWidth * scale;
    const sh = bgImg.naturalHeight * scale;
    const parallaxY = (Math.abs(cameraY) * 0.08) % Math.max(1, sh - H);
    ctx.save();
    ctx.filter = 'blur(2.5px) brightness(0.62) saturate(0.82)';
    ctx.drawImage(bgImg, (W - sw) / 2 - 8, (H - sh) / 2 + parallaxY * 0.25 - 8, sw + 16, sh + 16);
    ctx.restore();
    ctx.fillStyle = 'rgba(0, 18, 42, .34)';
    ctx.fillRect(0, 0, W, H);
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#dff9ff');
    bg.addColorStop(0.55, '#8ddfff');
    bg.addColorStop(1, '#4776c7');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  // Snow dots
  ctx.fillStyle = 'rgba(255,255,255,.62)';
  for (let i = 0; i < 70; i++) {
    const x = (i * 91) % W;
    const y = ((i * 47) + Math.abs(cameraY) * (0.25 + (i % 4) * 0.05)) % H;
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  platforms.forEach(drawPlatform);
  bombs.forEach(drawBomb);
  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life / 34);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y - cameraY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  drawPlayer();

  // HUD inside canvas
  ctx.fillStyle = 'rgba(14,35,60,.58)';
  ctx.fillRect(0, 0, W, 54);
  ctx.fillStyle = '#fff';
  ctx.font = '900 24px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(`Lives: ${'❤️'.repeat(Math.max(0, lives))}`, 22, 36);
  ctx.textAlign = 'center';
  ctx.fillText(message, W / 2, 36);

  if (!walletConnected || !gameStarted || gameOver) {
    ctx.fillStyle = 'rgba(0, 20, 40, .45)';
    ctx.fillRect(0, 54, W, H - 54);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '900 42px system-ui';
    ctx.fillText(!walletConnected ? 'CONNECT METAMASK' : gameOver ? 'GAME OVER' : 'DOGE-OH BOUNCE', W / 2, H / 2 - 22);
    ctx.font = '700 22px system-ui';
    ctx.fillText(!walletConnected ? 'Wallet is remembered after first login.' : 'Move mouse left/right. Bounce on ice platforms.', W / 2, H / 2 + 22);
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

function setTargetFromEvent(evt) {
  const rect = canvas.getBoundingClientRect();
  const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
  targetX = ((clientX - rect.left) / rect.width) * W;
}

connectWalletBtn.addEventListener('click', connectWallet);
startBtn.addEventListener('click', () => {
  if (!walletConnected) return showWalletRequired();
  resetGame();
});
canvas.addEventListener('mousemove', setTargetFromEvent);
canvas.addEventListener('pointermove', setTargetFromEvent);
canvas.addEventListener('touchmove', evt => { setTargetFromEvent(evt); evt.preventDefault(); }, { passive: false });

initVisualOnly();
restoreWallet();
requestAnimationFrame(loop);

function initVisualOnly() {
  player = { x: W / 2 - playerW / 2, y: H - 145, vx: 0, vy: 0, w: playerW, h: playerH };
  platforms = [];
  let y = H - 60;
  for (let i = 0; i < 9; i++) {
    platforms.push({ x: rand(45, W - platformW - 45), y, w: platformW, h: platformH, spike: i > 2 && i % 4 === 0 });
    y -= 90;
  }
  updateHud();
}


