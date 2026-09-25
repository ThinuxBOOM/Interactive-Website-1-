// Anime.js v4 is an optional progressive enhancement loaded via dynamic import.
// If the CDN is unreachable, animations are skipped but the roster still renders.
let animate = null;
let stagger = null;
let animeUtils = null;
try {
  const animeModule = await import('https://esm.sh/animejs');
  animate = animeModule.animate;
  stagger = animeModule.stagger;
  animeUtils = animeModule.utils;
} catch {
  // CDN unavailable — roster renders without motion.
}

// Fetch resolves against the document base (index.html), so the path must be
// relative to the site root, matching js/team.js ('data/resonators.json').
const DATA_URLS = ['data/resonators.json', './data/resonators.json'];

let resonatorsInitialized = false;

// Inline fallback (used when fetch fails, e.g. opened via file://).
// Shape mirrors data/resonators.json: id, name, element, weapon, rarity, role, description, skills.
const FALLBACK_RESONATORS = [
  {
    id: 'jinhsi',
    name: 'Jinhsi',
    element: 'Spectro',
    weapon: 'Broadblade',
    rarity: 5,
    role: 'Main DPS',
    description: 'The magistrate of Jinzhou, a taciturn leader who carries the will of her people into every battle.',
    skills: ['Basic Attack: Slash of Breaking Dawn', 'Resonance Skill: Overflowing Radiance', 'Resonance Liberation: Purifying Light', 'Forte Circuit: Luminal Synthesis'],
  },
  {
    id: 'changli',
    name: 'Changli',
    element: 'Fusion',
    weapon: 'Sword',
    rarity: 5,
    role: 'Main DPS',
    description: 'Jinhsi’s mentor and a former magistrate candidate whose flames embody strategy and resolve.',
    skills: ['Basic Attack: Blazing Envoys', 'Resonance Skill: Tripartite Flame', 'Resonance Liberation: Radiance of Fealty', 'Forte Circuit: Enflamement'],
  },
  {
    id: 'carlotta',
    name: 'Carlotta',
    element: 'Glacio',
    weapon: 'Pistols',
    rarity: 5,
    role: 'Main DPS',
    description: 'A Montelli artist-assassin whose every shot is composed like a masterpiece.',
    skills: ['Basic Attack: Art of Elegance', 'Resonance Skill: Custom Crystal', 'Resonance Liberation: Death Knell', 'Forte Circuit: Final Stroke'],
  },
  {
    id: 'camellya',
    name: 'Camellya',
    element: 'Havoc',
    weapon: 'Sword',
    rarity: 5,
    role: 'Main DPS',
    description: 'A Bloom Bearer of the Black Shores, enthralled by strength and the thrill of the hunt.',
    skills: ['Basic Attack: Vine Lash', 'Resonance Skill: Ephemeral Vow', 'Resonance Liberation: Blossoming', 'Forte Circuit: Burgeoning Phantasm'],
  },
  {
    id: 'calcharo',
    name: 'Calcharo',
    element: 'Electro',
    weapon: 'Broadblade',
    rarity: 5,
    role: 'Main DPS',
    description: 'Leader of the Ghost Hounds, a mercenary chief who honors every contract to the letter.',
    skills: ['Basic Attack: Hunting Quarry', 'Resonance Skill: Extermination Order', 'Resonance Liberation: Phantom Etching', 'Forte Circuit: Death Messenger'],
  },
  {
    id: 'encore',
    name: 'Encore',
    element: 'Fusion',
    weapon: 'Rectifier',
    rarity: 5,
    role: 'Sub DPS',
    description: 'A cheerful storyteller from the New Federation accompanied by her plushies Cloudy and Cosmos.',
    skills: ['Basic Attack: Wooly Attack', 'Resonance Skill: Cloudy Frenzy', 'Resonance Liberation: Cosmos Rave', 'Forte Circuit: Dizzying Countdown'],
  },
  {
    id: 'verina',
    name: 'Verina',
    element: 'Spectro',
    weapon: 'Rectifier',
    rarity: 5,
    role: 'Support',
    description: 'A gentle botanist whose photosynthesis-fueled healing keeps every team in bloom.',
    skills: ['Basic Attack: Cultivation', 'Resonance Skill: Botany Trial', 'Resonance Liberation: Arboreal Flourish', 'Forte Circuit: Photosynthesis'],
  },
  {
    id: 'yangyang',
    name: 'Yangyang',
    element: 'Aero',
    weapon: 'Sword',
    rarity: 4,
    role: 'Support',
    description: 'A soft-spoken outrider of the Midnight Rangers who rides the wind to protect Jinzhou.',
    skills: ['Basic Attack: Feather as Blade', 'Resonance Skill: Zephyr Domain', 'Resonance Liberation: Windstorm', 'Forte Circuit: Soughing Wind'],
  },
];

