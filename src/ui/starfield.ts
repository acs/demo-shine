// Animated starfield behind the app.

import { el } from './dom.js';

interface Star {
  x: number; y: number; r: number; a: number; sp: number; ph: number;
}

export function startStarfield(): void {
  const sc   = el.sf;
  const sctx = sc.getContext('2d');
  if (!sctx) return;

  function resize(): void { sc.width = window.innerWidth; sc.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  const stars: Star[] = Array.from({ length: 140 }, () => ({
    x: Math.random(), y: Math.random(),
    r: Math.random() * 1.1 + 0.15,
    a: Math.random() * 0.55 + 0.08,
    sp: Math.random() * 0.004 + 0.001,
    ph: Math.random() * Math.PI * 2,
  }));

  let tick = 0;
  (function loop() {
    sctx.clearRect(0, 0, sc.width, sc.height);
    tick += 0.008;
    for (const s of stars) {
      const a = s.a * (.45 + .55 * Math.sin(tick * s.sp * 200 + s.ph));
      sctx.beginPath();
      sctx.arc(s.x * sc.width, s.y * sc.height, s.r, 0, Math.PI * 2);
      sctx.fillStyle = `rgba(175,185,215,${a.toFixed(3)})`;
      sctx.fill();
    }
    requestAnimationFrame(loop);
  })();
}
