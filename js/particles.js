/**
 * Lightweight canvas particle field for the hero background.
 * 60 cyan drifting particles with proximity connect-lines.
 * No dependencies. Respects prefers-reduced-motion (static frame).
 */

let particlesInitialized = false;

const PARTICLE_COUNT = 60;
const LINK_DISTANCE = 130;
const LINK_DISTANCE_SQ = LINK_DISTANCE * LINK_DISTANCE;

export function initParticles() {
  if (particlesInitialized) return;
  particlesInitialized = true;

  const canvas = document.getElementById('tacet-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let particles = [];
  let rafId = 0;
  let running = true;
  let w = 0;
  let h = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    // Fall back to hero size / window if rect is 0 (e.g. CSS not loaded yet)
    w = Math.max(1, Math.floor(rect.width || canvas.clientWidth || window.innerWidth));
    h = Math.max(1, Math.floor(rect.height || canvas.clientHeight || 600));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: 0.8 + Math.random() * 1.8
    }));
  }

  function step() {
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // Connect lines first (behind dots)
    ctx.lineWidth = 1;
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < LINK_DISTANCE_SQ) {
          const alpha = 0.22 * (1 - d2 / LINK_DISTANCE_SQ);
          ctx.strokeStyle = `rgba(103, 232, 249, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Dots
    for (const p of particles) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(103, 232, 249, 0.85)';
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame() {
    if (!running) return;
    step();
    draw();
    rafId = requestAnimationFrame(frame);
  }

  resize();
  seed();

  if (prefersReduced) {
    // Single static render, no loop
    draw();
  } else {
    frame();
  }

  // Keep canvas fitted to hero on resize (debounced)
  let t = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(t);
    t = window.setTimeout(() => {
      resize();
      if (prefersReduced) draw();
    }, 150);
  });

  // Pause when hero is off-screen to save battery
  if ('IntersectionObserver' in window && !prefersReduced) {
    const hero = document.getElementById('hero');
    if (hero) {
      new IntersectionObserver(
        (entries) => {
          const visible = entries[0].isIntersecting;
          if (visible && !running) {
            running = true;
            frame();
          } else if (!visible && running) {
            running = false;
            cancelAnimationFrame(rafId);
          }
        },
        { threshold: 0 }
      ).observe(hero);
    }
  }

  // Pause when tab hidden
  document.addEventListener('visibilitychange', () => {
    if (prefersReduced) return;
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(rafId);
    } else if (!running) {
      const hero = document.getElementById('hero');
      if (!hero || hero.getBoundingClientRect().bottom > 0) {
        running = true;
        frame();
      }
    }
  });
}

// Auto-init when loaded via its own <script type="module"> tag,
// while still allowing js/main.js to import { initParticles }.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initParticles(), { once: true });
  } else {
    initParticles();
  }
}
