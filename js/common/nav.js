/**
 * js/common/nav.js — shared navigation behaviour (vanilla, no build).
 * - Mobile menu toggle (.nav-toggle ↔ .nav-links.open)
 * - Smooth same-page anchor scrolling (respects prefers-reduced-motion)
 * - Closes the mobile menu after a link is activated
 */

export function initNav() {
  const header = document.querySelector('header[data-shared-nav]');
  if (!header) return;

  const toggle = header.querySelector('.nav-toggle');
  const links = header.querySelector('.nav-links');
  if (!links) return;

  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', (event) => {
      const anchor = event.target.closest('a');
      if (!anchor) return;
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  }

  // Smooth scroll for same-page hash links only (cross-page links navigate normally).
  const prefersReduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  header.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href^="#"]');
    if (!anchor) return;
    const hash = anchor.getAttribute('href');
    if (!hash || hash === '#') return;
    const target = document.querySelector(hash);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
    try {
      history.replaceState(null, '', hash);
    } catch {
      // Hash update is cosmetic — ignore failures (e.g. sandboxed iframes).
    }
  });
}
