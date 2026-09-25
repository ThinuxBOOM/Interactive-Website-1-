import { initHero } from './hero.js';
import { initParticles } from './particles.js';
import { initResonators } from './resonators.js';
import { initConvene } from './convene.js';
import { initTeam } from './team.js';

function initSmoothScroll() {
  const prefersReduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      const hash = anchor.getAttribute('href');
      if (!hash || hash === '#') return;
      const target = document.querySelector(hash);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
      try {
        history.replaceState(null, '', hash);
      } catch {
        // ignore — hash update is cosmetic
      }
    });
  });
}

function safeInit(label, fn) {
  try {
    const result = fn();
    if (result && typeof result.catch === 'function') {
      result.catch((err) => console.error(`[main] ${label} failed:`, err));
    }
  } catch (err) {
    console.error(`[main] ${label} failed:`, err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  safeInit('hero', initHero);
  safeInit('particles', initParticles);
  safeInit('resonators', initResonators);
  safeInit('convene', initConvene);
  safeInit('team', initTeam);
  safeInit('smooth-scroll', initSmoothScroll);
  console.log('[main] ready: hero, particles, resonators, convene, team');
});
