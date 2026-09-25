// Anime.js v4 is an optional progressive enhancement loaded via dynamic import.
// If the CDN is unreachable, the statics below stay null and initHero() leaves
// the hero content fully visible instead of throwing.
let animate = null;
let stagger = null;
let createTimeline = null;
let spring = null;
try {
  ({ animate, stagger, createTimeline, spring } = await import('https://esm.sh/animejs'));
} catch {
  // CDN unavailable — hero renders statically.
}

let heroInitialized = false;

/**
 * Split an element's text into per-character spans for stagger animation.
 * Preserves accessible name via aria-label and aria-hidden chars.
 * @param {HTMLElement} el
 * @returns {HTMLElement[]} char spans
 */
function splitToChars(el) {
  const text = el.textContent;
  const trimmed = text.trim();
  el.setAttribute('aria-label', trimmed);
  el.textContent = '';
  el.setAttribute('role', 'heading');
  el.setAttribute('aria-level', '1');
  const chars = [];
  for (const ch of trimmed) {
    const span = document.createElement('span');
    span.className = 'char';
    span.setAttribute('aria-hidden', 'true');
    // Preserve spaces so wrapping still looks right
    span.innerHTML = ch === ' ' ? '&nbsp;' : ch;
    span.style.display = 'inline-block';
    span.style.willChange = 'transform, opacity';
    el.appendChild(span);
    chars.push(span);
  }
  return chars;
}

/**
 * Intro timeline for the hero: title chars stagger up,
 * subtitle fade/slide, CTA pop with spring. Scroll cue loops.
 * Safe to call multiple times (runs once). Respects prefers-reduced-motion.
 */
export function initHero() {
  if (heroInitialized) return;
  heroInitialized = true;

  const titleEl = document.getElementById('hero-title');
  const subtitleEl = document.getElementById('hero-subtitle');
  const ctaEl = document.getElementById('hero-cta');
  if (!titleEl || !subtitleEl || !ctaEl) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return; // leave content in final visible state, no animation
  if (!createTimeline || !animate || !stagger || !spring) return; // CDN failed — content stays visible

  try {
    // Prepare initial states (also set in CSS to avoid FOUC; re-assert here)
    const chars = splitToChars(titleEl);

    const tl = createTimeline({
      defaults: { ease: 'outExpo' }
    });

  // 1. Title chars stagger up
  tl.add(chars, {
    y: ['110%', '0%'],
    opacity: [0, 1],
    rotateZ: [6, 0],
    duration: 850,
    delay: stagger(32, { start: 150 })
  }, 0);

  // 2. Subtitle fade + rise
  tl.add(subtitleEl, {
    opacity: [0, 1],
    y: [22, 0],
    duration: 750
  }, 550);

  // 3. CTA pop with spring
  const ctaKids = ctaEl.querySelectorAll('a, button');
  const ctaTargets = ctaKids.length ? ctaKids : ctaEl;
  tl.add(ctaTargets, {
    opacity: [0, 1],
    scale: [0.6, 1],
    y: [16, 0],
    duration: 900,
    delay: stagger(110),
    ease: spring({ stiffness: 220, damping: 16, mass: 0.9 })
  }, 950);

  // 4. Wave paths gentle rise (decorative, skip if missing)
  const waves = document.querySelectorAll('#hero .wave-path');
  if (waves.length) {
    tl.add(waves, {
      opacity: [0, 0.9],
      y: [30, 0],
      duration: 1200
    }, 700);
  }

  // Scroll cue loop (independent of intro timeline)
  const cue = document.querySelector('#hero .scroll-cue');
  if (cue) {
    animate(cue, {
      y: [0, 12, 0],
      opacity: [0.45, 1, 0.45],
      duration: 1700,
      ease: 'inOutSine',
      loop: true
    });
  }
  } catch {
    // Animation failed mid-flight — title chars were already split, so make
    // sure everything is left in a visible final state.
    titleEl.querySelectorAll('.char').forEach((c) => {
      c.style.opacity = '1';
      c.style.transform = 'none';
    });
    subtitleEl.style.opacity = '1';
  }
}

// Auto-init when loaded via its own <script type="module"> tag,
// while still allowing js/main.js to import { initHero } and call it.
// Guarded so it only ever runs once.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initHero(), { once: true });
  } else {
    initHero();
  }
}
