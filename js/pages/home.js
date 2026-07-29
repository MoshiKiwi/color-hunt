import { api } from '../api.js';
import { initNav, getCurrentUser } from '../nav.js';
import { uploadPhoto } from '../photo.js';
import { buildCollage, downloadCanvas } from '../collage.js';
import { difficultyBadge, formatDate } from '../labels.js';

const content = document.getElementById('content');

function renderLoggedOut() {
  content.innerHTML = `
    <div class="card">
      <h1>Bienvenue sur SuperSnap</h1>
      <p>Chaque semaine ou chaque mois, un thème ou une couleur est tiré au sort. Photographiez tout ce qui correspond, montez votre collage, et votez pour vos participations préférées !</p>
      <a class="btn" href="compte.html">Se connecter / Créer un compte</a>
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

function renderVotingOpen(cycle) {
  content.innerHTML = `
    <div class="card">
      <h1>${cycle.promptText} ${difficultyBadge(cycle.difficulty)}</h1>
      <p>Les soumissions sont closes, place au vote !</p>
      <a class="btn" href="vote.html">Aller voter</a>
    </div>
  `;
}

async function renderSubmissionOpen(cycle) {
  const { submission } = await api.get('/api/submissions/mine');
  const photoUrls = submission?.photoUrls || [];
  const complete = photoUrls.length >= cycle.minPhotos;
  const pct = Math.min(100, Math.round((photoUrls.length / cycle.minPhotos) * 100));

  content.innerHTML = `
    <div class="card">
      <h1>${cycle.promptText} ${difficultyBadge(cycle.difficulty)}</h1>
      <p class="muted">Soumissions ouvertes jusqu'au ${formatDate(cycle.submissionEnd)}</p>
      <p><span class="counter">${photoUrls.length} / ${cycle.minPhotos}</span> ${complete ? ' — pellicule complète !' : ''}</p>
      <div class="progress-bar"><div style="width:${pct}%"></div></div>

      <label for="photo-input">Ajouter des photos</label>
      <input id="photo-input" type="file" accept="image/*" capture="environment" multiple />
      <p class="error" id="upload-error"></p>
      <button id="upload-btn">Envoyer</button>

      <div class="photo-grid" id="photo-grid">
        ${photoUrls.map((u) => `<figure><img src="${u}" loading="lazy" /></figure>`).join('')}
      </div>

      <button id="collage-btn" class="secondary" ${photoUrls.length ? '' : 'disabled'}>Générer mon montage</button>
      <p class="muted" id="collage-status"></p>
    </div>
  `;

  document.getElementById('upload-btn').addEventListener('click', async () => {
    const input = document.getElementById('photo-input');
    const errorEl = document.getElementById('upload-error');
    errorEl.textContent = '';
    const files = Array.from(input.files || []);
    if (!files.length) {
      errorEl.textContent = 'Choisissez au moins une photo';
      return;
    }
    const btn = document.getElementById('upload-btn');
    btn.disabled = true;
    btn.textContent = 'Envoi en cours…';
    try {
      const urls = [];
      for (const file of files) {
        urls.push(await uploadPhoto(file));
      }
      await api.post('/api/submissions', { photoUrls: urls });
      await renderSubmissionOpen(cycle);
    } catch (err) {
      errorEl.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Envoyer';
    }
  });

  document.getElementById('collage-btn').addEventListener('click', async () => {
    const status = document.getElementById('collage-status');
    status.textContent = 'Génération du montage…';
    try {
      const canvas = await buildCollage(photoUrls);
      downloadCanvas(canvas, `supersnap-${cycle.promptText}.png`);
      status.textContent = 'Montage téléchargé !';
    } catch (err) {
      status.textContent = err.message;
    }
  });
}

async function init() {
  await initNav('defi');
  if (!getCurrentUser()) {
    renderLoggedOut();
    return;
  }

  try {
    const { cycle, upcoming } = await api.get('/api/cycles/current');
    if (!cycle) {
      renderNoCycle(upcoming);
    } else if (cycle.status === 'voting_open') {
      renderVotingOpen(cycle);
    } else {
      await renderSubmissionOpen(cycle);
    }
  } catch (err) {
    content.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

init();
