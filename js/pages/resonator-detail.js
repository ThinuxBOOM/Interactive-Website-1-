/**
 * js/pages/resonator-detail.js — Dossier view for resonator.html.
 *
 * Target (shell-owned): #dossier
 * Reads ?id=, fetches data/resonators.json (+ art-manifest for local art,
 * data/weapons.json for the signature weapon), renders the full dossier:
 * large art, lore, forte mark/spectrum, skills list, signature weapon link,
 * back link. Dossier entrance plays as an anime.js timeline (with fallback).
 *
 * Motion: dynamic import('https://esm.sh/animejs') with try/catch fallback;
 * prefers-reduced-motion disables animation.
 * Images: local assets/official only, no hotlinks.
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
      createTimeline:
        mod.createTimeline ?? mod.timeline ?? mod.default?.createTimeline ?? null,
    };
  } catch {
    animeCache = { animate: null, stagger: null, createTimeline: null };
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

function skillItem(s) {
  if (s && typeof s === 'object') {
    const name = esc(s.name ?? 'Skill');
    const desc = s.description ? ' — ' + esc(s.description) : '';
    return '<li><strong>' + name + '</strong>' + desc + '</li>';
  }
  return '<li>' + esc(s) + '</li>';
}

function playTimelineEntrance(anime) {
  if (reduceMotion()) return;
  const { animate, stagger, createTimeline } = anime;
  if (!animate) return;
  try {
    if (typeof createTimeline === 'function') {
      const tl = createTimeline({ defaults: { duration: 450, ease: 'outCubic' } });
      tl.add('.dossier-head', { opacity: [0, 1], translateY: [22, 0] })
        .add('.dossier-lore', { opacity: [0, 1], translateY: [18, 0] }, '-=280')
        .add('.dossier-forte', { opacity: [0, 1], translateY: [18, 0] }, '-=280')
        .add('.dossier-skills li', {
          opacity: [0, 1],
          translateX: [-14, 0],
          delay: typeof stagger === 'function' ? stagger(70) : 0,
        }, '-=260')
        .add('.dossier-foot', { opacity: [0, 1] }, '-=200');
    } else if (typeof stagger === 'function') {
      animate('.dossier > *', {
        opacity: [0, 1],
        translateY: [18, 0],
        delay: stagger(90),
        duration: 500,
        ease: 'outCubic',
      });
    } else {
      animate('.dossier > *', {
        opacity: [0, 1],
        translateY: [18, 0],
        duration: 500,
        ease: 'outCubic',
      });
    }
  } catch {
    // Dossier is already in the DOM and readable.
  }
}

/**
 * Render the dossier for ?id=. Returns { rendered, total, id }.
 */
