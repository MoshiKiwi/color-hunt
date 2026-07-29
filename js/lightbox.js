let overlay;

function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML = `
    <button class="lightbox-close" aria-label="Fermer">×</button>
    <img class="lightbox-img" alt="" />
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.classList.contains('lightbox-close')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  return overlay;
}

function open(src) {
  const el = ensureOverlay();
  el.querySelector('.lightbox-img').src = src;
  el.classList.add('open');
}

function close() {
  if (overlay) overlay.classList.remove('open');
}

// Event delegation so newly-rendered photo grids (re-rendered on every
// poll tick) work without re-attaching listeners.
export function initLightbox(containerSelector = '.photo-grid') {
  document.addEventListener('click', (e) => {
    const img = e.target.closest(`${containerSelector} img`);
    if (!img) return;
    e.stopPropagation(); // don't also trigger a parent card's click handler (e.g. vote selection)
    open(img.src);
  });
}
