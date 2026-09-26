// js/pages/bestiary.js — Field guide to Tacet Discords (vanilla ES module).
// Renders class-filtered Discord cards into #bestiary-grid from data/discords.json.
// Filter buttons are injected into .bestiary-filters via JS when missing.
// Anime.js v4 is an optional progressive enhancement via dynamic import;
// if the CDN is unreachable, filtering still works without motion.

let animate = null;
let stagger = null;
try {
  const animeModule = await import('https://esm.sh/animejs');
  animate = animeModule.animate;
  stagger = animeModule.stagger;
} catch {
  // CDN unavailable — bestiary renders without motion.
}

const DATA_URLS = ['data/discords.json', './data/discords.json', '../data/discords.json'];
const CLASSES = ['All', 'Common', 'Elite', 'Overlord', 'Calamity'];

let bestiaryInitialized = false;

// Inline fallback mirroring data/discords.json (name/class/attribute/drop).
const FALLBACK_DISCORDS = [
  { name: 'Crownless', class: 'Overlord', attribute: 'Havoc', drop: 'Havoc Prism' },
  { name: 'Mech Abomination', class: 'Overlord', attribute: 'Electro', drop: 'Electro Conductor' },
  { name: 'Mourning Aix', class: 'Overlord', attribute: 'Spectro', drop: 'Spectro Shard' },
  { name: 'Feilian Beringal', class: 'Overlord', attribute: 'Aero', drop: 'Aero Feather' },
  { name: 'Lampylumen Myriad', class: 'Overlord', attribute: 'Glacio', drop: 'Glacio Frost' },
  { name: 'Inferno Rider', class: 'Overlord', attribute: 'Fusion', drop: 'Fusion Igniter' },
  { name: 'Dreamless', class: 'Calamity', attribute: 'Havoc', drop: 'Nightmare Essence' },
  { name: 'Ju\u00e9', class: 'Calamity', attribute: 'Spectro', drop: 'Celestial Scale' },
  { name: 'Sentry Construct', class: 'Elite', attribute: 'Spectro', drop: 'Construct Lens' },
  { name: 'Stonewall Bracer', class: 'Elite', attribute: 'Glacio', drop: 'Stone Carapace' },
  { name: 'Hooscamp Flinger', class: 'Common', attribute: 'Aero', drop: 'Crude Ring' },
];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function reducedMotion() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

async function loadDiscords() {
  for (const url of DATA_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length) return data;
    } catch {
      // try next URL, then inline fallback
    }
  }
  return FALLBACK_DISCORDS.map((d) => ({ ...d }));
}

export async function initBestiary() {
  if (bestiaryInitialized) return;
  bestiaryInitialized = true;

  const grid = document.querySelector('#bestiary-grid');
  if (!grid) return;
  const filtersRoot =
    document.querySelector('.bestiary-filters') ||
    document.querySelector('[aria-label="Bestiary filters"]');

  const all = await loadDiscords();
  let activeClass = 'All';

  function playEntrance() {
    if (reducedMotion() || !animate || !stagger) return;
    const cards = grid.querySelectorAll('.bestiary-card');
    if (!cards.length) return;
    try {
      animate(cards, {
        opacity: [0, 1],
        translateY: [22, 0],
        duration: 500,
        delay: stagger(50),
        ease: 'outCubic',
      });
    } catch {
      // cards already visible — skip motion
    }
  }

  function cardHtml(d) {
    const attr = String(d.attribute ?? 'Unknown');
    const attrClass = 'element-' + attr.toLowerCase().replace(/[^a-z]/g, '');
    return (
      '<span class="threat">' +
      escapeHtml(d.class) +
      '-class</span>' +
      '<h3>' +
      escapeHtml(d.name) +
      '</h3>' +
      '<p><span class="element-badge ' +
      escapeHtml(attrClass) +
      '">' +
      escapeHtml(attr) +
      '</span></p>' +
      '<p class="bestiary-drop">Drops: <strong>' +
      escapeHtml(d.drop ?? 'Unknown') +
      '</strong></p>'
    );
  }

  function render() {
    const list =
      activeClass === 'All' ? all : all.filter((d) => d.class === activeClass);
    grid.innerHTML = '';
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'res-empty';
      empty.textContent = `No ${activeClass}-class Discords recorded yet.`;
      grid.appendChild(empty);
      return;
    }
    for (const d of list) {
      const card = document.createElement('article');
      card.className = 'archive-card bestiary-card';
      card.dataset.class = d.class;
      card.innerHTML = cardHtml(d);
      grid.appendChild(card);
    }
    playEntrance();
  }

  // Build class filter buttons via JS (shell leaves .bestiary-filters empty).
  if (filtersRoot && !filtersRoot.querySelector('button')) {
    for (const name of CLASSES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-btn' + (name === 'All' ? ' active' : '');
      btn.dataset.class = name;
      btn.setAttribute('aria-pressed', String(name === 'All'));
      btn.textContent = name;
      filtersRoot.appendChild(btn);
    }
  }

  if (filtersRoot) {
    filtersRoot.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-class]');
      if (!btn) return;
      activeClass = btn.dataset.class;
      filtersRoot.querySelectorAll('button[data-class]').forEach((b) => {
        const isActive = b === btn;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-pressed', String(isActive));
      });
      render();
    });
  }

  render();
}

// Auto-init when loaded via its own <script type="module"> tag,
// while still allowing dynamic import + initBestiary() calls. Guarded once.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initBestiary(), { once: true });
  } else {
    initBestiary();
  }
}
