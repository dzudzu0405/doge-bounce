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
const gravity = 0.34;
const air = 0.995;
const wallBounce = 0.78;
const pegBounce = 0.92;
const coinR = 24;
const pegR = 9;

let walletConnected = false;
let walletAddress = '';
let score = 0;
let best = Number(localStorage.getItem('dogeBounceBest') || 0);
let running = false;
let dropping = false;
let resultText = 'Connect wallet, then drop Doge.';
let doge;
let pegs = [];
let slots = [];
let particles = [];
let dropFrames = 0;
let stuckFrames = 0;
let lastDogeY = 0;

function shortAddress(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function showWalletRequired() {
  walletStatus.textContent = 'Please connect MetaMask before playing DogeBounce.';
}

async function connectWallet() {
  if (!window.ethereum) {
    walletStatus.innerHTML = 'MetaMask not found. Open this page in MetaMask Browser or install it from <a href="https://metamask.io/" target="_blank" rel="noreferrer">metamask.io</a>.';
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    walletAddress = accounts[0] || '';
    walletConnected = Boolean(walletAddress);

    if (walletConnected) {
      walletStatus.textContent = `Connected: ${shortAddress(walletAddress)}. Doge drop unlocked.`;
      walletPanel.classList.add('connected');
      connectWalletBtn.textContent = 'Wallet Connected';
      startBtn.disabled = false;
      resultText = 'Press Drop Doge to play.';
    }
  } catch (err) {
    walletStatus.textContent = 'Wallet connection rejected or failed.';
  }
}

function initBoard() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  doge = { x: W / 2, y: 88, vx: 0, vy: 0, r: coinR, rot: 0 };
  pegs = [];
  particles = [];

  const rows = 7;
  const startY = 165;
  const gapY = 48;
  const gapX = 86;
  for (let row = 0; row < rows; row++) {
    const count = row % 2 === 0 ? 7 : 8;
    const total = (count - 1) * gapX;
    const startX = W / 2 - total / 2;
    for (let i = 0; i < count; i++) {
      pegs.push({ x: startX + i * gapX, y: startY + row * gapY, r: pegR });
    }
  }

  const values = [50, 100, 250, -50, 500, -100, 250, 100, 50];
  const margin = 54;
  const slotW = (W - margin * 2) / values.length;
  slots = values.map((value, i) => ({
    x: margin + i * slotW,
    y: H - 74,
    w: slotW - 5,
    h: 54,
    value
  }));
}

function resetDoge() {
  doge.x = 120 + Math.random() * (W - 240);
  doge.y = 82;
  doge.vx = (Math.random() - 0.5) * 2.2;
  doge.vy = 0;
  doge.rot = 0;
  dropFrames = 0;
  stuckFrames = 0;
  lastDogeY = doge.y;
}

function dropDoge() {
  if (!walletConnected) {
    showWalletRequired();
    return;
  }
  if (dropping) return;
  resetDoge();
  dropping = true;
  running = true;
  resultText = 'Doge is bouncing...';
  startBtn.textContent = 'Dropping...';
}

function burst(x, y, color, n = 18) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.8) * 6,
      life: 38,
      color
    });
  }
}

function land(slot) {
  dropping = false;
  running = false;
  const delta = slot.value;
  score = Math.max(0, score + delta);
  best = Math.max(best, score);
  localStorage.setItem('dogeBounceBest', best);
  scoreEl.textContent = score;
  bestEl.textContent = best;
  resultText = delta >= 0 ? `WOW! +${delta} points` : `Ouch! ${delta} points`;
  burst(doge.x, doge.y, delta >= 0 ? '#ffd84d' : '#ff5a6b', 28);
  startBtn.textContent = 'Drop Doge Again';
}

