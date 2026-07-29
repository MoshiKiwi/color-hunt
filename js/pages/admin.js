import { api } from '../api.js';
import { initNav } from '../nav.js';
import { difficultyBadge, CADENCE_LABELS } from '../labels.js';

const content = document.getElementById('content');

function difficultyOptions(selected) {
  return ['easy', 'medium', 'hard']
    .map((d) => `<option value="${d}" ${d === selected ? 'selected' : ''}>${d}</option>`)
    .join('');
}

function cadenceOptions(selected) {
  return Object.keys(CADENCE_LABELS)
    .map((c) => `<option value="${c}" ${c === selected ? 'selected' : ''}>${CADENCE_LABELS[c]}</option>`)
    .join('');
}

async function loadModeration() {
  const { items } = await api.get('/api/admin/moderation');
  const el = document.getElementById('moderation-list');
  el.innerHTML = items.length ? '' : '<p class="muted">Rien à modérer pour le moment.</p>';

  items.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'submission-card';
    div.innerHTML = `
      <p><strong>${item.username}</strong> — ${item.cyclePromptText}</p>
      <img class="moderation-thumb" src="${item.url}" loading="lazy" />
      <button class="approve-photo">Approuver</button>
      <button class="ghost reject-photo">Rejeter</button>
    `;

    div.querySelector('.approve-photo').addEventListener('click', async () => {
      await api.post('/api/admin/moderation', { submissionId: item.submissionId, url: item.url, decision: 'approve' });
      await loadModeration();
    });
    div.querySelector('.reject-photo').addEventListener('click', async () => {
      await api.post('/api/admin/moderation', { submissionId: item.submissionId, url: item.url, decision: 'reject' });
      await loadModeration();
    });

    el.appendChild(div);
  });
}

async function loadPrompts() {
  const { prompts } = await api.get('/api/admin/prompts');
  const el = document.getElementById('prompt-list');
  el.innerHTML = prompts.length
    ? prompts
        .map(
          (p) => `
      <div class="submission-card" data-id="${p._id}">
        <p>${p.text} ${difficultyBadge(p.difficulty)} ${p.lastUsedAt ? '<span class="muted">déjà utilisé</span>' : ''}</p>
        <button class="ghost delete-prompt" data-id="${p._id}">Supprimer</button>
      </div>`
        )
        .join('')
    : '<p class="muted">Aucun prompt dans la réserve.</p>';

  el.querySelectorAll('.delete-prompt').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api.del(`/api/admin/prompts/${btn.dataset.id}`);
      await loadPrompts();
    });
  });
}

async function loadPending() {
  const { cycles } = await api.get('/api/admin/schedule/pending');
  const el = document.getElementById('pending-list');
  el.innerHTML = cycles.length ? '' : '<p class="muted">Aucun cycle en attente ou programmé.</p>';

  cycles.forEach((c) => {
    const div = document.createElement('div');
    div.className = 'submission-card';
    if (c.status === 'pending_approval') {
      div.innerHTML = `
        <p><strong>En attente d'approbation</strong></p>
        <label>Prompt</label>
        <input class="edit-text" value="${c.promptText}" />
        <label>Difficulté</label>
        <select class="edit-difficulty">${difficultyOptions(c.difficulty)}</select>
        <label>Cadence</label>
        <select class="edit-cadence">${cadenceOptions(c.cadence)}</select>
        <button class="secondary save-edit">Enregistrer les modifications</button>
        <label>Date de début</label>
        <input class="start-at" type="datetime-local" />
        <button class="approve">Approuver et programmer</button>
        <button class="ghost discard">Supprimer ce brouillon</button>
        <p class="error edit-error"></p>
      `;

      div.querySelector('.save-edit').addEventListener('click', async () => {
        try {
          await api.patch(`/api/admin/schedule/${c._id}`, {
            promptText: div.querySelector('.edit-text').value,
            difficulty: div.querySelector('.edit-difficulty').value,
            cadence: div.querySelector('.edit-cadence').value,
          });
          await loadPending();
        } catch (err) {
          div.querySelector('.edit-error').textContent = err.message;
        }
      });

      div.querySelector('.approve').addEventListener('click', async () => {
        const startAtInput = div.querySelector('.start-at').value;
        try {
          await api.post(`/api/admin/schedule/${c._id}`, {
            startAt: startAtInput ? new Date(startAtInput).toISOString() : undefined,
          });
          await loadPending();
        } catch (err) {
          div.querySelector('.edit-error').textContent = err.message;
        }
      });

      div.querySelector('.discard').addEventListener('click', async () => {
        await api.del(`/api/admin/schedule/${c._id}`);
        await loadPending();
      });
    } else {
      div.innerHTML = `
        <p><strong>Programmé</strong> — ${c.promptText} ${difficultyBadge(c.difficulty)}</p>
        <p class="muted">Du ${new Date(c.submissionStart).toLocaleString('fr-FR')} au ${new Date(c.submissionEnd).toLocaleString('fr-FR')} (vote jusqu'au ${new Date(c.votingEnd).toLocaleString('fr-FR')})</p>
      `;
    }
    el.appendChild(div);
  });
}

function renderLayout() {
  content.innerHTML = `
    <div class="card">
      <h1>Photos à modérer</h1>
      <div id="moderation-list">Chargement…</div>
    </div>

    <div class="card">
      <h1>Ajouter un prompt à la réserve</h1>
      <label for="new-prompt-text">Texte (couleur ou thème)</label>
      <input id="new-prompt-text" placeholder="ex : rouge, des ombres, quelque chose de rond…" />
      <label for="new-prompt-difficulty">Difficulté</label>
      <select id="new-prompt-difficulty">${difficultyOptions('easy')}</select>
      <p class="error" id="new-prompt-error"></p>
      <button id="add-prompt">Ajouter</button>
    </div>

    <div class="card">
      <h2>Réserve de prompts</h2>
      <div id="prompt-list">Chargement…</div>
    </div>

    <div class="card">
      <h1>Générer des cycles à venir</h1>
      <label for="gen-count">Nombre de cycles</label>
      <input id="gen-count" type="number" min="1" max="12" value="1" />
      <label for="gen-cadence">Cadence</label>
      <select id="gen-cadence">${cadenceOptions('weekly')}</select>
      <p class="error" id="gen-error"></p>
      <button id="generate-btn">Générer des brouillons</button>
    </div>

    <div class="card">
      <h2>Cycles en attente / programmés</h2>
      <div id="pending-list">Chargement…</div>
    </div>
  `;

  document.getElementById('add-prompt').addEventListener('click', async () => {
    const errorEl = document.getElementById('new-prompt-error');
    errorEl.textContent = '';
    try {
      await api.post('/api/admin/prompts', {
        text: document.getElementById('new-prompt-text').value,
        difficulty: document.getElementById('new-prompt-difficulty').value,
      });
      document.getElementById('new-prompt-text').value = '';
      await loadPrompts();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  document.getElementById('generate-btn').addEventListener('click', async () => {
    const errorEl = document.getElementById('gen-error');
    errorEl.textContent = '';
    try {
      await api.post('/api/admin/schedule/generate', {
        count: Number(document.getElementById('gen-count').value),
        cadence: document.getElementById('gen-cadence').value,
      });
      await loadPending();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

async function init() {
  const user = await initNav('admin');
  if (!user || !user.isAdmin) {
    content.innerHTML = '<div class="card"><h1>Accès refusé</h1><p class="muted">Cette page est réservée aux administrateurs.</p></div>';
    return;
  }
  renderLayout();
  await Promise.all([loadModeration(), loadPrompts(), loadPending()]);
}

init();
