import { api } from './api.js';

let currentUser = null;

export async function initNav(activePage) {
  const mount = document.getElementById('nav');
  if (!mount) return null;

  try {
    const { user } = await api.get('/api/auth/me');
    currentUser = user;
  } catch {
    currentUser = null;
  }

  const links = [
    { href: 'index.html', label: 'Défi en cours', page: 'defi' },
    { href: 'vote.html', label: 'Vote', page: 'vote' },
    { href: 'classement.html', label: 'Classement', page: 'classement' },
  ];
  if (currentUser?.isAdmin) links.push({ href: 'admin.html', label: 'Admin', page: 'admin' });

  const linksHtml = links
    .map((l) => `<a href="${l.href}" class="${l.page === activePage ? 'active' : ''}">${l.label}</a>`)
    .join('');

  const authHtml = currentUser
    ? `<span class="nav-user">${currentUser.username} · ${currentUser.totalPoints} pts</span>
       <button id="logout-btn" class="link-btn">Se déconnecter</button>`
    : `<a href="compte.html" class="${activePage === 'compte' ? 'active' : ''}">Se connecter</a>`;

  mount.innerHTML = `
    <nav class="topnav">
      <span class="brand">SuperSnap</span>
      <div class="nav-links">${linksHtml}</div>
      <div class="nav-auth">${authHtml}</div>
    </nav>
  `;

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await api.post('/api/auth/logout');
      window.location.href = 'compte.html';
    });
  }

  return currentUser;
}

export function getCurrentUser() {
  return currentUser;
}
