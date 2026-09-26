// js/pages/lore.js — Records of Solaris-3 (vanilla ES module).
// Renders #lore-grid cards + #timeline-rail milestones from data/lore.json.
// Anime.js v4 is an optional progressive enhancement via dynamic import;
// if the CDN is unreachable, content still renders without motion.

let animate = null;
let stagger = null;
try {
  const animeModule = await import('https://esm.sh/animejs');
  animate = animeModule.animate;
  stagger = animeModule.stagger;
} catch {
  // CDN unavailable — lore renders without motion.
}

const DATA_URLS = ['data/lore.json', './data/lore.json', '../data/lore.json'];

let loreInitialized = false;

// Inline fallback mirroring data/lore.json (term/category/summary).
const FALLBACK_LORE = [
  { term: 'The Lament', category: 'History', summary: 'A global cataclysm that unleashed chaotic frequencies, reshaping continents and giving rise to Tacet Discords.' },
  { term: 'Waveworn Phenomenon', category: 'Phenomena', summary: 'Residual frequency storms left by the Lament that warp terrain and spawn dangerous echo activity.' },
  { term: 'Tacet Field', category: 'Phenomena', summary: 'A zone of dense chaotic frequencies where reality thins and powerful Discords gather.' },
  { term: 'Tacet Discord', category: 'Creatures', summary: 'Monstrous frequency beings born from chaotic reverberations that prey on settlements.' },
  { term: 'Tacet Mark', category: 'Resonators', summary: 'The distinctive mark on a Resonator showing where frequencies merged with their body.' },
  { term: 'Tacetite', category: 'Materials', summary: 'Crystallized frequency ore used to forge weapons and stabilize echo shells.' },
  { term: 'Resonator', category: 'Resonators', summary: 'A person able to resonate with frequencies and wield elemental Forte abilities.' },
  { term: 'Echo', category: 'Echoes', summary: 'A captured Tacet Discord bound into a shell that fights alongside its Resonator.' },
  { term: 'Sentinel', category: 'Divinities', summary: 'A guiding celestial being bonded to a nation, appointing Resonators to guard civilization.' },
  { term: 'Threnodian', category: 'Divinities', summary: 'A calamity entity born of collective fear that seeks to silence civilization.' },
  { term: 'Reverberation', category: 'Theory', summary: 'The lingering frequency echo of people, battles, and places that Resonators can sense.' },
  { term: 'Retroact Rain', category: 'Phenomena', summary: 'A strange rain that replays past reverberations and can revive dormant Discords.' },
  { term: 'Forte', category: 'Resonators', summary: 'A Resonator\u2019s unique ability circuit shaped by their past and resonance type.' },
  { term: 'Sonata Effect', category: 'Echoes', summary: 'A set bonus granted by equipping echoes of matching elemental harmony.' },
  { term: 'Pangu Terminal', category: 'Technology', summary: 'A handheld device that scans frequencies, stores echoes, and links to the databank.' },
  { term: 'Concerto Energy', category: 'Combat', summary: 'Battle energy shared by a team that powers intro, outro, and liberation skills.' },
  { term: 'The Black Shores', category: 'Factions', summary: 'A secretive order guarding the Tethys System that predicts Lament activity.' },
  { term: 'Midnight Rangers', category: 'Factions', summary: "Huanglong\u2019s frontline army defending Jinzhou from Discord tides." },
  { term: 'Fractsidus', category: 'Factions', summary: 'A radical sect that worships fusion with Tacet Discords to force evolution.' },
  { term: "Rabelle's Curve", category: 'Theory', summary: 'A measurement curve classifying Resonators as Natural, Mutant, or Congenital by awakening pattern.' },
];

// Curated narrative order for the timeline rail: lore.json has no dates,
// so milestones are sorted by story era (earliest calamity → present day).
const ERA_ORDER = [
  'The Lament',
  'Waveworn Phenomenon',
  'Tacet Field',
  'Tacet Discord',
  'Retroact Rain',
  'Reverberation',
  'Sentinel',
  'Threnodian',
  'Resonator',
  'Tacet Mark',
  'Forte',
  "Rabelle's Curve",
  'Echo',
  'Sonata Effect',
  'Tacetite',
  'Pangu Terminal',
  'Concerto Energy',
  'Midnight Rangers',
  'The Black Shores',
  'Fractsidus',
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

async function loadLore() {
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
  return FALLBACK_LORE.map((t) => ({ ...t }));
}

function summaryOf(entry) {
  return entry.summary ?? entry.summy ?? '';
}

function sortedMilestones(entries) {
  const rank = new Map(ERA_ORDER.map((term, i) => [term, i]));
  return [...entries].sort((a, b) => {
    const ra = rank.has(a.term) ? rank.get(a.term) : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b.term) ? rank.get(b.term) : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return String(a.term).localeCompare(String(b.term));
  });
}

