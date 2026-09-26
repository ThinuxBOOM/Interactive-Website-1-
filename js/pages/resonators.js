/**
 * js/pages/resonators.js — Resonator roster for resonators.html.
 *
 * Targets (shell-owned, do not edit HTML here):
 *   #resonator-grid  — card grid (each card links to resonator.html?id=<id>)
 *   #filter-bar      — existing Element + Weapon rows; rarity/version rows added via JS
 *   #search          — text search input
 *
 * Data (relative fetches, document-base):
 *   data/resonators.json (55 entries), data/art-manifest.json ({id, localFile})
 *
 * Motion: dynamic import('https://esm.sh/animejs') with try/catch fallback;
 * stagger(60) entrance; prefers-reduced-motion disables animation.
 * Images: local assets/official only (art-manifest localFile SVGs), no hotlinks.
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

function attrOf(r) {
  return r.attribute ?? r.element ?? 'Unknown';
}

function stars(rarity) {
  const n = Math.max(0, Math.min(5, Number(rarity) || 0));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
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

function dataNotice(container, text) {
  const p = document.createElement('p');
  p.className = 'shell-note';
  p.textContent = text;
  container.prepend(p);
}

function playEntrance(animate, stagger, scope) {
  if (reduceMotion() || !animate) return;
  try {
    const cards = scope.querySelectorAll('.res-card');
    if (!cards.length) return;
    if (typeof stagger === 'function') {
      animate(cards, {
        opacity: [0, 1],
        translateY: [24, 0],
        delay: stagger(60),
        duration: 600,
        ease: 'outCubic',
      });
    } else {
      animate(cards, { opacity: [0, 1], translateY: [24, 0], duration: 600, ease: 'outCubic' });
    }
  } catch {
    // Motion is decorative — grid is already readable.
  }
}

function artFallbackFor(id) {
  // Local placeholder only — never hotlink. Missing SVGs fall back to the
  // initial avatar via the img error handler wired in render().
  return 'assets/official/resonators/' + String(id ?? '').toLowerCase() + '.svg';
}

function cardHtml(r, artFile) {
  const name = r.name ?? r.id;
  const attr = attrOf(r);
  const initial = esc(String(name).charAt(0).toUpperCase());
  const art = artFile
    ? '<img class="res-art" src="' +
      esc(artFile) +
      '" alt="' +
      esc(name) +
      ' portrait" loading="lazy" width="96" height="96" />'
    : '<div class="res-avatar" aria-hidden="true">' + initial + '</div>';
  return (
    '<a class="res-card-link" href="resonator.html?id=' +
    encodeURIComponent(r.id) +
    '" aria-label="Open dossier for ' +
    esc(name) +
    '">' +
    art +
    '<h3 class="res-name">' +
    esc(name) +
    '</h3>' +
    '<p class="res-badges">' +
    '<span class="element-badge element-' +
    esc(String(attr).toLowerCase()) +
    '">' +
    esc(attr) +
    '</span> ' +
    '<span class="res-badge">' +
    esc(r.weapon ?? 'Unknown') +
    '</span> ' +
    '<span class="res-badge" aria-label="' +
    esc(r.rarity) +
    ' stars">' +
    esc(stars(r.rarity)) +
    '</span> ' +
    '<span class="res-badge">' +
    esc(r.faction ?? 'No faction') +
    '</span>' +
    '</p>' +
    '<p class="res-meta">v' +
    esc(r.version ?? '?') +
    ' · ' +
    esc(r.role ?? '') +
    '</p>' +
    '</a>'
  );
}

function buildExtraFilterRow(label, group, options, activeValue) {
  const row = document.createElement('div');
  row.className = 'filter-row';
  row.setAttribute('aria-label', 'Filter by ' + label.toLowerCase());
  const span = document.createElement('span');
  span.className = 'filter-label';
  span.textContent = label;
  row.appendChild(span);
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-btn' + (String(opt) === String(activeValue) ? ' active' : '');
    btn.dataset[group] = String(opt);
    btn.setAttribute('aria-pressed', String(String(opt) === String(activeValue)));
    btn.textContent = group === 'rarity' && opt !== 'All' ? opt + '★' : String(opt);
    row.appendChild(btn);
  }
  return row;
}

function setActiveInGroup(filterBar, selector, btn) {
  filterBar.querySelectorAll(selector).forEach((b) => {
    const on = b === btn;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

/**
 * Render the resonator roster. Returns { rendered, total } counts.
 */
