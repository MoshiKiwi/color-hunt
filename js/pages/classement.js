import { api } from '../api.js';
import { initNav } from '../nav.js';
import { difficultyBadge, formatDate } from '../labels.js';

async function renderLeaderboard() {
  const el = document.getElementById('leaderboard');
  const { users } = await api.get('/api/leaderboard');
  if (!users.length) {
    el.innerHTML = '<p class="muted">Personne au classement pour le moment.</p>';
    return;
  }
  el.innerHTML = `
    <table>
      <thead><tr><th>#</th><th>Joueur</th><th>Points</th></tr></thead>
      <tbody>
        ${users.map((u, i) => `<tr><td>${i + 1}</td><td>${u.username}</td><td>${u.totalPoints}</td></tr>`).join('')}
      </tbody>
    </table>
  `;
}

async function renderArchive() {
  const el = document.getElementById('archive');
  const { cycles } = await api.get('/api/cycles/archive');
  if (!cycles.length) {
    el.innerHTML = '<p class="muted">Aucun défi terminé pour le moment.</p>';
    return;
  }
  el.innerHTML = cycles
    .map((c) => {
      const winners = (c.winners || []).map((w) => w.username).join(', ') || 'Aucun vote reçu';
      return `
      <div class="submission-card">
        <h3>${c.promptText} ${difficultyBadge(c.difficulty)}</h3>
        <p class="muted">${formatDate(c.submissionStart)} → ${formatDate(c.votingEnd)}</p>
        <p>🏆 Gagnant(e)(s) : <strong>${winners}</strong></p>
      </div>`;
    })
    .join('');
}

async function init() {
  await initNav('classement');
  await Promise.all([renderLeaderboard(), renderArchive()]);
}

init();
