/**
 * js/common/layout.js — shared shell for all archive pages (vanilla, no build).
 * - Injects the shared header nav into <header data-shared-nav> when missing.
 * - Injects the shared footer disclaimer when missing.
 * - Highlights the active nav link for the current page.
 * - Wires js/common/nav.js (mobile toggle + smooth scroll) and
 *   js/common/reveal.js (scroll reveals) on every page.
 * - On the hub (index.html), lazily starts the hero + particle canvas
 *   via the existing js/common/hero.js + js/common/particles.js mirrors
 *   (canonical js/hero.js + js/particles.js) and the hub cards via
 *   js/hub.js (mirrored at js/pages/hub.js), all guarded.
 * - Lazy-imports every js/pages/* module by DOM presence (single entry —
 *   no per-page <script> tags needed):
 *     #resonator-grid → resonators, #dossier → resonator-detail,
 *     #echo-grid → echoes, #weapon-grid → weapons, #nation-tabs → atlas,
 *     #lore-grid/#timeline-rail → lore, #quest-tree → quests,
 *     #bestiary-grid → bestiary, #banner-switcher → convene,
 *     #team-slots → team, #hub/#hero → hub/hero/particles.
 *   Each page module guards itself (initialized flag), so the explicit call
 *   after a module's own autoInit is a safe no-op — no double-init.
 *
 * Every archive page includes only:
 *   <script type="module" src="js/common/layout.js"></script>
 */

import { initNav } from './nav.js';
import { initReveal } from './reveal.js';

/** Pages shown in the shared nav (resonator.html is a detail view, linked contextually). */
export const NAV_LINKS = [
  { href: 'index.html', label: 'Home' },
  { href: 'resonators.html', label: 'Resonators' },
  { href: 'echoes.html', label: 'Echoes' },
  { href: 'weapons.html', label: 'Weapons' },
  { href: 'atlas.html', label: 'Atlas' },
  { href: 'lore.html', label: 'Lore' },
  { href: 'quests.html', label: 'Quests' },
  { href: 'bestiary.html', label: 'Bestiary' },
  { href: 'convene.html', label: 'Convene' },
  { href: 'team.html', label: 'Team' },
];

export const FOOTER_HTML =
  '<p><strong>Wuthering Waves — Solaris-3 Fan Hub.</strong> ' +
  'Unofficial fan archive. All art © Kuro Games. Not affiliated.</p>' +
  '<p>Wuthering Waves and all related characters, names, and assets are trademarks of ' +
  'their respective owners. This is a non-commercial fan project for education and entertainment.</p>';

function currentFile() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  return path.split('?')[0].split('#')[0] || 'index.html';
}

export function ensureHeaderNav() {
  const header = document.querySelector('header[data-shared-nav]');
  if (!header) return null;
  if (!header.querySelector('.nav-inner')) {
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Primary');
    nav.className = 'nav-inner';

    const brand = document.createElement('a');
    brand.className = 'nav-brand';
    brand.href = 'index.html';
    brand.innerHTML = 'Wuthering <span>Waves</span> · Solaris-3';

    const toggle = document.createElement('button');
    toggle.className = 'nav-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Toggle navigation menu');
    toggle.textContent = '☰';

    const list = document.createElement('ul');
    list.className = 'nav-links';
    for (const link of NAV_LINKS) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = link.href;
      a.textContent = link.label;
      a.dataset.navFile = link.href;
      li.appendChild(a);
      list.appendChild(li);
    }

    nav.appendChild(brand);
    nav.appendChild(toggle);
    nav.appendChild(list);
    header.appendChild(nav);
  }
  // Active-link highlight (works for static or injected nav).
  const file = currentFile();
  header.querySelectorAll('.nav-links a').forEach((a) => {
    const target = (a.getAttribute('href') || '').split('?')[0].split('#')[0];
    const isActive = target === file || (file === '' && target === 'index.html');
    if (isActive) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    } else {
      a.classList.remove('active');
      a.removeAttribute('aria-current');
    }
  });
  return header;
}

export function ensureFooter() {
  let footer = document.querySelector('footer[data-shared-footer]');
  if (!footer) {
    footer = document.querySelector('footer');
    if (!footer) {
      footer = document.createElement('footer');
      footer.setAttribute('data-shared-footer', '');
      document.body.appendChild(footer);
    } else {
      footer.setAttribute('data-shared-footer', '');
    }
  }
  if (!footer.innerHTML.trim()) footer.innerHTML = FOOTER_HTML;
  return footer;
}

