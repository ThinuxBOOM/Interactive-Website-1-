// js/pages/quests.js — Quest Tracker (vanilla ES module).
// Renders a chapter/act accordion tree into #quest-tree from data/quests.json.
// Anime.js v4 is an optional progressive enhancement via dynamic import;
// if the CDN is unreachable, the accordion still toggles without motion.

let animate = null;
try {
  const animeModule = await import('https://esm.sh/animejs');
  animate = animeModule.animate;
} catch {
  // CDN unavailable — accordion works without motion.
}

const DATA_URLS = ['data/quests.json', './data/quests.json', '../data/quests.json'];

let questsInitialized = false;

// Inline fallback mirroring data/quests.json (chapter/act/title/location/unionReq).
const FALLBACK_QUESTS = [
  { chapter: 'Prologue', act: 'I', title: 'Utterance of Marvels', location: 'Gorges of Spirits', unionReq: 0 },
  { chapter: 'Prologue', act: 'II', title: "The Shorekeeper's Call", location: 'Wuming Bay', unionReq: 0 },
  { chapter: 'Chapter 1', act: 'I', title: 'First Resonance', location: 'Jinzhou', unionReq: 0 },
  { chapter: 'Chapter 1', act: 'II', title: 'Echoing March', location: 'Jinzhou', unionReq: 5 },
  { chapter: 'Chapter 1', act: 'III', title: 'Ominous Star', location: 'Desorock Highland', unionReq: 10 },
  { chapter: 'Chapter 1', act: 'IV', title: 'Clashing Blades', location: "Tiger's Maw", unionReq: 14 },
  { chapter: 'Chapter 2', act: 'Prologue', title: 'Through the Sea Thou Break', location: 'Black Shores', unionReq: 28 },
  { chapter: 'Chapter 2', act: 'I', title: 'The Sacred Path', location: 'Ragunna', unionReq: 30 },
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

async function loadQuests() {
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
  return FALLBACK_QUESTS.map((q) => ({ ...q }));
}

function groupByChapter(quests) {
  const groups = [];
  const index = new Map();
  for (const q of quests) {
    const name = q.chapter ?? 'Uncategorized';
    if (!index.has(name)) {
      index.set(name, groups.length);
      groups.push({ chapter: name, acts: [] });
    }
    groups[index.get(name)].acts.push(q);
  }
  return groups;
}

function unionRange(acts) {
  const reqs = acts.map((a) => Number(a.unionReq) || 0);
  const min = Math.min(...reqs);
  const max = Math.max(...reqs);
  return min === max ? `Union ${min}` : `Union ${min}–${max}`;
}

export async function initQuests() {
  if (questsInitialized) return;
  questsInitialized = true;

  const tree = document.querySelector('#quest-tree');
  if (!tree) return;

  const quests = await loadQuests();
  const groups = groupByChapter(quests);
  const reduce = reducedMotion();

  tree.innerHTML = '';
  if (!groups.length) {
    const empty = document.createElement('p');
    empty.className = 'res-empty';
    empty.textContent = 'No quest data available.';
    tree.appendChild(empty);
    return;
  }

  groups.forEach((group, gi) => {
    const node = document.createElement('div');
    node.className = 'quest-node';
    node.dataset.open = gi === 0 ? 'true' : 'false';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'quest-toggle';
    toggle.setAttribute('aria-expanded', gi === 0 ? 'true' : 'false');
    toggle.innerHTML =
      '<span class="quest-chapter">' +
      escapeHtml(group.chapter) +
      ' <span class="tag">' +
      escapeHtml(String(group.acts.length)) +
      ' acts</span></span>' +
      '<span class="quest-meta">' +
      escapeHtml(unionRange(group.acts)) +
      ' <span class="quest-chevron" aria-hidden="true">▾</span></span>';

    const body = document.createElement('div');
    body.className = 'quest-body';
    const list = document.createElement('ul');
    list.className = 'quest-acts';
    list.style.cssText = 'list-style:none;margin:0.6rem 0 0;padding:0;display:grid;gap:0.5rem;';
    for (const act of group.acts) {
      const li = document.createElement('li');
      li.className = 'quest-act';
      li.style.cssText =
        'border:1px solid rgba(103,232,249,0.12);border-radius:8px;padding:0.55rem 0.7rem;background:rgba(255,255,255,0.02);';
      li.innerHTML =
        '<strong>Act ' +
        escapeHtml(act.act) +
        ' — ' +
        escapeHtml(act.title) +
        '</strong><br>' +
        '<span class="tag">' +
        escapeHtml(act.location ?? 'Unknown') +
        '</span> ' +
        '<span class="tag">Union ' +
        escapeHtml(act.unionReq ?? 0) +
        '+</span>';
      list.appendChild(li);
    }
    body.appendChild(list);
    node.append(toggle, body);
    tree.appendChild(node);

    const setOpen = (open, animateIt = true) => {
      node.dataset.open = String(open);
      toggle.setAttribute('aria-expanded', String(open));
      if (!animateIt || reduce || !animate) {
        body.style.height = '';
        body.style.opacity = '';
        body.style.overflow = '';
        return;
      }
      try {
        if (open) {
          // Expand: measure full height, then animate closed → open.
          body.style.display = '';
          body.style.overflow = 'hidden';
          const full = body.scrollHeight;
          animate(body, {
            height: [0, full],
            opacity: [0, 1],
            duration: 380,
            ease: 'outCubic',
            onComplete: () => {
              body.style.height = '';
              body.style.opacity = '';
              body.style.overflow = '';
            },
          });
        } else {
          // Collapse: animate open → closed, CSS hides the body at the end
          // via [data-open="false"] (display:none set after the tween so
          // the height/opacity motion is visible).
          body.style.overflow = 'hidden';
          const full = body.scrollHeight;
          animate(body, {
            height: [full, 0],
            opacity: [1, 0],
            duration: 300,
            ease: 'inCubic',
            onComplete: () => {
              body.style.height = '';
              body.style.opacity = '';
              body.style.overflow = '';
            },
          });
        }
      } catch {
        body.style.height = '';
        body.style.opacity = '';
        body.style.overflow = '';
      }
    };

    toggle.addEventListener('click', () => {
      setOpen(node.dataset.open !== 'true');
    });
  });

  // Entrance: chapters fade/slide in sequence (skipped under reduced motion).
  if (!reduce && animate) {
    try {
      animate(tree.querySelectorAll('.quest-node'), {
        opacity: [0, 1],
        translateY: [16, 0],
        duration: 450,
        delay: (_el, i) => i * 70,
        ease: 'outCubic',
      });
    } catch {
      // nodes already visible
    }
  }
}

// Auto-init when loaded via its own <script type="module"> tag,
// while still allowing dynamic import + initQuests() calls. Guarded once.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initQuests(), { once: true });
  } else {
    initQuests();
  }
}