export async function initLore() {
  if (loreInitialized) return;
  loreInitialized = true;

  const grid = document.querySelector('#lore-grid');
  const rail = document.querySelector('#timeline-rail');
  if (!grid && !rail) return;

  const entries = await loadLore();
  const reduce = reducedMotion();

  // ---- Lore grid cards ----
  if (grid) {
    grid.innerHTML = '';
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'res-empty';
      empty.textContent = 'No lore records available.';
      grid.appendChild(empty);
    }
    for (const entry of entries) {
      const card = document.createElement('article');
      card.className = 'archive-card lore-card';
      card.innerHTML =
        '<span class="tag">' +
        escapeHtml(entry.category ?? 'Record') +
        '</span>' +
        '<h3>' +
        escapeHtml(entry.term) +
        '</h3>' +
        '<p>' +
        escapeHtml(summaryOf(entry)) +
        '</p>';
      grid.appendChild(card);
    }
    if (!reduce && animate && stagger) {
      try {
        animate(grid.querySelectorAll('.lore-card'), {
          opacity: [0, 1],
          translateY: [22, 0],
          duration: 550,
          delay: stagger(45),
          ease: 'outCubic',
        });
      } catch {
        // cards already visible — skip motion
      }
    }
  }

  // ---- Timeline rail (sorted milestones + scroll progress line) ----
  if (rail) {
    rail.innerHTML = '';
    const progress = document.createElement('div');
    progress.className = 'timeline-progress';
    progress.setAttribute('aria-hidden', 'true');
    progress.style.cssText =
      'position:absolute;left:-2px;top:0;width:2px;height:0%;' +
      'background:linear-gradient(180deg,#67e8f9,#f5c518);' +
      'box-shadow:0 0 12px rgba(103,232,249,0.7);pointer-events:none;';
    rail.appendChild(progress);

    const milestones = sortedMilestones(entries);
    milestones.forEach((entry, i) => {
      const node = document.createElement('div');
      node.className = 'timeline-node';
      node.innerHTML =
        '<span class="tag">Era ' +
        String(i + 1).padStart(2, '0') +
        ' · ' +
        escapeHtml(entry.category ?? 'Record') +
        '</span>' +
        '<h3>' +
        escapeHtml(entry.term) +
        '</h3>' +
        '<p>' +
        escapeHtml(summaryOf(entry)) +
        '</p>';
      rail.appendChild(node);
    });

    // Scroll progress: fill the rail line as the user scrolls past it.
    let ticking = false;
    const updateProgress = () => {
      ticking = false;
      const rect = rail.getBoundingClientRect();
      const viewport = window.innerHeight || document.documentElement.clientHeight || 1;
      const total = rect.height + viewport;
      const passed = viewport - rect.top;
      const pct = Math.max(0, Math.min(1, passed / total));
      progress.style.height = (pct * 100).toFixed(2) + '%';
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateProgress);
      }
    };
    updateProgress();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    // Reveal milestones as they enter the viewport.
    if (!reduce && animate && 'IntersectionObserver' in window) {
      try {
        const nodes = rail.querySelectorAll('.timeline-node');
        const seen = new WeakSet();
        const observer = new IntersectionObserver(
          (items) => {
            for (const item of items) {
              if (!item.isIntersecting || seen.has(item.target)) continue;
              seen.add(item.target);
              try {
                animate(item.target, {
                  opacity: [0, 1],
                  translateX: [24, 0],
                  duration: 500,
                  ease: 'outCubic',
                });
              } catch {
                // node already visible
              }
              observer.unobserve(item.target);
            }
          },
          { threshold: 0.15 },
        );
        nodes.forEach((n) => observer.observe(n));
      } catch {
        // reveal is enhancement-only
      }
    }
  }
}

// Auto-init when loaded via its own <script type="module"> tag,
// while still allowing dynamic import + initLore() calls. Guarded once.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initLore(), { once: true });
  } else {
    initLore();
  }
}
