// Shared navigation helpers (02-SPEC-TECHNICZNA.md §3.3): scrollToSection and
// openApp back both plain in-page anchor clicks (Header.astro, Apps.astro's
// on-load deep link) and the chat widget's {{nav:<id>}} actions, so a link click
// and an agent-triggered navigation behave identically.
const HEADER_OFFSET = 80;
const SCROLL_DURATION = 500;
const HIGHLIGHT_DURATION = 1500;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function animateScrollTo(targetY: number): void {
  if (prefersReducedMotion()) {
    window.scrollTo(0, targetY);
    return;
  }
  const startY = window.scrollY;
  const distance = targetY - startY;
  if (distance === 0) return;
  const startTime = performance.now();
  const step = (now: number): void => {
    const elapsed = Math.min((now - startTime) / SCROLL_DURATION, 1);
    const eased = 1 - Math.pow(1 - elapsed, 3); // ease-out cubic
    window.scrollTo(0, startY + distance * eased);
    if (elapsed < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Scrolls to a top-level section by id (e.g. "about", "apps"), clearing the sticky header. */
export function scrollToSection(id: string): void {
  const section = document.getElementById(id);
  if (!section) return;
  const targetY = section.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  animateScrollTo(targetY);
  history.pushState(null, '', `#${id}`);
}

/** Expands an app card's details, centers it in the viewport, and briefly highlights it. */
export function openApp(projectId: string): void {
  const card = document.getElementById(`app-${projectId}`);
  if (!card) return;
  const toggle = card.querySelector<HTMLButtonElement>('.details-toggle');
  if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
  card.classList.add('highlight');
  const targetY =
    card.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2 + card.offsetHeight / 2;
  animateScrollTo(targetY);
  history.pushState(null, '', `#app-${projectId}`);
  setTimeout(() => card.classList.remove('highlight'), HIGHLIGHT_DURATION);
}
