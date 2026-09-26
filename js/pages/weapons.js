/**
 * js/pages/weapons.js — Armoury grid for weapons.html.
 *
 * Target (shell-owned): #weapon-grid (30 weapons from data/weapons.json).
 * Adds a type filter row via JS (shell has no filter markup), groups by type,
 * and resolves signatureFor ids to resonator names via data/resonators.json.
 *
 * Motion: dynamic import('https://esm.sh/animejs') with try/catch fallback;
 * stagger(60) entrance; prefers-reduced-motion disables animation.
 */

let initialized = false;
let animeCache = null;

async function loadAnime() {
  if (animeCache) return animeCache;
  try {
    const mod = await import('https://esm.sh/animejs');
    animeCache = {
      animate: mod.animate ?? mod.default?.animate ?? null,
      stagger: mod.stagger ?? mod.default?.stagger ?? null,
    };
  } catch {
    animeCache = { animate: null, stagger: null };
  }
  return animeCache;
}

function reduceMotion() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stars(rarity) {
  const n = Math.max(0, Math.min(5, Number(rarity) || 0));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function humanize(id) {
  return String(id ?? '')
    .split('-')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

async function fetchFirst(urls) {
  let lastError = null;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastError = new Error('HTTP ' + res.status + ' for ' + url);
        continue;
      }
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error('fetch failed');
}

/**
 * Render the weapon armoury. Returns { rendered, total, types }.
 */
export async function init() {
  if (initialized) return { rendered: 0, total: 0, skipped: true };
  const grid = document.querySelector('#weapon-grid');
  if (!grid) return { rendered: 0, total: 0, missing: true };
  initialized = true;

  const { animate, stagger } = await loadAnime();
  let activeType = 'All';

  let weapons = [];
  let loadError = null;
  try {
    weapons = await fetchFirst([
      'data/weapons.json',
      './data/weapons.json',
      '../data/weapons.json',
    ]);
    if (!Array.isArray(weapons)) weapons = [];
  } catch (err) {
    loadError = err;
  }

  const resonatorNames = new Map();
  try {
    const resonators = await fetchFirst([
      'data/resonators.json',
      './data/resonators.json',
      '../data/resonators.json',
    ]);
    if (Array.isArray(resonators)) {
      for (const r of resonators) {
        if (r?.id) resonatorNames.set(String(r.id).toLowerCase(), r.name ?? humanize(r.id));
      }
    }
  } catch {
    // Names fall back to humanized ids.
  }

  if (loadError) {
    const viaFile = typeof location !== 'undefined' && location.protocol === 'file:';
    const p = document.createElement('p');
    p.className = 'shell-note';
    p.textContent =
      'Could not load data/weapons.json (' +
      (loadError.message || loadError) +
      '). ' +
      (viaFile
        ? 'Opened via file:// — fetch is blocked. Serve the folder over http (e.g. `npx serve`).'
        : 'Check that data/weapons.json exists relative to this page.');
    grid.prepend(p);
    return { rendered: 0, total: 0, error: String(loadError.message || loadError) };
  }

  const types = ['All', ...[...new Set(weapons.map((w) => w.type ?? 'Unknown'))].sort()];

  // Filter row (created via JS — shell has no filter markup).
  let filterRow = document.querySelector('[data-weapon-filters]');
  if (!filterRow) {
    filterRow = document.createElement('div');
    filterRow.className = 'filter-row';
    filterRow.dataset.weaponFilters = 'true';
    filterRow.setAttribute('role', 'toolbar');
    filterRow.setAttribute('aria-label', 'Weapon type filters');
    const label = document.createElement('span');
    label.className = 'filter-label';
    label.textContent = 'Type';
    filterRow.appendChild(label);
    for (const t of types) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-btn' + (t === 'All' ? ' active' : '');
      btn.dataset.typeFilter = t;
      btn.setAttribute('aria-pressed', String(t === 'All'));
      btn.textContent = t;
      filterRow.appendChild(btn);
    }
    grid.parentElement?.insertBefore(filterRow, grid);
  }

  let countLine = grid.parentElement?.querySelector('.weapon-count') ?? null;
  if (!countLine && grid.parentElement) {
    countLine = document.createElement('p');
    countLine.className = 'weapon-count res-count';
    countLine.setAttribute('aria-live', 'polite');
    grid.parentElement.insertBefore(countLine, grid);
  }

  function signatureNames(w) {
    const ids = Array.isArray(w.signatureFor) ? w.signatureFor : [];
    if (!ids.length) return 'No recorded wielder';
    return ids
      .map((id) => resonatorNames.get(String(id).toLowerCase()) ?? humanize(id))
      .join(', ');
  }

  function playEntrance() {
    if (reduceMotion() || !animate) return;
    try {
      const cards = grid.querySelectorAll('.weapon-card');
      if (!cards.length) return;
      animate(cards, {
        opacity: [0, 1],
        translateY: [24, 0],
        delay: typeof stagger === 'function' ? stagger(60) : 0,
        duration: 550,
        ease: 'outCubic',
      });
    } catch {
      // Grid is readable without motion.
    }
  }

  function render() {
    const list = weapons.filter((w) => activeType === 'All' || w.type === activeType);
    // Keep groups stable: sort by type then rarity desc then name.
    list.sort(
      (a, b) =>
        String(a.type).localeCompare(String(b.type)) ||
        Number(b.rarity) - Number(a.rarity) ||
        String(a.name).localeCompare(String(b.name)),
    );
    grid.innerHTML = '';
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'res-empty';
      empty.textContent = weapons.length
        ? 'No ' + activeType + ' weapons recorded.'
        : 'No weapon data available.';
      grid.appendChild(empty);
    }
    for (const w of list) {
      const card = document.createElement('article');
      card.className = 'archive-card weapon-card';
      card.id = 'weapon-' + w.id;
      card.dataset.id = w.id;
      card.dataset.type = w.type ?? '';
      card.innerHTML =
        '<h3>' +
        esc(w.name ?? w.id) +
        '</h3>' +
        '<p class="res-badges">' +
        '<span class="res-badge">' +
        esc(w.type ?? 'Unknown') +
        '</span> ' +
        '<span class="res-badge" aria-label="' +
        esc(w.rarity) +
        ' stars">' +
        esc(stars(w.rarity)) +
        '</span></p>' +
        '<p class="res-meta">Signature for: ' +
        esc(signatureNames(w)) +
        '</p>';
      grid.appendChild(card);
    }
    // Deep-link support: #weapon-<id> from dossier pages.
    if (typeof location !== 'undefined' && location.hash.startsWith('#weapon-')) {
      const target = grid.querySelector(decodeURIComponent(location.hash));
      if (target) {
        target.setAttribute('tabindex', '-1');
        try {
          target.scrollIntoView({ block: 'nearest' });
        } catch {
          // Scroll is cosmetic.
        }
      }
    }
    if (countLine) countLine.textContent = list.length + ' / ' + weapons.length + ' weapons';
    playEntrance();
    return list.length;
  }

  filterRow.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type-filter]');
    if (!btn) return;
    activeType = btn.dataset.typeFilter || 'All';
    filterRow.querySelectorAll('[data-type-filter]').forEach((b) => {
      const on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    render();
  });

  const rendered = render();
  return { rendered, total: weapons.length, types: types.length };
}

export const initWeapons = init;
export const initWeaponsPage = init;

function autoInit() {
  if (document.querySelector('#weapon-grid')) {
    init().catch((err) => console.error('[weapons] init failed:', err));
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit, { once: true });
  } else {
    autoInit();
  }
}
