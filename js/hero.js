/**
 * js/hero.js — Hub hero intro animation (vanilla, no build).
 *
 * Exports initHero: timeline title-chars stagger, subtitle fade, CTA spring
 * pop, plus an independent scroll-cue loop.
 * Anime.js v4 ({ animate, stagger, createTimeline, spring } from
 * 'https://esm.sh/animejs') is a progressive enhancement loaded via lazy
 * dynamic import with fallback: if the CDN is unreachable the hero content
 * is left fully visible instead of throwing.
 */

let animeCache = null;
let animeRequested = false;

/** Lazily load anime.js; resolves null when the CDN is unreachable. */
async function loadAnime() {
  if (animeRequested) return animeCache;
  animeRequested = true;
  try {
    animeCache = await import('https://esm.sh/animejs');
  } catch {
    animeCache = null; // CDN unavailable — hero renders statically.
  }
  return animeCache;
}

function reducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
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

function restoreVisible(titleEl, subtitleEl, ctaEl) {
  if (titleEl) {
    titleEl.querySelectorAll('.char').forEach((c) => {
      c.style.opacity = '1';
      c.style.transform = 'none';
    });
  }
  if (subtitleEl) {
    subtitleEl.style.opacity = '1';
    subtitleEl.style.transform = 'none';
  }
  if (ctaEl) {
    ctaEl.querySelectorAll('a, button').forEach((kid) => {
      kid.style.opacity = '1';
      kid.style.transform = 'none';
    });
  }
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

  if (reducedMotion()) return; // leave content in final visible state, no animation

  // Split first so layout is stable, but keep everything visible until the
  // animation library is confirmed loaded (no FOUC-hiding without motion).
  const chars = splitToChars(titleEl);

  loadAnime().then((mod) => {
    const animate = mod && mod.animate;
    const stagger = mod && mod.stagger;
    const createTimeline = mod && mod.createTimeline;
    const spring = mod && mod.spring;
    if (!animate || !stagger || !createTimeline || !spring) {
      restoreVisible(titleEl, subtitleEl, ctaEl);
      return; // CDN failed — content stays visible
    }

    try {
      const tl = createTimeline({
        defaults: { ease: 'outExpo' },
      });

      // 1. Title chars stagger up
      tl.add(
        chars,
        {
          y: ['110%', '0%'],
          opacity: [0, 1],
          rotateZ: [6, 0],
          duration: 850,
          delay: stagger(32, { start: 150 }),
        },
        0,
      );

      // 2. Subtitle fade + rise
      tl.add(
        subtitleEl,
        {
          opacity: [0, 1],
          y: [22, 0],
          duration: 750,
        },
        550,
      );

      // 3. CTA pop with spring
      const ctaKids = ctaEl.querySelectorAll('a, button');
      const ctaTargets = ctaKids.length ? ctaKids : ctaEl;
      tl.add(
        ctaTargets,
        {
          opacity: [0, 1],
          scale: [0.6, 1],
          y: [16, 0],
          duration: 900,
          delay: stagger(110),
          ease: spring({ stiffness: 220, damping: 16, mass: 0.9 }),
        },
        950,
      );

      // 4. Wave paths gentle rise (decorative, skip if missing)
      const waves = document.querySelectorAll('#hero .wave-path');
      if (waves.length) {
        tl.add(
          waves,
          {
            opacity: [0, 0.9],
            y: [30, 0],
            duration: 1200,
          },
          700,
        );
      }

      // Scroll cue loop (independent of intro timeline)
      const cue = document.querySelector('#hero .scroll-cue');
      if (cue) {
        animate(cue, {
          y: [0, 12, 0],
          opacity: [0.45, 1, 0.45],
          duration: 1700,
          ease: 'inOutSine',
          loop: true,
        });
      }
    } catch {
      // Animation failed mid-flight — leave everything in a visible final state.
      restoreVisible(titleEl, subtitleEl, ctaEl);
    }
  });
}

// Auto-init when loaded via its own <script type="module"> tag,
// while still allowing layout.js to import { initHero } and call it.
// Guarded so it only ever runs once.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initHero(), { once: true });
  } else {
    initHero();
  }
}
