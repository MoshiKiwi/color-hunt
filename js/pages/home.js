import { api } from '../api.js';
import { initNav, getCurrentUser } from '../nav.js';
import { uploadPhoto } from '../photo.js';
import { difficultyBadge, formatDate } from '../labels.js';
import { initLightbox } from '../lightbox.js';

const content = document.getElementById('content');
const TOAST_DISMISSED_KEY = 'supersnap_intro_dismissed';

function renderIntroToast() {
  const mount = document.getElementById('intro-toast');
  if (!mount || localStorage.getItem(TOAST_DISMISSED_KEY)) return;

  mount.innerHTML = `
    <div class="card intro-toast">
      <button id="intro-toast-close" class="link-btn intro-toast-close" aria-label="Fermer">×</button>
      <p><strong>C'est quoi, SuperSnap ?</strong> Chaque semaine ou chaque mois, on tire un thème ou une couleur au sort — plus c'est difficile, moins il faut de photos. Photographiez tout ce qui correspond, vos photos rejoignent la collection commune en direct, puis tout le monde vote pour ses favorites pour gagner des points.</p>
    </div>
  `;
  document.getElementById('intro-toast-close').addEventListener('click', () => {
    localStorage.setItem(TOAST_DISMISSED_KEY, '1');
    mount.innerHTML = '';
  });
}

function photoGalleryHtml(photos) {
  if (!photos.length) {
    return '<p class="muted">Aucune photo pour l\'instant — soyez le premier ou la première !</p>';
  }
  return `
    <div class="photo-grid">
      ${photos
        .map((p) => `<figure><img src="${p.url}" loading="lazy" /><figcaption>${p.username}</figcaption></figure>`)
        .join('')}
    </div>
  `;
}

const STATUS_LABELS = {
  pending_review: 'En cours de vérification',
  rejected: 'Refusée',
};

function myPhotoGalleryHtml(myPhotos) {
  if (!myPhotos.length) return '';
  return `
    <h3>Mes photos</h3>
    <div class="photo-grid">
      ${myPhotos
        .map(
          (p) => `
        <figure>
          <button class="photo-delete" data-url="${encodeURIComponent(p.url)}" aria-label="Supprimer cette photo">×</button>
          <img src="${p.url}" loading="lazy" />
          ${STATUS_LABELS[p.status] ? `<figcaption class="photo-status">${STATUS_LABELS[p.status]}</figcaption>` : ''}
        </figure>`
        )
        .join('')}
    </div>
  `;
}

function renderNoCycle(upcoming) {
  content.innerHTML = `
    <div class="card">
      <h1>Aucun défi en ce moment</h1>
      ${upcoming ? `<p class="muted">Le prochain défi commence le ${formatDate(upcoming.submissionStart)}.</p>` : '<p class="muted">Revenez bientôt !</p>'}
    </div>
  `;
}

function renderVotingOpen(cycle, photos) {
  const loggedIn = !!getCurrentUser();
  content.innerHTML = `
    <div class="card">
      <h1>${cycle.promptText} ${difficultyBadge(cycle.difficulty)}</h1>
      <p>Les soumissions sont closes, place au vote !</p>
      ${loggedIn ? '<a class="btn" href="vote.html">Aller voter</a>' : '<a class="btn" href="compte.html">Se connecter pour voter</a>'}
    </div>
    <div class="card">
      <h2>La collection</h2>
      ${photoGalleryHtml(photos)}
    </div>
  `;
}

async function renderSubmissionOpen(cycle, photos) {
  const user = getCurrentUser();
  let myPhotos = [];
  if (user) {
    const { submission } = await api.get('/api/submissions/mine');
    myPhotos = submission?.photos || [];
  }
  const myCount = myPhotos.filter((p) => p.status !== 'rejected').length;
  const complete = myCount >= cycle.minPhotos;
  const pct = Math.min(100, Math.round((myCount / cycle.minPhotos) * 100));

  content.innerHTML = `
    <div class="card">
      <h1>${cycle.promptText} ${difficultyBadge(cycle.difficulty)}</h1>
      <p class="muted">Soumissions ouvertes jusqu'au ${formatDate(cycle.submissionEnd)}</p>
      ${
        user
          ? `
        <p><span class="counter">${myCount} / ${cycle.minPhotos}</span> ${complete ? ' — pellicule complète !' : ''}</p>
        <div class="progress-bar"><div style="width:${pct}%"></div></div>
        <div class="file-picker">
          <label for="photo-input" class="btn file-picker-label">Choisir des photos</label>
          <input id="photo-input" type="file" accept="image/*" multiple class="file-input-hidden" />
          <span class="muted" id="upload-status"></span>
        </div>
        <p class="error" id="upload-error"></p>
        ${myPhotoGalleryHtml(myPhotos)}
      `
          : `
        <p class="muted">Connectez-vous pour participer à ce défi.</p>
        <a class="btn" href="compte.html">Se connecter / Créer un compte</a>
      `
      }
    </div>
    <div class="card">
      <h2>La collection</h2>
      ${photoGalleryHtml(photos)}
    </div>
  `;

  if (!user) return;

  document.querySelectorAll('.photo-delete').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const url = decodeURIComponent(btn.dataset.url);
      if (!window.confirm('Supprimer cette photo ?')) return;
      try {
        await api.del('/api/submissions', { photoUrl: url });
        await checkCycle({ force: true });
      } catch (err) {
        document.getElementById('upload-error').textContent = err.message;
      }
    });
  });

  document.getElementById('photo-input').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const input = e.target;
    const label = document.querySelector('.file-picker-label');
    const statusEl = document.getElementById('upload-status');
    const errorEl = document.getElementById('upload-error');
    errorEl.textContent = '';
    input.disabled = true;
    label.style.opacity = '0.6';
    label.style.pointerEvents = 'none';
    uploading = true;

    try {
      const urls = [];
      for (let i = 0; i < files.length; i++) {
        statusEl.textContent = `Envoi ${i + 1}/${files.length}…`;
        urls.push(await uploadPhoto(files[i]));
      }
      await api.post('/api/submissions', { photoUrls: urls });
      statusEl.textContent = 'Envoyé !';
      await checkCycle({ force: true });
    } catch (err) {
      errorEl.textContent = err.message;
      input.disabled = false;
      label.style.opacity = '';
      label.style.pointerEvents = '';
    } finally {
      uploading = false;
    }
  });
}

const POLL_INTERVAL_MS = 5000;
let lastSignature = null;
let uploading = false;

function signatureFor(cycle, upcoming, photos) {
  if (cycle) return `${cycle._id}:${cycle.status}:${(photos || []).length}`;
  return upcoming ? `upcoming:${upcoming._id}` : 'none';
}

async function checkCycle({ force = false } = {}) {
  if (uploading) return; // don't yank the form out from under an in-flight upload

  try {
    const { cycle, upcoming, photos } = await api.get('/api/cycles/current');
    const signature = signatureFor(cycle, upcoming, photos);
    if (!force && signature === lastSignature) return; // nothing changed, leave the view alone
    lastSignature = signature;

    if (!cycle) {
      renderNoCycle(upcoming);
    } else if (cycle.status === 'voting_open') {
      renderVotingOpen(cycle, photos || []);
    } else {
      await renderSubmissionOpen(cycle, photos || []);
    }
  } catch (err) {
    content.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

async function init() {
  await initNav('defi');
  initLightbox();
  renderIntroToast();
  await checkCycle({ force: true });
  setInterval(checkCycle, POLL_INTERVAL_MS);
}

init();
