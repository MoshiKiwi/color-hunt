import { api } from '../api.js';
import { initNav, getCurrentUser } from '../nav.js';
import { difficultyBadge } from '../labels.js';
import { initLightbox } from '../lightbox.js';

const content = document.getElementById('content');
let selected = []; // ordered submission ids, rank = index + 1

function renderMessage(html) {
  content.innerHTML = `<div class="card">${html}</div>`;
}

function toggleSelect(id) {
  const idx = selected.indexOf(id);
  if (idx !== -1) {
    selected.splice(idx, 1);
  } else if (selected.length < 3) {
    selected.push(id);
  }
}

function render(cycle, submissions) {
  content.innerHTML = `
    <div class="card">
      <h1>${cycle.promptText} ${difficultyBadge(cycle.difficulty)}</h1>
      <p class="muted">Choisissez jusqu'à 3 favoris, dans l'ordre (1er = 3 points, 2e = 2 points, 3e = 1 point).</p>
      <p class="error" id="vote-error"></p>
      <button id="vote-submit" ${selected.length ? '' : 'disabled'}>Envoyer mon vote</button>
    </div>
    <div id="submissions"></div>
  `;

  const list = document.getElementById('submissions');
  list.innerHTML = submissions
    .map((s) => {
      const rank = selected.indexOf(s.id) + 1;
      return `
      <div class="submission-card ${rank > 0 ? 'selected' : ''}" data-id="${s.id}">
        <p><strong>${s.username}</strong> ${rank > 0 ? `— #${rank} favori` : ''}</p>
        <div class="photo-grid">${s.photoUrls.map((u) => `<figure><img src="${u}" loading="lazy" /></figure>`).join('')}</div>
      </div>`;
    })
    .join('');

  list.querySelectorAll('.submission-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('img')) return; // let the lightbox handle photo clicks instead of toggling the vote
      toggleSelect(card.dataset.id);
      render(cycle, submissions);
    });
  });

  document.getElementById('vote-submit').addEventListener('click', async () => {
    const errorEl = document.getElementById('vote-error');
    errorEl.textContent = '';
    try {
      await api.post('/api/votes', { cycleId: cycle.id, submissionIds: selected });
      renderMessage('<h1>Merci pour votre vote !</h1><p>Les résultats seront annoncés à la clôture du vote.</p>');
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

async function init() {
  await initNav('vote');
  initLightbox();
  if (!getCurrentUser()) {
    renderMessage('<h1>Vote</h1><p>Connectez-vous pour voter.</p><a class="btn" href="compte.html">Se connecter</a>');
    return;
  }

  try {
    const { cycle } = await api.get('/api/cycles/current');
    if (!cycle || cycle.status !== 'voting_open') {
      renderMessage("<h1>Le vote n'est pas encore ouvert</h1><p class=\"muted\">Revenez une fois la période de soumission terminée.</p>");
      return;
    }
    const { cycle: cycleDetails, submissions } = await api.get(`/api/cycles/${cycle._id}`);
    if (!submissions.length) {
      renderMessage('<h1>Aucune participation à évaluer</h1>');
      return;
    }
    render(cycleDetails, submissions);
  } catch (err) {
    renderMessage(`<p class="error">${err.message}</p>`);
  }
}

init();
