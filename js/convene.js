/**
 * js/convene.js — Convene (gacha) simulator v2 (vanilla, no build).
 *
 * Four banners with independent pity, persisted per banner:
 *   localStorage "wuwa_convene_v2_{novice|featured|weapon|standard}"
 * plus "wuwa_convene_v2_current" for the last-selected banner.
 * Legacy "wuwa_convene_v1" state is migrated into the featured banner once.
 *
 * Rates (all banners unless noted):
 *   5-star base 0.8%, soft-pity linear ramp, hard pity guaranteed.
 *   Featured/Weapon/Standard: soft 65-79, hard 80.
 *   Novice: soft 35-49, hard 50.
 *   4-star 6% per pull with a 10-pull guarantee (pity4).
 *   Featured 5-star is 50/50 (lose -> next 5-star guaranteed featured).
 *   Weapon 5-star is always the featured weapon (guaranteed).
 *
 * Renders .pull-card cards into #convene-results and <li> entries into
 * #convene-history. Anime.js motion (stagger entrance + gold 5-star timeline
 * pop) is progressive enhancement via lazy dynamic import with fallback.
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
    animeCache = null; // CDN unavailable — pulls still render, motion skipped.
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

export const BANNERS = {
  novice: {
    label: 'Novice Convene',
    short: 'Novice',
    kind: 'resonator',
    hardPity: 50,
    softStart: 35,
    rate5: 0.008,
    rate4: 0.06,
    fiftyFifty: false,
    guaranteedFeatured: false,
    featured5: null,
    blurb: 'Beginner banner — 5-star guaranteed within 50 convenes.',
  },
  featured: {
    label: 'Featured Resonator',
    short: 'Featured',
    kind: 'resonator',
    hardPity: 80,
    softStart: 65,
    rate5: 0.008,
    rate4: 0.06,
    fiftyFifty: true,
    guaranteedFeatured: false,
    featured5: 'Jinhsi',
    blurb: 'Rate-up resonator — 50/50, guaranteed featured after a loss.',
  },
  weapon: {
    label: 'Featured Weapon',
    short: 'Weapon',
    kind: 'weapon',
    hardPity: 80,
    softStart: 65,
    rate5: 0.008,
    rate4: 0.06,
    fiftyFifty: false,
    guaranteedFeatured: true,
    featured5: 'Verdant Summit',
    blurb: 'Signature weapon banner — 5-star is always featured.',
  },
  standard: {
    label: 'Standard Convene',
    short: 'Standard',
    kind: 'resonator',
    hardPity: 80,
    softStart: 65,
    rate5: 0.008,
    rate4: 0.06,
    fiftyFifty: false,
    guaranteedFeatured: false,
    featured5: null,
    blurb: 'Permanent pool — every 5-star resonator can appear.',
  },
};

export const BANNER_ORDER = ['novice', 'featured', 'weapon', 'standard'];

const LS_PREFIX = 'wuwa_convene_v2_';
const LS_CURRENT = 'wuwa_convene_v2_current';
const LS_LEGACY = 'wuwa_convene_v1';

const HISTORY_SHOWN = 30;
const HISTORY_STORED = 100;
const FOUR_STAR_PITY = 10;

// ---- Pools (fallbacks keep the simulator working on file:// or offline;
//      enriched from data/*.json when fetchable) ----

let POOL_5_RES = [
  'Jinhsi', 'Jiyan', 'Yinlin', 'Shorekeeper', 'Changli',
  'Calcharo', 'Encore', 'Lingyang', 'Jianxin', 'Verina',
];
let POOL_4_RES = [
  'Aalto', 'Yangyang', 'Sanhua', 'Baizhi', 'Chixia',
  'Mortefi', 'Danjin', 'Taoqi', 'Yuanwu', 'Lumi',
];
let POOL_5_WEAP = ['Verdant Summit', 'Ages of Harvest', 'Lustrous Razor', 'Stringmaster'];
let POOL_4_WEAP = [
  'Heliocleaver', 'Novaburst', 'Lumingloss', 'Static Mist',
  'Broadblade of Voyager', 'Sword of Voyager',
];
const POOL_3 = [
  '3★ Sword of Night',
  '3★ Pistols of Dawn',
  '3★ Gauntlets of Stone',
  '3★ Broadblade of Tides',
  '3★ Rectifier of Mist',
];

async function fetchFirst(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length) return data;
    } catch {
      // try next URL
    }
  }
  return null;
}

async function enrichPools() {
  try {
    const data = await fetchFirst([
      'data/resonators.json',
      './data/resonators.json',
      '../data/resonators.json',
    ]);
    if (data) {
      const list = Array.isArray(data) ? data : [];
      const five = list.filter((r) => Number(r.rarity) === 5).map((r) => r.name).filter(Boolean);
      const four = list.filter((r) => Number(r.rarity) === 4).map((r) => r.name).filter(Boolean);
      if (five.length) POOL_5_RES = [...new Set(five)];
      if (four.length) POOL_4_RES = [...new Set(four)];
    }
  } catch {
    // offline / file:// — fallback pools above still work
  }
  try {
    const data = await fetchFirst([
      'data/weapons.json',
      './data/weapons.json',
      '../data/weapons.json',
    ]);
    if (data) {
      const list = Array.isArray(data) ? data : [];
      const five = list.filter((w) => Number(w.rarity) === 5).map((w) => w.name).filter(Boolean);
      const four = list.filter((w) => Number(w.rarity) === 4).map((w) => w.name).filter(Boolean);
      if (five.length) POOL_5_WEAP = [...new Set(five)];
      if (four.length) POOL_4_WEAP = [...new Set(four)];
    }
  } catch {
    // keep fallbacks
  }
}

// ---- Per-banner state ----

function blankBannerState() {
  return { pity5: 0, pity4: 0, totalPulls: 0, guaranteed: false, history: [] };
}

const store = {
  banner: 'featured',
  data: {
    novice: blankBannerState(),
    featured: blankBannerState(),
    weapon: blankBannerState(),
    standard: blankBannerState(),
  },
};

let initialized = false;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function storageKey(banner) {
  return `${LS_PREFIX}${banner}`;
}

function saveBanner(banner) {
  try {
    const b = store.data[banner];
    localStorage.setItem(
      storageKey(banner),
      JSON.stringify({
        pity5: b.pity5,
        pity4: b.pity4,
        totalPulls: b.totalPulls,
        guaranteed: b.guaranteed,
        history: b.history.slice(0, HISTORY_STORED),
      }),
    );
  } catch {
    // storage unavailable — session state still works
  }
}

function saveCurrent() {
  try {
    localStorage.setItem(LS_CURRENT, store.banner);
  } catch {
    // ignore
  }
}

function readBanner(banner) {
  try {
    const raw = localStorage.getItem(storageKey(banner));
    if (!raw) return null;
    const data = JSON.parse(raw);
    const b = blankBannerState();
    if (typeof data.pity5 === 'number' && data.pity5 >= 0) b.pity5 = Math.floor(data.pity5);
    if (typeof data.pity4 === 'number' && data.pity4 >= 0) b.pity4 = Math.floor(data.pity4);
    if (typeof data.totalPulls === 'number' && data.totalPulls >= 0)
      b.totalPulls = Math.floor(data.totalPulls);
    if (data.guaranteed === true) b.guaranteed = true;
    if (Array.isArray(data.history)) {
      b.history = data.history
        .filter((e) => e && typeof e.name === 'string' && [3, 4, 5].includes(e.rarity))
        .slice(0, HISTORY_STORED);
    }
    return b;
  } catch {
    return null;
  }
}

function loadAll() {
  let current = 'featured';
  try {
    const saved = localStorage.getItem(LS_CURRENT);
    if (saved && BANNERS[saved]) current = saved;
  } catch {
    // ignore
  }
  for (const key of BANNER_ORDER) {
    const loaded = readBanner(key);
    if (loaded) store.data[key] = loaded;
  }
  // One-time migration: legacy v1 single-banner state becomes featured pity.
  try {
    const legacy = localStorage.getItem(LS_LEGACY);
    const f = store.data.featured;
    if (legacy && f.totalPulls === 0 && f.history.length === 0) {
      const data = JSON.parse(legacy);
      if (typeof data.pity5 === 'number' && data.pity5 >= 0) f.pity5 = Math.floor(data.pity5);
      if (typeof data.totalPulls === 'number' && data.totalPulls >= 0)
        f.totalPulls = Math.floor(data.totalPulls);
      if (Array.isArray(data.history)) {
        f.history = data.history
          .filter((e) => e && typeof e.name === 'string' && [3, 4, 5].includes(e.rarity))
          .slice(0, HISTORY_STORED);
      }
      saveBanner('featured');
    }
  } catch {
    // migration is best-effort only
  }
  store.banner = current;
}

/** 5-star probability for the NEXT pull given pulls-since-last-5-star. */
export function rate5For(pity5, bannerKey = 'featured') {
  const cfg = BANNERS[bannerKey] || BANNERS.featured;
  const next = pity5 + 1;
  if (next >= cfg.hardPity) return 1;
  if (next < cfg.softStart) return cfg.rate5;
  const t = (next - cfg.softStart) / (cfg.hardPity - cfg.softStart);
  return cfg.rate5 + t * (1 - cfg.rate5);
}

