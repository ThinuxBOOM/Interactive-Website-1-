/**
 * js/hub.js — Archive index (hub) interactions for index.html (vanilla, no build).
 *
 * - Stagger entrance for #hub .hub-card cards when the hub scrolls into view.
 * - Wires #hub links: hover/focus lift (progressive enhancement) and smooth
 *   same-page anchor scrolling that respects prefers-reduced-motion.
 * - Anime.js is progressive enhancement via lazy dynamic import with fallback:
 *   when the CDN is unreachable the cards simply render statically.
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
    animeCache = null; // CDN unavailable — hub still renders, motion skipped.
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

let hubInitialized = false;
let entrancePlayed = false;

function playEntrance(cards) {
  if (entrancePlayed || !cards.length) return;
  entrancePlayed = true;
  loadAnime().then((mod) => {
    if (!mod || typeof mod.animate !== 'function' || typeof mod.stagger !== 'function') return;
    try {
      mod.animate(cards, {
        opacity: [0, 1],
        y: [26, 0],
        duration: 650,
        delay: mod.stagger(70),
        ease: 'outExpo',
      });
    } catch {
      // motion failed — cards are already in the DOM and visible
    }
  });
}

function bindHover(card) {
  if (reducedMotion()) return;
  const lift = (scale) => {
    loadAnime().then((mod) => {
      if (!mod || typeof mod.animate !== 'function') return;
      try {
        mod.animate(card, { scale, duration: 220, ease: 'outCubic' });
      } catch {
        // ignore animation failure
      }
    });
  };
  card.addEventListener('mouseenter', () => lift(1.02));
  card.addEventListener('mouseleave', () => lift(1));
  card.addEventListener('focusin', () => lift(1.02));
  card.addEventListener('focusout', () => lift(1));
}

function initHashLinks(scope) {
  scope.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href^="#"]');
    if (!anchor) return;
    const hash = anchor.getAttribute('href');
    if (!hash || hash === '#') return;
    const target = document.querySelector(hash);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    try {
      history.replaceState(null, '', hash);
    } catch {
      // hash update is cosmetic — ignore failures
    }
  });
}

async function countFor(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data)) return data.length;
    } catch {
      // try next URL
    }
  }
  return null;
}

/**
 * Update [data-count-for] spans inside hub cards with live data counts.
 * Static fallback text in the shell stays when fetch fails (file://).
 */
async function refreshHubCounts(hub) {
  const slots = Array.from(hub.querySelectorAll('[data-count-for]'));
  if (!slots.length) return;
  const base = (p) => ['data/' + p, './data/' + p, '../data/' + p];
  let results = {};
  try {
    const [resonators, echoes, weapons, regions, lore, quests, discords, sonatas] =
      await Promise.all([
        countFor(base('resonators.json')),
        countFor(base('echoes.json')),
        countFor(base('weapons.json')),
        countFor(base('regions.json')),
        countFor(base('lore.json')),
        countFor(base('quests.json')),
        countFor(base('discords.json')),
        countFor(base('sonatas.json')),
      ]);
    results = { resonators, echoes, weapons, regions, lore, quests, discords, sonatas };
  } catch {
    return;
  }
  const labels = {
    resonators: (n) => n + ' Resonators',
    echoes: (n) => n + ' Echoes',
    weapons: (n) => n + ' Weapons',
    regions: (n) => n + ' Nations',
    lore: (n) => n + ' Records',
    quests: (n) => n + ' Quests',
    discords: (n) => n + ' Discords',
    sonatas: (n) => n + ' Sonata sets',
  };
  for (const el of slots) {
    const key = el.getAttribute('data-count-for');
    const n = results[key];
    if (typeof n === 'number' && labels[key]) el.textContent = labels[key](n);
  }
}

/**
 * Animate hub cards stagger entrance and wire #hub links.
 * Safe to call multiple times (runs once). No-ops off the hub page.
 */
export function initHub() {
  if (hubInitialized) return;
  const hub = document.getElementById('hub');
  if (!hub) return; // not the hub page — stay dormant
  hubInitialized = true;

  const cards = Array.from(hub.querySelectorAll('.hub-card'));

  // Live archive counts (progressive enhancement — static fallback text in
  // index.html already shows 55/18/30/4/20/25/15 when fetch is unavailable).
  refreshHubCounts(hub);

  // Wire links: hover/focus lift + same-page hash smooth scrolling.
  cards.forEach(bindHover);
  initHashLinks(hub);
  const cta = document.getElementById('hero-cta');
  if (cta) initHashLinks(cta);

  if (reducedMotion() || !cards.length) return; // leave cards statically visible

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.disconnect();
          playEntrance(cards);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(hub);
  } else {
    playEntrance(cards);
  }
}

// Auto-init when loaded via its own <script type="module"> tag,
// while still allowing layout.js to import { initHub } and call it.
// Guarded so it only ever runs once.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initHub(), { once: true });
  } else {
    initHub();
  }
}
