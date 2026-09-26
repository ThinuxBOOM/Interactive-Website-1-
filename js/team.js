// Anime.js v4 is an optional progressive enhancement loaded via dynamic import.
// If the CDN is unreachable, team logic works without the slot pop animation.
let animate = null;
try {
  ({ animate } = await import('https://esm.sh/animejs'));
} catch {
  // CDN unavailable — team builder works without motion.
}

const STORAGE_KEY = 'wuwa_team_v1';
const TEAM_SIZE = 3;

let teamInitialized = false;

const FALLBACK_RESONATORS = [
  { id: 'jiyan', name: 'Jiyan', element: 'Aero', role: 'DPS' },
  { id: 'yinlin', name: 'Yinlin', element: 'Electro', role: 'Sub-DPS' },
  { id: 'verina', name: 'Verina', element: 'Spectro', role: 'Support' },
  { id: 'calcharo', name: 'Calcharo', element: 'Electro', role: 'DPS' },
  { id: 'encore', name: 'Encore', element: 'Fusion', role: 'DPS' },
  { id: 'jianxin', name: 'Jianxin', element: 'Aero', role: 'Support' },
  { id: 'rover', name: 'Rover (Spectro)', element: 'Spectro', role: 'DPS' },
  { id: 'baizhi', name: 'Baizhi', element: 'Glacio', role: 'Support' },
];

function loadStoredTeam() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [null, null, null];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [null, null, null];
    const team = [null, null, null];
    for (let i = 0; i < TEAM_SIZE; i++) {
      team[i] = typeof parsed[i] === 'string' ? parsed[i] : null;
    }
    return team;
  } catch {
    return [null, null, null];
  }
}

function persistTeam(team) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(team));
  } catch {
    // storage unavailable (private mode / quota) — team still works in-memory
  }
}

function normalizeResonators(json) {
  const list = Array.isArray(json) ? json : json?.resonators;
  if (!Array.isArray(list) || list.length === 0) return null;
  return list
    .filter((r) => r && r.id && r.name)
    .map((r) => ({
      id: String(r.id),
      name: String(r.name),
      element: String(r.element ?? r.attribute ?? 'Unknown'),
      role: String(r.role ?? 'DPS'),
    }));
}

async function loadResonators() {
  // Normalize to data/... with document-base fallbacks (matches other pages).
  const urls = ['data/resonators.json', './data/resonators.json', '../data/resonators.json'];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const normalized = normalizeResonators(await res.json());
      if (normalized) return normalized;
    } catch {
      // try next URL, then inline fallback
    }
  }
  return [...FALLBACK_RESONATORS];
}

function popSlot(slotEl) {
  if (!animate) return;
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }
  try {
    animate(slotEl, { scale: [0.9, 1], duration: 350, ease: 'outBack' });
  } catch {
    // animation is progressive enhancement — never break team logic
  }
}

