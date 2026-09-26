// js/pages/atlas.js — Nations of Solaris-3 (vanilla ES module).
// Renders #region-list per .nation-tab from data/regions.json.
// Anime.js v4 is an optional progressive enhancement via dynamic import;
// if the CDN is unreachable, tab switching still works without motion.

let animate = null;
let stagger = null;
try {
  const animeModule = await import('https://esm.sh/animejs');
  animate = animeModule.animate;
  stagger = animeModule.stagger;
} catch {
  // CDN unavailable — atlas renders without motion.
}

const DATA_URLS = ['data/regions.json', './data/regions.json', '../data/regions.json'];

let atlasInitialized = false;

// Inline fallback mirroring data/regions.json (used when fetch fails,
// e.g. page opened via file://). Keep in sync with the 4 nations.
const FALLBACK_NATIONS = [
  {
    nation: 'Huanglong',
    sentinel: 'Jué',
    regions: ['Jinzhou', 'Desorock Highland', 'Wuming Bay', "Whining Aix's Mire", "Tiger's Maw"],
    areasCount: 42,
    factions: ['Midnight Rangers', 'Huaxu Academy', 'Jinzhou Magistrate'],
  },
  {
    nation: 'Black Shores',
    sentinel: 'Shorekeeper (Warden)',
    regions: ['Tethys Hub', 'Blake Bloom', 'Garden of the Lost', 'Star Observatory'],
    areasCount: 18,
    factions: ['Black Shores Keepers', 'Bloom Bearers'],
  },
  {
    nation: 'Rinascita',
    sentinel: 'Imperator',
    regions: [
      'Ragunna',
      'Beohr Waters',
      'Thessaleo Fells',
      'Fagaceae Peninsula',
      'Nimbus Sanctum',
      'Averardo Vault',
    ],
    areasCount: 38,
    factions: ['Montelli Family', 'Fisalia Family', 'Order of the Deep', 'Troupe of Fools'],
  },
  {
    nation: 'Septimont',
    sentinel: 'Mercury',
    regions: ['Septimont Arena', 'Wolfpack Grounds', 'Laurel Forum'],
    areasCount: 14,
    factions: ['Septimont Senate', 'Arena Champions'],
  },
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

async function loadNations() {
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
  return FALLBACK_NATIONS.map((n) => ({ ...n }));
}

export async function initAtlas() {
  if (atlasInitialized) return;
  atlasInitialized = true;

  const tabsRoot = document.querySelector('#nation-tabs');
  const list = document.querySelector('#region-list');
  if (!tabsRoot || !list) return;

  const nations = await loadNations();
  const byName = new Map(nations.map((n) => [n.nation, n]));

  // Ensure every nation in data has a tab (shell ships 3 of 4; Septimont
  // is added here so no shell edit is needed).
  for (const n of nations) {
    if (!tabsRoot.querySelector(`.nation-tab[data-nation="${CSS.escape(n.nation)}"]`)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nation-tab';
      btn.dataset.nation = n.nation;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      btn.textContent = n.nation;
      tabsRoot.appendChild(btn);
    }
  }

  const tabs = () => Array.from(tabsRoot.querySelectorAll('.nation-tab'));

  function playEntrance() {
    if (reducedMotion() || !animate || !stagger) return;
    const items = list.querySelectorAll('li');
    if (!items.length) return;
    try {
      animate(items, {
        opacity: [0, 1],
        translateX: [-16, 0],
        duration: 420,
        delay: stagger(55),
        ease: 'outCubic',
      });
    } catch {
      // motion failed — list is already in the DOM and readable
    }
  }

  function render(nationName) {
    const nation = byName.get(nationName) || nations[0];
    if (!nation) {
      list.innerHTML = '<li>No region data available.</li>';
      return;
    }
    const regions = Array.isArray(nation.regions) ? nation.regions : [];
    const factions = Array.isArray(nation.factions) ? nation.factions : [];
    const parts = [];
    // Lead item: nation overview (sentinel / area count / factions).
    parts.push(
      '<li class="region-overview">' +
        '<h3>' +
        escapeHtml(nation.nation) +
        '</h3>' +
        '<p class="region-meta">Sentinel: <strong>' +
        escapeHtml(nation.sentinel ?? 'Unknown') +
        '</strong> · ' +
        escapeHtml(nation.areasCount ?? regions.length) +
        ' areas · ' +
        escapeHtml(regions.length) +
        ' regions</p>' +
        (factions.length
          ? '<p class="region-factions">Factions: ' +
            factions.map((f) => '<span class="tag">' + escapeHtml(f) + '</span>').join(' ') +
            '</p>'
          : '') +
        '</li>',
    );
    for (const region of regions) {
      parts.push(
        '<li class="region-item"><span class="region-name">' +
          escapeHtml(region) +
          '</span><span class="region-nation">' +
          escapeHtml(nation.nation) +
          '</span></li>',
      );
    }
    list.innerHTML = parts.join('');
    playEntrance();
  }

  function select(name, focus = false) {
    for (const tab of tabs()) {
      const isActive = tab.dataset.nation === name;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
      if (isActive && focus) tab.focus();
    }
    render(name);
  }

  tabsRoot.addEventListener('click', (e) => {
    const tab = e.target.closest('.nation-tab');
    if (!tab) return;
    select(tab.dataset.nation);
  });

  tabsRoot.addEventListener('keydown', (e) => {
    const current = e.target.closest('.nation-tab');
    if (!current) return;
    const all = tabs();
    const idx = all.indexOf(current);
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % all.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + all.length) % all.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = all.length - 1;
    if (next >= 0) {
      e.preventDefault();
      select(all[next].dataset.nation, true);
    }
  });

  // Honor the shell's pre-selected tab, else fall back to the first nation.
  const preselected = tabsRoot.querySelector('.nation-tab.active');
  select(
    preselected && byName.has(preselected.dataset.nation)
      ? preselected.dataset.nation
      : nations[0].nation,
  );
}

// Auto-init when loaded via its own <script type="module"> tag,
// while still allowing dynamic import + initAtlas() calls. Guarded once.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAtlas(), { once: true });
  } else {
    initAtlas();
  }
}