export function getBanner() {
  return store.banner;
}

export function setBanner(banner) {
  if (!BANNERS[banner] || store.banner === banner) return false;
  store.banner = banner;
  saveCurrent();
  renderBannerSwitcher();
  const results = document.getElementById('convene-results');
  if (results) results.replaceChildren();
  renderHistory();
  updatePityCounter();
  return true;
}

function pool5For(cfg) {
  return cfg.kind === 'weapon' ? POOL_5_WEAP : POOL_5_RES;
}

function pool4For(cfg) {
  return cfg.kind === 'weapon' ? POOL_4_WEAP : POOL_4_RES;
}

function resolveFiveStar(cfg, b) {
  if (cfg.kind === 'weapon' || cfg.guaranteedFeatured) {
    return { name: cfg.featured5 || pick(pool5For(cfg)), rarity: 5 };
  }
  if (cfg.fiftyFifty) {
    if (b.guaranteed || Math.random() < 0.5) {
      b.guaranteed = false;
      return { name: cfg.featured5 || pick(pool5For(cfg)), rarity: 5 };
    }
    b.guaranteed = true;
    const pool = pool5For(cfg).filter((n) => n !== cfg.featured5);
    return { name: pick(pool.length ? pool : pool5For(cfg)), rarity: 5 };
  }
  return { name: pick(pool5For(cfg)), rarity: 5 };
}