export async function init() {
  if (initialized) return { rendered: 0, total: 0, skipped: true };
  const grid = document.querySelector('#resonator-grid');
  if (!grid) return { rendered: 0, total: 0, missing: true };
  initialized = true;

  const filterBar = document.querySelector('#filter-bar');
  const searchInput = document.querySelector('#search');
  const state = { attribute: 'All', weapon: 'All', rarity: 'All', version: 'All', search: '' };
  const { animate, stagger } = await loadAnime();

  let all = [];
  let loadError = null;
  try {
    all = await fetchFirst([
      'data/resonators.json',
      './data/resonators.json',
      '../data/resonators.json',
    ]);
    if (!Array.isArray(all)) all = [];
  } catch (err) {
    loadError = err;
    all = [];
  }

  const artById = new Map();
  try {
    const manifest = await fetchFirst([
      'data/art-manifest.json',
      './data/art-manifest.json',
      '../data/art-manifest.json',
    ]);
    if (Array.isArray(manifest)) {
      for (const m of manifest) {
        if (m && m.id && m.localFile) artById.set(m.id, m.localFile);
      }
    }
  } catch {
    // Art is progressive enhancement — cards fall back to initial avatars.
  }

  if (loadError) {
    const viaFile = typeof location !== 'undefined' && location.protocol === 'file:';
    dataNotice(
      grid,
      'Could not load data/resonators.json (' +
        (loadError.message || loadError) +
        '). ' +
        (viaFile
          ? 'It looks like this page was opened via file:// — fetch is blocked. Serve the folder over http (e.g. `npx serve`) to see all 55 resonators.'
          : 'Check that data/resonators.json exists relative to this page.'),
    );
  }

  // Extra filter rows (shell owns Element + Weapon; JS adds Rarity + Version).
  let countLine = grid.parentElement?.querySelector('.res-count') ?? null;
  if (filterBar && all.length) {
    const rarities = ['All', ...[...new Set(all.map((r) => String(r.rarity)))].sort()];
    const versions = [
      'All',
      ...[...new Set(all.map((r) => String(r.version ?? '?')))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    ];
    filterBar.appendChild(buildExtraFilterRow('Rarity', 'rarity', rarities, 'All'));
    filterBar.appendChild(buildExtraFilterRow('Version', 'version', versions, 'All'));

    filterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      if (btn.dataset.weapon !== undefined && btn.dataset.weapon !== '') {
        state.weapon = btn.dataset.weapon;
        setActiveInGroup(filterBar, '.filter-btn[data-weapon]', btn);
      } else if (btn.dataset.rarity !== undefined && btn.dataset.rarity !== '') {
        state.rarity = btn.dataset.rarity;
        setActiveInGroup(filterBar, '.filter-btn[data-rarity]', btn);
      } else if (btn.dataset.version !== undefined && btn.dataset.version !== '') {
        state.version = btn.dataset.version;
        setActiveInGroup(filterBar, '.filter-btn[data-version]', btn);
      } else {
        state.attribute = btn.dataset.filter || 'All';
        setActiveInGroup(filterBar, '.filter-btn[data-filter]', btn);
      }
      render();
    });
  } else if (filterBar) {
    // Data failed to load — still wire the shell's own Element/Weapon buttons.
    filterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      if (btn.dataset.weapon !== undefined && btn.dataset.weapon !== '') {
        state.weapon = btn.dataset.weapon;
        setActiveInGroup(filterBar, '.filter-btn[data-weapon]', btn);
      } else {
        state.attribute = btn.dataset.filter || 'All';
        setActiveInGroup(filterBar, '.filter-btn[data-filter]', btn);
      }
      render();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      state.search = searchInput.value.trim().toLowerCase();
      render();
    });
  }

  function getFiltered() {
    return all.filter((r) => {
      if (state.attribute !== 'All' && attrOf(r) !== state.attribute) return false;
      if (state.weapon !== 'All' && r.weapon !== state.weapon) return false;
      if (state.rarity !== 'All' && String(r.rarity) !== state.rarity) return false;
      if (state.version !== 'All' && String(r.version ?? '?') !== state.version) return false;
      if (state.search && !String(r.name ?? '').toLowerCase().includes(state.search)) return false;
      return true;
    });
  }

  function render() {
    const list = getFiltered();
    grid.innerHTML = '';
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'res-empty';
      empty.textContent = all.length
        ? 'No resonators match these filters.'
        : 'No resonator data available.';
      grid.appendChild(empty);
    } else {
      for (const r of list) {
        const card = document.createElement('article');
        card.className = 'res-card archive-card';
        card.dataset.id = r.id;
        card.dataset.attribute = attrOf(r);
        card.dataset.weapon = r.weapon ?? '';
        const art = artById.get(r.id) || artFallbackFor(r.id);
        card.innerHTML = cardHtml(r, art);
        // Local-art fallback: a missing SVG (e.g. ids without a generated
        // placeholder) swaps to the initial avatar instead of a broken image.
        const img = card.querySelector('img.res-art');
        if (img) {
          img.addEventListener('error', () => {
            const avatar = document.createElement('div');
            avatar.className = 'res-avatar';
            avatar.setAttribute('aria-hidden', 'true');
            avatar.textContent = String(r.name ?? '?').charAt(0).toUpperCase();
            img.replaceWith(avatar);
          });
        }
        grid.appendChild(card);
      }
    }
    if (countLine) countLine.textContent = list.length + ' / ' + all.length + ' resonators';
    playEntrance(animate, stagger, grid);
    return list.length;
  }

  if (!countLine && grid.parentElement) {
    countLine = document.createElement('p');
    countLine.className = 'res-count';
    countLine.setAttribute('aria-live', 'polite');
    grid.parentElement.insertBefore(countLine, grid);
  }

  const rendered = render();
  return { rendered, total: all.length };
}

export const initResonators = init;
export const initResonatorsPage = init;

function autoInit() {
  if (document.querySelector('#resonator-grid')) {
    init().catch((err) => console.error('[resonators] init failed:', err));
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit, { once: true });
  } else {
    autoInit();
  }
}