const ELEMENT_GRADIENTS = {
  Fusion: 'linear-gradient(135deg, #f97316, #ef4444)',
  Glacio: 'linear-gradient(135deg, #67e8f9, #3b82f6)',
  Electro: 'linear-gradient(135deg, #c084fc, #7c3aed)',
  Aero: 'linear-gradient(135deg, #6ee7b7, #14b8a6)',
  Spectro: 'linear-gradient(135deg, #fde68a, #f59e0b)',
  Havoc: 'linear-gradient(135deg, #f472b6, #881337)',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stars(rarity) {
  const count = Math.max(0, Math.min(5, Number(rarity) || 0));
  return '★'.repeat(count) + '☆'.repeat(5 - count);
}

function gradientFor(element) {
  return ELEMENT_GRADIENTS[element] || 'linear-gradient(135deg, #64748b, #334155)';
}

// querySelectorAll helper that prefers anime.js utils.$ when available,
// falling back to native DOM lookup.
function selectAll(selector, root) {
  const scope = root || document;
  try {
    if (animeUtils && typeof animeUtils.$ === 'function') {
      const found = animeUtils.$(selector, scope);
      if (found) return Array.isArray(found) ? found : Array.from(found);
    }
  } catch {
    // fall through to native lookup
  }
  return Array.from(scope.querySelectorAll(selector));
}

async function loadResonators() {
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
  return [...FALLBACK_RESONATORS];
}

function cardHtml(r) {
  const initial = escapeHtml((r.name || '?').charAt(0).toUpperCase());
  return (
    '<div class="res-avatar" aria-hidden="true" style="background:' +
    gradientFor(r.element) +
    '">' +
    initial +
    '</div>' +
    '<h3 class="res-name">' +
    escapeHtml(r.name) +
    '</h3>' +
    '<span class="element-badge element-' +
    escapeHtml((r.element || '').toLowerCase()) +
    '">' +
    escapeHtml(r.element) +
    '</span>' +
    '<p class="res-weapon">' +
    escapeHtml(r.weapon) +
    '</p>' +
    '<p class="res-rarity" aria-label="' +
    escapeHtml(r.rarity) +
    ' stars">' +
    stars(r.rarity) +
    '</p>' +
    '<p class="res-role">' +
    escapeHtml(r.role) +
    '</p>'
  );
}

function modalHtml(r) {
  const initial = escapeHtml((r.name || '?').charAt(0).toUpperCase());
  const skills = Array.isArray(r.skills) ? r.skills : [];
  // data/resonators.json stores skills as { name, description } objects while
  // the inline fallback uses plain strings — support both shapes.
  const skillsHtml = skills.length
    ? '<ul class="res-skills">' +
      skills
        .map((s) => {
          if (s && typeof s === 'object') {
            const skillName = escapeHtml(s.name ?? 'Skill');
            const skillDesc = s.description ? ' — ' + escapeHtml(s.description) : '';
            return '<li><strong>' + skillName + '</strong>' + skillDesc + '</li>';
          }
          return '<li>' + escapeHtml(s) + '</li>';
        })
        .join('') +
      '</ul>'
    : '<p class="res-skills-empty">No skills listed.</p>';
  return (
    '<div class="res-avatar res-avatar-lg" aria-hidden="true" style="background:' +
    gradientFor(r.element) +
    '">' +
    initial +
    '</div>' +
    '<h2 class="res-name" id="modal-title">' +
    escapeHtml(r.name) +
    '</h2>' +
    '<span class="element-badge element-' +
    escapeHtml((r.element || '').toLowerCase()) +
    '">' +
    escapeHtml(r.element) +
    '</span>' +
    '<p class="res-weapon">' +
    escapeHtml(r.weapon) +
    ' · <span class="res-rarity">' +
    stars(r.rarity) +
    '</span> · ' +
    escapeHtml(r.role) +
    '</p>' +
    '<p class="res-description">' +
    escapeHtml(r.description) +
    '</p>' +
    skillsHtml
  );
}

export async function initResonators() {
  if (resonatorsInitialized) return;
  resonatorsInitialized = true;

  const grid = document.querySelector('#resonator-grid');
  const filterBar = document.querySelector('#filter-bar');
  const modal = document.querySelector('#resonator-modal');
  const modalCard = document.querySelector('#modal-card');
  const modalClose = document.querySelector('#modal-close');
  if (!grid) return;

  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const all = await loadResonators();
  let activeElement = 'All';
  let activeWeapon = 'All';

  function playEntrance() {
    if (reduceMotion || !animate || !stagger) return;
    const cards = selectAll('.res-card', grid);
    if (!cards.length) return;
    try {
      animate('.res-card', {
        opacity: [0, 1],
        translateY: [24, 0],
        delay: stagger(60),
        duration: 600,
        ease: 'outCubic',
      });
    } catch {
      // motion failed — cards are already in the DOM and visible
    }
  }

  function bindHover(card) {
    if (reduceMotion || !animate) return;
    card.addEventListener('mouseenter', () => {
      try {
        animate(card, { scale: 1.03, duration: 250, ease: 'outCubic' });
      } catch {
        // ignore animation failure
      }
    });
    card.addEventListener('mouseleave', () => {
      try {
        animate(card, { scale: 1, duration: 250, ease: 'outCubic' });
      } catch {
        // ignore animation failure
      }
    });
  }

  function getFiltered() {
    return all.filter((r) => {
      const elementOk = activeElement === 'All' || r.element === activeElement;
      const weaponOk = activeWeapon === 'All' || r.weapon === activeWeapon;
      return elementOk && weaponOk;
    });
  }

  function render(list) {
    grid.innerHTML = '';
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'res-empty';
      empty.textContent = 'No resonators match this filter.';
      grid.appendChild(empty);
      return;
    }
    for (const r of list) {
      const card = document.createElement('article');
      card.className = 'res-card';
      card.dataset.id = r.id;
      card.dataset.element = r.element;
      card.dataset.weapon = r.weapon;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', 'View details for ' + r.name);
      card.innerHTML = cardHtml(r);
      grid.appendChild(card);
      bindHover(card);
    }
    playEntrance();
  }

  function openModal(r) {
    if (!modal || !modalCard) return;
    // #modal-close lives inside #modal-card in index.html — detach it before
    // replacing the card content, otherwise the first open destroys the button.
    const closeBtn =
      modalClose && modalClose.parentElement === modalCard
        ? modalCard.removeChild(modalClose)
        : null;
    modalCard.innerHTML = modalHtml(r);
    if (closeBtn) modalCard.prepend(closeBtn);
    modal.classList.remove('hidden');
    if (closeBtn) closeBtn.focus();
    if (reduceMotion || !animate) return;
    try {
      animate(modalCard, { scale: [0.92, 1], opacity: [0, 1], duration: 350, ease: 'outCubic' });
    } catch {
      // modal is already open and readable — skip motion
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add('hidden');
  }

  // Card click (delegated) + keyboard activation.
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.res-card');
    if (!card) return;
    const found = all.find((r) => r.id === card.dataset.id);
    if (found) openModal(found);
  });
  grid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.res-card');
    if (!card) return;
    e.preventDefault();
    const found = all.find((r) => r.id === card.dataset.id);
    if (found) openModal(found);
  });

  // Filters: buttons with data-weapon filter by weapon,
  // buttons with data-filter filter by element. "All" resets that group.
  if (filterBar) {
    filterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      if (btn.dataset.weapon !== undefined && btn.dataset.weapon !== '') {
        activeWeapon = btn.dataset.weapon;
        selectAll('.filter-btn[data-weapon]', filterBar).forEach((b) => {
          const isActive = b === btn;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-pressed', String(isActive));
        });
      } else {
        activeElement = btn.dataset.filter || 'All';
        selectAll('.filter-btn:not([data-weapon])', filterBar).forEach((b) => {
          const isActive = b === btn;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-pressed', String(isActive));
        });
      }
      render(getFiltered());
    });
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modal) {
    // Backdrop click: only when the click target is the modal backdrop itself.
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeModal();
  });

  render(all);
}