function rollOnce() {
  const cfg = BANNERS[store.banner];
  const b = store.data[store.banner];
  const isHardPity = b.pity5 + 1 >= cfg.hardPity;
  const r5 = isHardPity ? 1 : rate5For(b.pity5, store.banner);
  if (Math.random() < r5) {
    b.pity5 = 0;
    b.pity4 = 0;
    return resolveFiveStar(cfg, b);
  }
  b.pity5 += 1;
  b.pity4 += 1;
  if (b.pity4 >= FOUR_STAR_PITY || Math.random() < cfg.rate4) {
    b.pity4 = 0;
    return { name: pick(pool4For(cfg)), rarity: 4 };
  }
  return { name: pick(POOL_3), rarity: 3 };
}

function count5(b) {
  return b.history.filter((e) => e.rarity === 5).length;
}

function starsFor(rarity) {
  return '★'.repeat(rarity);
}

function updatePityCounter() {
  const el = document.getElementById('pity-counter');
  if (!el) return;
  const cfg = BANNERS[store.banner];
  const b = store.data[store.banner];
  let text =
    `${cfg.label} — Pity: ${b.pity5} / ${cfg.hardPity} | ` +
    `4★ pity: ${b.pity4} / ${FOUR_STAR_PITY} | Total: ${b.totalPulls} | 5★: ${count5(b)}`;
  if (cfg.fiftyFifty && b.guaranteed) text += ' | Featured guaranteed next 5★';
  el.textContent = text;
}

function renderResults(results) {
  const box = document.getElementById('convene-results');
  if (!box) return;
  box.replaceChildren();
  for (const r of results) {
    const card = document.createElement('div');
    card.className = `pull-card rarity-${r.rarity}`;
    const name = document.createElement('span');
    name.className = 'pull-name';
    name.textContent = r.name;
    const stars = document.createElement('span');
    stars.className = 'pull-stars';
    stars.textContent = starsFor(r.rarity);
    card.append(name, stars);
    box.appendChild(card);
  }
}

function renderHistory() {
  const box = document.getElementById('convene-history');
  if (!box) return;
  const b = store.data[store.banner];
  box.replaceChildren();
  const shown = b.history.slice(0, HISTORY_SHOWN);
  if (!shown.length) {
    // Empty state (keyboard/screen-reader friendly — plain <li>, no action).
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = 'No pulls yet on this banner — try Convene ×1.';
    box.appendChild(empty);
    return;
  }
  shown.forEach((e) => {
    // #convene-history is a <ul>, so history entries must be <li> elements.
    const item = document.createElement('li');
    item.className = `history-item rarity-${e.rarity}`;
    const no = document.createElement('span');
    no.className = 'history-no';
    no.textContent = `#${e.pullNo}`;
    const name = document.createElement('span');
    name.className = 'history-name';
    name.textContent = e.name;
    const stars = document.createElement('span');
    stars.className = 'history-stars';
    stars.textContent = starsFor(e.rarity);
    item.append(no, name, stars);
    box.appendChild(item);
  });
}

/**
 * Ensure the banner switcher holds one tab button per banner.
 * Existing shell buttons are reused; missing ones are created.
 */