export async function initTeam() {
  if (teamInitialized) return;
  teamInitialized = true;

  const slotsRoot = document.querySelector('#team-slots');
  const bonusEl = document.querySelector('#team-bonus');
  const pickerEl = document.querySelector('#roster-picker');
  if (!slotsRoot || !bonusEl || !pickerEl) return;

  let slotEls = Array.from(slotsRoot.querySelectorAll('.team-slot'));
  // If index.html ever ships an empty container, build the 3 slots ourselves
  // so selectors `.team-slot[data-slot="0,1,2"]` always exist.
  if (slotEls.length === 0) {
    slotsRoot.innerHTML = '';
    for (let i = 0; i < TEAM_SIZE; i++) {
      const div = document.createElement('div');
      div.className = 'team-slot';
      div.dataset.slot = String(i);
      slotsRoot.appendChild(div);
    }
    slotEls = Array.from(slotsRoot.querySelectorAll('.team-slot'));
  }

  const resonators = await loadResonators();
  const byId = new Map(resonators.map((r) => [r.id, r]));
  let team = loadStoredTeam().filter((id) => id === null || byId.has(id));
  while (team.length < TEAM_SIZE) team.push(null);
  team = team.slice(0, TEAM_SIZE);
  let selectedSlot = null;

  function renderRoster() {
    pickerEl.innerHTML = '';
    for (const r of resonators) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'roster-btn';
      btn.dataset.id = r.id;
      btn.textContent = r.name;
      btn.title = `${r.name} — ${r.element} / ${r.role}`;
      if (team.includes(r.id)) btn.classList.add('in-team');
      btn.addEventListener('click', () => assignResonator(r.id));
      pickerEl.appendChild(btn);
    }
  }

  function renderSlots() {
    for (const slotEl of slotEls) {
      const idx = Number(slotEl.dataset.slot);
      const id = team[idx];
      const r = id ? byId.get(id) : null;
      slotEl.classList.toggle('filled', Boolean(r));
      slotEl.classList.toggle('selected', selectedSlot === idx);
      slotEl.textContent = '';
      if (r) {
        const name = document.createElement('span');
        name.className = 'slot-name';
        name.textContent = r.name;
        const meta = document.createElement('span');
        meta.className = 'slot-meta';
        meta.textContent = `${r.element} · ${r.role}`;
        slotEl.append(name, meta);
      } else {
        const empty = document.createElement('span');
        empty.className = 'slot-empty';
        empty.textContent = `Slot ${idx + 1} — Empty`;
        slotEl.appendChild(empty);
      }
    }
  }

  function renderBonus() {
    const members = team.map((id) => (id ? byId.get(id) : null)).filter(Boolean);
    const counts = new Map();
    for (const m of members) counts.set(m.element, (counts.get(m.element) ?? 0) + 1);
    const distinct = counts.size;
    let bonus;
    const topEntry = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topEntry && topEntry[1] >= 2) {
      bonus = `Resonance: ${topEntry[0]} Harmony - intro skill boost`;
    } else if (members.length === TEAM_SIZE && distinct === TEAM_SIZE) {
      bonus = 'Triad Focus - ER +15%';
    } else {
      bonus = 'No set bonus';
    }
    const roles = members.map((m) => `${m.name} (${m.role})`).join(', ');
    bonusEl.textContent = roles ? `${bonus} | Roles: ${roles}` : bonus;
  }

  function render() {
    renderSlots();
    renderRoster();
    renderBonus();
  }

  function assignResonator(id) {
    if (!byId.has(id)) return;
    // No duplicates: focus the slot that already holds this resonator.
    if (team.includes(id)) {
      selectedSlot = team.indexOf(id);
      render();
      return;
    }
    let target = selectedSlot;
    if (target === null || target === undefined) {
      target = team.findIndex((s) => s === null);
      if (target === -1) return; // full + no selection: do nothing
    }
    team[target] = id;
    selectedSlot = null;
    persistTeam(team);
    render();
    const slotEl = slotsRoot.querySelector(`.team-slot[data-slot="${target}"]`);
    if (slotEl) popSlot(slotEl);
  }

  function onSlotClick(idx) {
    if (team[idx]) {
      if (selectedSlot === idx) {
        // Second click on a selected filled slot removes it.
        team[idx] = null;
        selectedSlot = null;
        persistTeam(team);
        render();
      } else {
        // First click selects it (roster clicks will overwrite it).
        selectedSlot = idx;
        renderSlots();
      }
    } else {
      // Clicking an empty slot selects it as the assign target (toggle).
      selectedSlot = selectedSlot === idx ? null : idx;
      renderSlots();
    }
  }

  slotEls.forEach((slotEl) => {
    slotEl.addEventListener('click', () => onSlotClick(Number(slotEl.dataset.slot)));
  });

  render();
}

// Auto-init when loaded via its own <script type="module"> tag,
// while still allowing layout.js to import { initTeam } and call it.
// Guarded so it only ever runs once (initTeam no-ops off the team page).
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initTeam(), { once: true });
  } else {
    initTeam();
  }
}
