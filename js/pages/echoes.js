/**
 * js/pages/echoes.js — Echo gallery + Sonata builder for echoes.html.
 *
 * Targets (shell-owned): #echo-grid, #sonata-builder (.sonata-slots), #sonata-preview
 * Data: data/echoes.json (18 entries), data/sonatas.json (9 sets).
 * Builder: click up to 5 echoes → live 2pc/5pc sonata preview in #sonata-preview
 * with a pop animation on update.
 *
 * Motion: dynamic import('https://esm.sh/animejs') with try/catch fallback;
 * prefers-reduced-motion disables animation. No external images.
 */

let initialized = false;
let animeCache = null;

const MAX_SLOTS = 5;

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

function pop(animate, el) {
  if (reduceMotion() || !animate || !el) return;
  try {
    animate(el, { scale: [0.96, 1], opacity: [0.4, 1], duration: 280, ease: 'outCubic' });
  } catch {
    // Decorative only.
  }
}

/**
 * Render the echo gallery + sonata builder.
 * Returns { renderedEchoes, renderedSonatas, selected }.
 */
export async function init() {
  if (initialized) return { renderedEchoes: 0, renderedSonatas: 0, skipped: true };
  const grid = document.querySelector('#echo-grid');
  const builder = document.querySelector('#sonata-builder');
  const preview = document.querySelector('#sonata-preview');
  if (!grid || !builder || !preview) {
    return { renderedEchoes: 0, renderedSonatas: 0, missing: true };
  }
  initialized = true;

  const { animate, stagger } = await loadAnime();

  let echoes = [];
  let sonatas = [];
  let loadError = null;
  try {
    [echoes, sonatas] = await Promise.all([
      fetchFirst(['data/echoes.json', './data/echoes.json', '../data/echoes.json']),
      fetchFirst(['data/sonatas.json', './data/sonatas.json', '../data/sonatas.json']),
    ]);
    if (!Array.isArray(echoes)) echoes = [];
    if (!Array.isArray(sonatas)) sonatas = [];
  } catch (err) {
    loadError = err;
  }

  if (loadError) {
    const viaFile = typeof location !== 'undefined' && location.protocol === 'file:';
    const p = document.createElement('p');
    p.className = 'shell-note';
    p.textContent =
      'Could not load echo data (' +
      (loadError.message || loadError) +
      '). ' +
      (viaFile
        ? 'Opened via file:// — fetch is blocked. Serve the folder over http (e.g. `npx serve`).'
        : 'Check that data/echoes.json and data/sonatas.json exist.');
    grid.prepend(p);
    return { renderedEchoes: 0, renderedSonatas: 0, error: String(loadError.message || loadError) };
  }

  const sonataById = new Map(sonatas.map((s) => [s.id, s]));
  const echoById = new Map(echoes.map((e) => [e.id, e]));
  const selected = [];

  // --- Gallery ---
  grid.innerHTML = '';
  if (!echoes.length) {
    const empty = document.createElement('p');
    empty.className = 'res-empty';
    empty.textContent = 'No echo data available.';
    grid.appendChild(empty);
  }
  for (const e of echoes) {
    const card = document.createElement('article');
    card.className = 'archive-card echo-card';
    card.dataset.id = e.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-pressed', 'false');
    card.setAttribute('aria-label', 'Toggle ' + (e.name ?? e.id) + ' in the Sonata builder');
    const tags = (Array.isArray(e.sonatas) ? e.sonatas : [])
      .map((sid) => {
        const s = sonataById.get(sid);
        return '<span class="res-badge">' + esc(s ? s.name : sid) + '</span>';
      })
      .join(' ');
    card.innerHTML =
      '<h3>' +
      esc(e.name ?? e.id) +
      '</h3>' +
      '<p class="res-meta">Class: ' +
      esc(e.class ?? '?') +
      ' · Cost ' +
      esc(e.cost ?? '?') +
      '</p>' +
      '<p>' +
      esc(e.skill ?? '') +
      '</p>' +
      '<p class="res-badges">' +
      tags +
      '</p>';
    grid.appendChild(card);
  }

  if (!reduceMotion() && animate) {
    try {
      const cards = grid.querySelectorAll('.echo-card');
      if (cards.length) {
        animate(cards, {
          opacity: [0, 1],
          translateY: [24, 0],
          delay: typeof stagger === 'function' ? stagger(60) : 0,
          duration: 550,
          ease: 'outCubic',
        });
      }
    } catch {
      // Gallery is readable without motion.
    }
  }

  // --- Builder slots ---
  let slotsEl = builder.querySelector('.sonata-slots');
  if (!slotsEl) {
    slotsEl = document.createElement('div');
    slotsEl.className = 'sonata-slots';
    slotsEl.setAttribute('aria-label', 'Sonata echo slots');
    builder.appendChild(slotsEl);
  }
  let clearBtn = builder.querySelector('[data-clear-sonata]');
  if (!clearBtn) {
    clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'filter-btn';
    clearBtn.dataset.clearSonata = 'true';
    clearBtn.textContent = 'Clear (0/5)';
    builder.appendChild(clearBtn);
  }
  clearBtn.addEventListener('click', () => {
    selected.length = 0;
    sync();
  });

  function toggle(id) {
    const at = selected.indexOf(id);
    if (at >= 0) selected.splice(at, 1);
    else if (selected.length < MAX_SLOTS) selected.push(id);
    sync();
  }

  function activeSets() {
    const counts = new Map();
    for (const id of selected) {
      const e = echoById.get(id);
      for (const sid of e?.sonatas ?? []) counts.set(sid, (counts.get(sid) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([sid, count]) => ({ sonata: sonataById.get(sid) ?? { id: sid, name: sid }, count }))
      .sort((a, b) => b.count - a.count);
  }

  function renderPreview() {
    if (!selected.length) {
      preview.textContent = 'Select Echoes to preview the active Sonata effect.';
      return;
    }
    const sets = activeSets();
    const cost = selected.reduce((n, id) => n + (Number(echoById.get(id)?.cost) || 0), 0);
    let html =
      '<p><strong>' +
      selected.length +
      '/5 echoes</strong> · total cost ' +
      cost +
      '</p><ul>';
    let anyBonus = false;
    for (const { sonata, count } of sets) {
      const tiers = [];
      if (count >= 2 && sonata.bonus2) {
        tiers.push('<span>2pc: ' + esc(sonata.bonus2) + '</span>');
        anyBonus = true;
      }
      if (count >= 5 && sonata.bonus5) {
        tiers.push('<span>5pc: ' + esc(sonata.bonus5) + '</span>');
        anyBonus = true;
      }
      html +=
        '<li><strong>' +
        esc(sonata.name ?? sonata.id) +
        '</strong> ×' +
        count +
        (tiers.length ? ' — ' + tiers.join(' · ') : ' <em>(need 2 for bonus)</em>') +
        '</li>';
    }
    html += '</ul>';
    if (!anyBonus) {
      html += '<p><em>No 2pc bonus yet — match at least two echoes sharing a Sonata.</em></p>';
    }
    preview.innerHTML = html;
  }

  function sync() {
    slotsEl.innerHTML = '';
    for (let i = 0; i < MAX_SLOTS; i++) {
      const slot = document.createElement('div');
      const id = selected[i];
      slot.className = 'sonata-slot' + (id ? ' filled' : '');
      slot.textContent = id ? (echoById.get(id)?.name ?? id) : 'Empty slot ' + (i + 1);
      slotsEl.appendChild(slot);
    }
    grid.querySelectorAll('.echo-card').forEach((card) => {
      const on = selected.includes(card.dataset.id);
      card.classList.toggle('selected', on);
      card.setAttribute('aria-pressed', String(on));
    });
    clearBtn.textContent = 'Clear (' + selected.length + '/5)';
    renderPreview();
    pop(animate, preview);
  }

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.echo-card');
    if (card?.dataset.id) toggle(card.dataset.id);
  });
  grid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.echo-card');
    if (!card?.dataset.id) return;
    e.preventDefault();
    toggle(card.dataset.id);
  });

  sync();
  return { renderedEchoes: echoes.length, renderedSonatas: sonatas.length, selected };
}

export const initEchoes = init;
export const initEchoesPage = init;

function autoInit() {
  if (document.querySelector('#echo-grid')) {
    init().catch((err) => console.error('[echoes] init failed:', err));
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit, { once: true });
  } else {
    autoInit();
  }
}