export async function init() {
  if (initialized) return { rendered: 0, total: 0, skipped: true };
  const dossier = document.querySelector('#dossier');
  if (!dossier) return { rendered: 0, total: 0, missing: true };
  initialized = true;

  const anime = await loadAnime();
  const params = new URLSearchParams(window.location.search);
  const id = (params.get('id') || '').trim().toLowerCase();
  const backLink = '<p class="dossier-back"><a href="resonators.html">← Back to roster</a></p>';

  if (!id) {
    dossier.innerHTML =
      backLink + '<p class="dossier-loading">No resonator selected. Pick one from the <a href="resonators.html">roster</a>.</p>';
    return { rendered: 0, total: 0, id: null };
  }

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
  }

  if (loadError) {
    const viaFile = typeof location !== 'undefined' && location.protocol === 'file:';
    dossier.innerHTML =
      backLink +
      '<p class="shell-note">Could not load data/resonators.json (' +
      esc(loadError.message || loadError) +
      '). ' +
      (viaFile
        ? 'Opened via file:// — fetch is blocked. Serve the folder over http (e.g. `npx serve`).'
        : 'Check that data/resonators.json exists relative to this page.') +
      '</p>';
    return { rendered: 0, total: 0, id };
  }

  const found = all.find((r) => String(r.id).toLowerCase() === id);
  if (!found) {
    dossier.innerHTML =
      backLink +
      '<p class="dossier-loading">Unknown resonator id "' +
      esc(id) +
      '". Return to the <a href="resonators.html">roster</a>.</p>';
    return { rendered: 0, total: all.length, id };
  }

  let artFile = null;
  try {
    const manifest = await fetchFirst([
      'data/art-manifest.json',
      './data/art-manifest.json',
      '../data/art-manifest.json',
    ]);
    if (Array.isArray(manifest)) {
      const entry = manifest.find((m) => m && String(m.id).toLowerCase() === id);
      artFile = entry?.localFile ?? null;
    }
  } catch {
    artFile = null;
  }
  // Local placeholder fallback — never hotlink. The render step swaps to the
  // initial avatar if this SVG is missing (404).
  if (!artFile) artFile = 'assets/official/resonators/' + id + '.svg';

  let signature = null;
  try {
    const weapons = await fetchFirst([
      'data/weapons.json',
      './data/weapons.json',
      '../data/weapons.json',
    ]);
    if (Array.isArray(weapons) && found.signatureWeaponId) {
      signature =
        weapons.find(
          (w) => String(w.id).toLowerCase() === String(found.signatureWeaponId).toLowerCase(),
        ) ?? null;
    }
  } catch {
    signature = null;
  }

  const attr = found.attribute ?? found.element ?? 'Unknown';
  const forte = found.forte ?? {};
  const skills = Array.isArray(found.skills) ? found.skills : [];
  const initial = esc(String(found.name ?? '?').charAt(0).toUpperCase());
  const portrait = artFile
    ? '<img class="dossier-portrait dossier-art" src="' +
      esc(artFile) +
      '" alt="' +
      esc(found.name) +
      ' portrait" width="160" height="160" />'
    : '<div class="dossier-portrait" aria-hidden="true">' + initial + '</div>';

  dossier.innerHTML =
    backLink +
    '<div class="dossier-head">' +
    portrait +
    '<div><p class="section-eyebrow">' +
    esc(found.faction ?? '') +
    ' · v' +
    esc(found.version ?? '?') +
    '</p><h2>' +
    esc(found.name) +
    '</h2>' +
    '<p class="res-badges">' +
    '<span class="element-badge element-' +
    esc(String(attr).toLowerCase()) +
    '">' +
    esc(attr) +
    '</span> ' +
    '<span class="res-badge">' +
    esc(found.weapon ?? 'Unknown') +
    '</span> ' +
    '<span class="res-badge">' +
    esc(stars(found.rarity)) +
    '</span> ' +
    '<span class="res-badge">' +
    esc(found.role ?? '') +
    '</span></p></div></div>' +
    '<div class="dossier-lore"><h3>Lore</h3><p>' +
    esc(found.description ?? 'No description recorded.') +
    '</p>' +
    '<p class="res-meta">Birthplace: ' +
    esc(found.birthplace ?? 'Unknown') +
    ' · Forte: ' +
    esc(forte.name ?? 'Unknown') +
    '</p></div>' +
    '<div class="dossier-forte"><h3>Forte</h3><dl>' +
    '<dt>Name</dt><dd>' +
    esc(forte.name ?? 'Unknown') +
    '</dd>' +
    '<dt>Mark</dt><dd>' +
    esc(forte.mark ?? 'Unknown') +
    '</dd>' +
    '<dt>Spectrum</dt><dd>' +
    esc(forte.spectrum ?? 'Unknown') +
    '</dd></dl></div>' +
    '<div class="dossier-skills"><h3>Skills</h3>' +
    (skills.length
      ? '<ul class="res-skills">' + skills.map(skillItem).join('') + '</ul>'
      : '<p>No skills listed.</p>') +
    '</div>' +
    '<div class="dossier-foot"><h3>Signature weapon</h3>' +
    (signature
      ? '<p><a href="weapons.html#weapon-' +
        esc(signature.id) +
        '">' +
        esc(signature.name) +
        '</a> (' +
        esc(signature.type ?? '') +
        ' · ' +
        esc(stars(signature.rarity)) +
        ')</p>'
      : found.signatureWeaponId
        ? '<p>' + esc(found.signatureWeaponId) + ' (details in the <a href="weapons.html">armoury</a>)</p>'
        : '<p>No signature weapon recorded.</p>') +
    backLink +
    '</div>';

  document.title = found.name + ' — Solaris-3 Fan Archive';
  // Swap a missing local SVG for the initial avatar (keeps ?id= pages clean
  // for ids without a generated placeholder, e.g. abby/scar/fleurdelys/xinyi).
  const portraitImg = dossier.querySelector('img.dossier-art');
  if (portraitImg) {
    portraitImg.addEventListener('error', () => {
      const avatar = document.createElement('div');
      avatar.className = 'dossier-portrait';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = String(found.name ?? '?').charAt(0).toUpperCase();
      portraitImg.replaceWith(avatar);
    });
  }
  playTimelineEntrance(anime);
  return { rendered: 1, total: all.length, id: found.id };
}

export const initResonatorDetail = init;
export const initDossier = init;

function autoInit() {
  if (document.querySelector('#dossier')) {
    init().catch((err) => console.error('[resonator-detail] init failed:', err));
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit, { once: true });
  } else {
    autoInit();
  }
}