function renderBannerSwitcher() {
  const wrap = document.getElementById('banner-switcher');
  if (!wrap) return;
  for (const key of BANNER_ORDER) {
    const cfg = BANNERS[key];
    let btn = wrap.querySelector(`[data-banner="${key}"]`);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'banner-btn';
      btn.dataset.banner = key;
      btn.setAttribute('role', 'tab');
      btn.textContent = cfg.label;
      btn.title = cfg.blurb;
      wrap.appendChild(btn);
    }
    const active = store.banner === key;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  }
}

function animateResults() {
  if (reducedMotion()) return;
  const box = document.getElementById('convene-results');
  if (!box || !box.children.length) return;
  loadAnime().then((mod) => {
    if (!mod || typeof mod.animate !== 'function') return;
    try {
      mod.animate(box.children, {
        opacity: [0, 1],
        scale: [0.85, 1],
        duration: 350,
        delay: (_el, i) => i * 60,
        ease: 'outQuad',
      });
      const gold = box.querySelectorAll('.pull-card.rarity-5');
      if (gold.length && typeof mod.createTimeline === 'function') {
        mod
          .createTimeline()
          .add(
            gold,
            {
              scale: [1, 1.12, 1],
              duration: 450,
              delay: (_el, i) => i * 90,
              ease: 'outElastic(1, 0.55)',
            },
            150,
          )
          .add(
            gold,
            {
              opacity: [1, 0.75, 1],
              duration: 400,
              ease: 'inOutSine',
            },
            '<',
          );
      }
    } catch {
      // anime.js failed — content is already rendered, skip motion
    }
  });
}

export function pull(n) {
  const count = Math.max(1, Math.min(100, Math.floor(n) || 1));
  const banner = store.banner;
  const b = store.data[banner];
  const results = [];
  for (let i = 0; i < count; i += 1) {
    const r = rollOnce();
    b.totalPulls += 1;
    const entry = {
      name: r.name,
      rarity: r.rarity,
      pullNo: b.totalPulls,
      banner,
      t: Date.now(),
    };
    results.push(entry);
    b.history.unshift(entry);
  }
  b.history = b.history.slice(0, HISTORY_STORED);
  saveBanner(banner);
  renderResults(results);
  renderHistory();
  updatePityCounter();
  animateResults();
  return results;
}

export function clearHistory() {
  const banner = store.banner;
  store.data[banner] = blankBannerState();
  try {
    localStorage.removeItem(storageKey(banner));
  } catch {
    // ignore
  }
  const results = document.getElementById('convene-results');
  if (results) results.replaceChildren();
  renderHistory();
  updatePityCounter();
}

export async function initConvene() {
  if (initialized) return;
  const hasDom =
    document.getElementById('banner-switcher') ||
    document.getElementById('pull-1') ||
    document.getElementById('convene-results');
  if (!hasDom) return; // not the convene page — stay dormant
  initialized = true;

  loadAll();

  const switcher = document.getElementById('banner-switcher');
  if (switcher && !switcher.dataset.wired) {
    switcher.dataset.wired = 'true';
    switcher.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-banner]');
      if (!btn || !BANNERS[btn.dataset.banner]) return;
      setBanner(btn.dataset.banner);
    });
    // Keyboard a11y: arrow keys move between banner tabs (roving focus).
    switcher.addEventListener('keydown', (e) => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
      const tabs = Array.from(switcher.querySelectorAll('[data-banner]'));
      const current = e.target.closest('[data-banner]');
      const idx = tabs.indexOf(current);
      if (idx < 0) return;
      e.preventDefault();
      let next = idx;
      if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      tabs[next].focus();
      setBanner(tabs[next].dataset.banner);
    });
  }

  const btn1 = document.getElementById('pull-1');
  const btn10 = document.getElementById('pull-10');
  const btnClear = document.getElementById('clear-history');
  if (btn1 && !btn1.dataset.wired) {
    btn1.dataset.wired = 'true';
    btn1.addEventListener('click', () => pull(1));
  }
  if (btn10 && !btn10.dataset.wired) {
    btn10.dataset.wired = 'true';
    btn10.addEventListener('click', () => pull(10));
  }
  if (btnClear && !btnClear.dataset.wired) {
    btnClear.dataset.wired = 'true';
    btnClear.addEventListener('click', clearHistory);
  }

  renderBannerSwitcher();
  renderHistory();
  updatePityCounter();

  // Enrich pools from data/*.json in the background; fallbacks work meanwhile.
  try {
    await enrichPools();
  } catch {
    // fallbacks already in place
  }
}

// Auto-init when loaded via its own <script type="module"> tag,
// while still allowing layout.js to import { initConvene } and call it.
// Guarded so it only ever runs once and only on the convene page.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initConvene(), { once: true });
  } else {
    initConvene();
  }
}