function update() {
  if (dropping) {
    doge.vy += gravity;
    doge.vx *= air;
    doge.vy *= air;
    doge.x += doge.vx;
    doge.y += doge.vy;
    doge.rot += doge.vx * 0.02;
    dropFrames++;

    const movedDown = doge.y - lastDogeY;
    const speedNow = Math.hypot(doge.vx, doge.vy);
    if (Math.abs(movedDown) < 0.08 && speedNow < 0.55) {
      stuckFrames++;
    } else {
      stuckFrames = 0;
    }
    lastDogeY = doge.y;

    if (stuckFrames > 55) {
      doge.vx += (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random());
      doge.vy += 2.4;
      stuckFrames = 0;
      resultText = 'Doge got a little nudge.';
    }

    if (dropFrames > 900) {
      const nearest = slots.reduce((bestSlot, slot) => {
        const bestDist = Math.abs(doge.x - (bestSlot.x + bestSlot.w / 2));
        const dist = Math.abs(doge.x - (slot.x + slot.w / 2));
        return dist < bestDist ? slot : bestSlot;
      }, slots[0]);
      land(nearest);
      return;
    }

    if (doge.x - doge.r < 24) {
      doge.x = 24 + doge.r;
      doge.vx = Math.abs(doge.vx) * wallBounce;
    }
    if (doge.x + doge.r > W - 24) {
      doge.x = W - 24 - doge.r;
      doge.vx = -Math.abs(doge.vx) * wallBounce;
    }

    for (const peg of pegs) {
      const dx = doge.x - peg.x;
      const dy = doge.y - peg.y;
      const dist = Math.hypot(dx, dy);
      const min = doge.r + peg.r;
      if (dist > 0 && dist < min) {
        const nx = dx / dist;
        const ny = dy / dist;
        doge.x = peg.x + nx * (min + 0.8);
        doge.y = peg.y + ny * (min + 0.8);
        const dot = doge.vx * nx + doge.vy * ny;
        doge.vx = (doge.vx - 2 * dot * nx) * pegBounce + nx * 0.7 + (Math.random() - 0.5) * 0.35;
        doge.vy = (doge.vy - 2 * dot * ny) * pegBounce + ny * 0.7 + 0.18;
        burst(peg.x, peg.y, '#fff3a8', 5);
      }
    }

    if (doge.y + doge.r >= H - 78) {
      const slot = slots.find(s => doge.x >= s.x && doge.x <= s.x + s.w) || slots[Math.floor(slots.length / 2)];
      land(slot);
    }
  }

  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.14;
    p.life--;
  });
  particles = particles.filter(p => p.life > 0);
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function drawDoge() {
  ctx.save();
  ctx.translate(doge.x, doge.y);
  ctx.rotate(doge.rot);

  const grad = ctx.createRadialGradient(-8, -10, 8, 0, 0, doge.r + 6);
  grad.addColorStop(0, '#ffe9a6');
  grad.addColorStop(1, '#d99532');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, doge.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#8a5517';
  ctx.stroke();

  ctx.fillStyle = '#b9782c';
  ctx.beginPath();
  ctx.moveTo(-14, -17); ctx.lineTo(-30, -34); ctx.lineTo(-2, -24); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, -17); ctx.lineTo(30, -34); ctx.lineTo(2, -24); ctx.fill();

  ctx.fillStyle = '#fff1c8';
  ctx.beginPath();
  ctx.ellipse(0, 9, 15, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#20150a';
  ctx.beginPath(); ctx.arc(-9, -4, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(10, -4, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 5, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.font = '900 12px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('Ð', 0, 22);

  ctx.restore();
}

function draw() {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#20133c');
  bg.addColorStop(0.48, '#30165d');
  bg.addColorStop(1, '#130c24');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,255,255,.06)';
  for (let i = 0; i < 80; i++) {
    const x = (i * 97) % W;
    const y = (i * 53) % H;
    ctx.beginPath();
    ctx.arc(x, y, (i % 3) + 1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255,255,255,.08)';
  roundedRect(22, 22, W - 44, H - 44, 26);
  ctx.strokeStyle = 'rgba(255,216,77,.65)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#ffd84d';
  ctx.font = '900 42px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('DOGE BOUNCE', W / 2, 58);

  ctx.fillStyle = '#fff8dd';
  ctx.font = '700 20px system-ui';
  ctx.fillText(resultText, W / 2, 90);

  for (const peg of pegs) {
    ctx.fillStyle = '#ffdf70';
    ctx.beginPath();
    ctx.arc(peg.x, peg.y, peg.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath();
    ctx.arc(peg.x - 3, peg.y - 3, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const slot of slots) {
    const positive = slot.value >= 0;
    ctx.fillStyle = positive ? '#1fd184' : '#ff4967';
    roundedRect(slot.x, slot.y, slot.w, slot.h, 12);
    ctx.fillStyle = '#10131f';
    ctx.font = '900 18px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(positive ? `+${slot.value}` : `${slot.value}`, slot.x + slot.w / 2, slot.y + slot.h / 2);
    ctx.textBaseline = 'alphabetic';
  }

  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life / 38);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  drawDoge();

  if (!walletConnected) {
    ctx.fillStyle = 'rgba(0,0,0,.46)';
    ctx.fillRect(22, 22, W - 44, H - 44);
    ctx.fillStyle = '#fff8dd';
    ctx.font = '900 36px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('CONNECT METAMASK TO PLAY', W / 2, H / 2);
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

connectWalletBtn.addEventListener('click', connectWallet);
startBtn.addEventListener('click', dropDoge);
canvas.addEventListener('pointerdown', () => {
  if (!dropping && walletConnected) dropDoge();
});

initBoard();
startBtn.textContent = 'Drop Doge';
startBtn.disabled = true;
requestAnimationFrame(loop);
