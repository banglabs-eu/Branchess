// Fireworks effect — ported from bang-labs.eu
// Triggers on off-board clicks and game wins

const colors = ['#6366f1', '#818cf8', '#06b6d4', '#22d3ee', '#c7d2fe', '#ffffff'];
const particles = [];
let flash = 0;
let animating = false;
let audioCtx;
let canvas, ctx, w, h;

function init() {
  canvas = document.createElement('canvas');
  canvas.id = 'bang';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function makeNoise(ac, duration) {
  const len = ac.sampleRate * duration;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function soundThunder() {
  const ac = getAudioCtx(), now = ac.currentTime;
  for (let j = 0; j < 3; j++) {
    const delay = 0.05 + j * 0.2 + Math.random() * 0.1;
    const dur = 0.6 + Math.random() * 0.5;
    const r = ac.createBufferSource();
    r.buffer = makeNoise(ac, dur);
    const rg = ac.createGain();
    rg.gain.setValueAtTime(0.001, now + delay);
    rg.gain.linearRampToValueAtTime(0.25 - j * 0.06, now + delay + 0.03);
    rg.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
    const rf = ac.createBiquadFilter();
    rf.type = 'lowpass';
    rf.frequency.setValueAtTime(400 - j * 80, now);
    rf.frequency.exponentialRampToValueAtTime(40, now + delay + dur);
    r.connect(rf).connect(rg).connect(ac.destination);
    r.start(now + delay); r.stop(now + delay + dur);
  }
}

export function bang(x, y) {
  if (!canvas) init();
  soundThunder();
  flash = 1;

  for (let i = 0; i < 120; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 8;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 1.5 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      decay: 0.008 + Math.random() * 0.012,
      trail: []
    });
  }

  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 6;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 2 + Math.random() * 2,
      color: '#ffffff',
      alpha: 1,
      decay: 0.015 + Math.random() * 0.01,
      trail: [],
      spark: true
    });
  }

  if (!animating) {
    animating = true;
    requestAnimationFrame(animate);
  }
}

// Multiple bangs for a fireworks show
export function fireworksShow() {
  if (!canvas) init();
  bang(w / 2, h / 2);
  for (let i = 1; i <= 5; i++) {
    setTimeout(() => {
      const x = w * 0.2 + Math.random() * w * 0.6;
      const y = h * 0.2 + Math.random() * h * 0.4;
      bang(x, y);
    }, i * 400);
  }
}

function animate() {
  ctx.clearRect(0, 0, w, h);

  if (flash > 0) {
    ctx.fillStyle = `rgba(99, 102, 241, ${flash * 0.15})`;
    ctx.fillRect(0, 0, w, h);
    flash -= 0.03;
  }

  let alive = false;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.alpha <= 0) {
      particles.splice(i, 1);
      continue;
    }
    alive = true;

    p.trail.push({ x: p.x, y: p.y, alpha: p.alpha });
    if (p.trail.length > 8) p.trail.shift();

    for (let t = 0; t < p.trail.length; t++) {
      const tp = p.trail[t];
      const trailAlpha = (t / p.trail.length) * tp.alpha * 0.3;
      ctx.globalAlpha = trailAlpha;
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, p.radius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();

    if (p.spark) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha * 0.15;
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.vy += 0.02;
    p.alpha -= p.decay;
  }

  if (alive || flash > 0) {
    requestAnimationFrame(animate);
  } else {
    animating = false;
  }
}
