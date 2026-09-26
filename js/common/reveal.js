/**
 * js/common/reveal.js — scroll-reveal progressive enhancement.
 * - Uses IntersectionObserver to add `.revealed` to `[data-reveal]` elements.
 * - Optionally enhances with anime.js (dynamic CDN import); falls back to
 *   pure CSS class transitions when the CDN is unreachable.
 * - Respects `prefers-reduced-motion`: reveals instantly, no animation.
 */

let animeModule = null;
let animeRequested = false;

async function loadAnime() {
  if (animeRequested) return animeModule;
  animeRequested = true;
  try {
    animeModule = await import('https://esm.sh/animejs');
  } catch {
    animeModule = null; // CDN unreachable — CSS fallback covers the reveal.
  }
  return animeModule;
}

/**
 * Observe `[data-reveal]` descendants of `root` and reveal them on entry.
 * Safe to call multiple times; already-revealed nodes are skipped.
 * @param {ParentNode} [root=document]
 */
export function initReveal(root = document) {
  const nodes = Array.from(root.querySelectorAll('[data-reveal]:not(.revealed)'));
  if (!nodes.length) return;

  const prefersReduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReduced || !('IntersectionObserver' in window)) {
    // Instant final state — no animation.
    nodes.forEach((el) => el.classList.add('revealed'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        observer.unobserve(el);
        el.classList.add('revealed');
        // Progressive enhancement: subtle rise via anime.js when available.
        loadAnime().then((mod) => {
          if (!mod || !mod.animate) return;
          if (document.querySelector('html').dataset.revealAnime === 'off') return;
          try {
            mod.animate(el, {
              opacity: [0.25, 1],
              y: [18, 0],
              duration: 600,
              ease: 'outExpo',
            });
          } catch {
            // Animation failure must never hide content — class already applied.
          }
        });
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  );

  nodes.forEach((el) => observer.observe(el));
}
