// Expand/collapse for project cards (AppCard + FeaturedCard share the `.details-toggle` markup).
// Lives in one module so the handler is bound exactly once per button, however many card
// components import it (Astro runs a shared module a single time per page).
document.querySelectorAll<HTMLButtonElement>('.details-toggle').forEach((button) => {
  const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
  if (!panel) return;
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    panel.hidden = expanded;
    button.textContent = expanded ? button.dataset.labelShow! : button.dataset.labelHide!;
  });
});
