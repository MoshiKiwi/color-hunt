import { api } from '../api.js';
import { initNav, getCurrentUser } from '../nav.js';

async function init() {
  await initNav('compte');
  if (getCurrentUser()) {
    document.getElementById('already-logged').style.display = 'block';
    document.getElementById('forms').style.display = 'none';
    return;
  }

  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  document.getElementById('tab-login').addEventListener('click', () => {
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
  });
  document.getElementById('tab-signup').addEventListener('click', () => {
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';
    try {
      await api.post('/api/auth/login', {
        identifier: document.getElementById('login-identifier').value,
        password: document.getElementById('login-password').value,
      });
      window.location.href = 'index.html';
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('signup-error');
    errorEl.textContent = '';
    try {
      await api.post('/api/auth/signup', {
        username: document.getElementById('signup-username').value,
        email: document.getElementById('signup-email').value,
        password: document.getElementById('signup-password').value,
      });
      window.location.href = 'index.html';
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

init();