/** Start hero + particle canvas on pages that include them (hub only). */
async function initHubExtras() {
  // Hero canvas.
  if (document.getElementById('tacet-canvas') || document.getElementById('hero')) {
    try {
      const [{ initHero }, { initParticles }] = await Promise.all([
        import('./hero.js'),
        import('./particles.js'),
      ]);
      if (typeof initHero === 'function') initHero();
      if (typeof initParticles === 'function') initParticles();
    } catch (err) {
      console.error('[layout] hero extras failed:', err);
    }
  }
  // Hub cards (index.html #hub). Canonical impl is js/hub.js;
  // js/pages/hub.js re-exports it — try canonical first, mirror as fallback.
  if (document.getElementById('hub')) {
    try {
      let mod = null;
      try {
        mod = await import('../hub.js');
      } catch {
        mod = await import('../pages/hub.js');
      }
      if (typeof mod.initHub === 'function') mod.initHub();
      else if (typeof mod.init === 'function') mod.init();
    } catch (err) {
      console.error('[layout] hub failed:', err);
    }
  }
}

/**
 * Call the first matching init export on a lazily-imported page module.
 * Every page module guards itself (initialized flag) so an explicit call
 * after the module's own autoInit is a safe no-op (returns { skipped: true }).
 */
async function runPageModule(specifiers, exportNames, label) {
  let lastError = null;
  for (const spec of specifiers) {
    try {
      const mod = await import(spec);
      for (const name of exportNames) {
        if (typeof mod[name] === 'function') {
          await mod[name]();
          return name;
        }
      }
      return null; // imported but no known export — treat as loaded
    } catch (err) {
      lastError = err;
    }
  }
  console.error('[layout] ' + label + ' failed:', lastError);
  return null;
}

/** Start per-page modules based on DOM presence (each module guards itself). */
async function initPageModules() {
  const jobs = [];
  // Resonator roster.
  if (document.getElementById('resonator-grid')) {
    jobs.push(
      runPageModule(['../pages/resonators.js'], ['init', 'initResonators', 'initResonatorsPage'], 'resonators'),
    );
  }
  // Resonator dossier (?id=).
  if (document.getElementById('dossier')) {
    jobs.push(
      runPageModule(
        ['../pages/resonator-detail.js'],
        ['init', 'initResonatorDetail', 'initDossier'],
        'resonator-detail',
      ),
    );
  }
  // Echoes + sonata builder.
  if (document.getElementById('echo-grid')) {
    jobs.push(
      runPageModule(['../pages/echoes.js'], ['init', 'initEchoes', 'initEchoesPage'], 'echoes'),
    );
  }
  // Weapons armoury.
  if (document.getElementById('weapon-grid')) {
    jobs.push(
      runPageModule(['../pages/weapons.js'], ['init', 'initWeapons', 'initWeaponsPage'], 'weapons'),
    );
  }
  // Atlas nations/regions.
  if (document.getElementById('nation-tabs')) {
    jobs.push(
      runPageModule(['../pages/atlas.js'], ['initAtlas', 'init', 'initAtlasPage'], 'atlas'),
    );
  }
  // Lore grid + timeline rail.
  if (document.getElementById('lore-grid') || document.getElementById('timeline-rail')) {
    jobs.push(runPageModule(['../pages/lore.js'], ['initLore', 'init', 'initLorePage'], 'lore'));
  }
  // Quest tree.
  if (document.getElementById('quest-tree')) {
    jobs.push(
      runPageModule(['../pages/quests.js'], ['initQuests', 'init', 'initQuestsPage'], 'quests'),
    );
  }
  // Bestiary.
  if (document.getElementById('bestiary-grid')) {
    jobs.push(
      runPageModule(['../pages/bestiary.js'], ['initBestiary', 'init', 'initBestiaryPage'], 'bestiary'),
    );
  }
  // Convene simulator (pages mirror re-exports the canonical ../convene.js).
  if (
    document.getElementById('banner-switcher') ||
    document.getElementById('pull-1') ||
    document.getElementById('convene-results')
  ) {
    jobs.push(
      runPageModule(
        ['../pages/convene.js', '../convene.js'],
        ['initConvene', 'init'],
        'convene',
      ),
    );
  }
  // Team builder (pages mirror re-exports the canonical ../team.js).
  if (document.getElementById('team-slots')) {
    jobs.push(runPageModule(['../pages/team.js', '../team.js'], ['initTeam', 'init'], 'team'));
  }
  // Hub entrance is handled by initHubExtras; this covers a #hub present
  // without a hero canvas (same module, guarded — second call no-ops).
  if (document.getElementById('hub') && !document.getElementById('tacet-canvas')) {
    jobs.push(
      runPageModule(['../hub.js', '../pages/hub.js'], ['initHub', 'init'], 'hub'),
    );
  }
  if (jobs.length) await Promise.allSettled(jobs);
}

function init() {
  try {
    ensureHeaderNav();
  } catch (err) {
    console.error('[layout] header nav failed:', err);
  }
  try {
    ensureFooter();
  } catch (err) {
    console.error('[layout] footer failed:', err);
  }
  try {
    initNav();
  } catch (err) {
    console.error('[layout] nav failed:', err);
  }
  try {
    initReveal(document);
  } catch (err) {
    console.error('[layout] reveal failed:', err);
  }
  initHubExtras();
  initPageModules();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}
