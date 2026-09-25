// Anime.js v4 is an optional progressive enhancement loaded via dynamic import.
// If the CDN is unreachable, pulls still render — only the celebration motion
// is skipped.
let animate = null;
let createTimeline = null;
try {
  const animeModule = await import('https://esm.sh/animejs');
  animate = animeModule.animate;
  createTimeline = animeModule.createTimeline;
} catch {
  // CDN unavailable — convene works without motion.
}

const STORAGE_KEY = 'wuwa_convene_v1';

const HARD_PITY = 80;
const SOFT_PITY_START = 65; // ramp applies to pulls 65..79, pull 80 guaranteed
const BASE_RATE_5 = 0.008;
const RATE_4 = 0.06;

const POOL_5 = ['Jinhsi', 'Jiyan', 'Yinlin', 'Shorekeeper', 'Changli'];

const POOL_4 = [
  'Verina',
  'Calcharo',
  'Danjin',
  'Sanhua',
  'Mortefi',
  'Aalto',
  '4★ Winter Brume',
  '4★ Lunar Cutter',
];

const POOL_3 = [
  '3★ Sword of Night',
  '3★ Pistols of Dawn',
  '3★ Gauntlets of Stone',
  '3★ Broadblade of Tides',
  '3★ Rectifier of Mist',
];

const HISTORY_SHOWN = 30;
const HISTORY_STORED = 100;

const state = {
  pity5: 0,
  totalPulls: 0,
  history: [], // newest-first: { name, rarity, pullNo, t }
};

let initialized = false;

const reduceMotionQuery = '(prefers-reduced-motion: reduce)';
function reducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(reduceMotionQuery).matches
  );
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 5★ probability for the NEXT pull given pulls-since-last-5★. */
export function rate5For(pity5) {
  const next = pity5 + 1;
  if (next >= HARD_PITY) return 1;
  if (next < SOFT_PITY_START) return BASE_RATE_5;
  const t = (next - SOFT_PITY_START) / (HARD_PITY - SOFT_PITY_START);
  return BASE_RATE_5 + t * (1 - BASE_RATE_5);
}

function rollOnce() {
  const isHardPity = state.pity5 + 1 >= HARD_PITY;
  const r5 = isHardPity ? 1 : rate5For(state.pity5);
  if (Math.random() < r5) {
    state.pity5 = 0;
    const name = pick(POOL_5);
    return { name, rarity: 5 };
  }
  state.pity5 += 1;
  if (Math.random() < RATE_4) {
    return { name: pick(POOL_4), rarity: 4 };
  }
  return { name: pick(POOL_3), rarity: 3 };
}

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        pity5: state.pity5,
        totalPulls: state.totalPulls,
        history: state.history.slice(0, HISTORY_STORED),
      }),
    );
  } catch {
    // storage unavailable (private mode / quota) — session state still works
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.pity5 === 'number' && data.pity5 >= 0) state.pity5 = Math.floor(data.pity5);
    if (typeof data.totalPulls === 'number' && data.totalPulls >= 0)
      state.totalPulls = Math.floor(data.totalPulls);
    if (Array.isArray(data.history)) {
      state.history = data.history
        .filter((e) => e && typeof e.name === 'string' && [3, 4, 5].includes(e.rarity))
        .slice(0, HISTORY_STORED);
    }
  } catch {
    state.pity5 = 0;
    state.totalPulls = 0;
    state.history = [];
  }
}

function count5() {
  return state.history.filter((e) => e.rarity === 5).length;
}

function updatePityCounter() {
  const el = document.getElementById('pity-counter');
  if (!el) return;
  el.textContent = `Pity: ${state.pity5} / ${HARD_PITY} | Total: ${state.totalPulls} | 5★: ${count5()}`;
}

function starsFor(rarity) {
  return '★'.repeat(rarity);
}

function renderResults(results) {
  const box = document.getElementById('convene-results');
  if (!box) return;
  box.replaceChildren();
  results.forEach((r) => {
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
  });
}

function renderHistory() {
  const box = document.getElementById('convene-history');
  if (!box) return;
  box.replaceChildren();
  state.history.slice(0, HISTORY_SHOWN).forEach((e) => {
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

function animateResults() {
  if (reducedMotion() || !animate) return;
  const box = document.getElementById('convene-results');
  if (!box || !box.children.length) return;
  try {
    animate(box.children, {
      opacity: [0, 1],
      scale: [0.85, 1],
      duration: 350,
      delay: (_el, i) => i * 60,
      ease: 'outQuad',
    });
    const gold = box.querySelectorAll('.pull-card.rarity-5');
    if (gold.length) {
      createTimeline()
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
    // anime.js failed to load — content is already rendered, skip motion
  }
}

export function pull(n) {
  const count = Math.max(1, Math.floor(n) || 1);
  const results = [];
  for (let i = 0; i < count; i += 1) {
    const r = rollOnce();
    state.totalPulls += 1;
    const entry = { name: r.name, rarity: r.rarity, pullNo: state.totalPulls, t: Date.now() };
    results.push(entry);
    state.history.unshift(entry);
  }
  state.history = state.history.slice(0, HISTORY_STORED);
  save();
  renderResults(results);
  renderHistory();
  updatePityCounter();
  animateResults();
  return results;
}

export function clearHistory() {
  state.pity5 = 0;
  state.totalPulls = 0;
  state.history = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  const results = document.getElementById('convene-results');
  if (results) results.replaceChildren();
  renderHistory();
  updatePityCounter();
}

export function initConvene() {
  if (initialized) return;
  initialized = true;
  load();
  const btn1 = document.getElementById('pull-1');
  const btn10 = document.getElementById('pull-10');
  const btnClear = document.getElementById('clear-history');
  if (btn1) btn1.addEventListener('click', () => pull(1));
  if (btn10) btn10.addEventListener('click', () => pull(10));
  if (btnClear) btnClear.addEventListener('click', clearHistory);
  renderHistory();
  updatePityCounter();
}
