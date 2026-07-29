const { ObjectId } = require('mongodb');
const { getDb } = require('../_lib/db');
const {
  hashPassword,
  verifyPassword,
  signSession,
  setSessionCookie,
  clearSessionCookie,
  getSessionFromRequest,
} = require('../_lib/auth');

async function signup(req, res, db) {
  const { email, password, username } = req.body || {};
  if (!email || !password || !username) {
    res.status(400).json({ error: 'Email, mot de passe et pseudo requis' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const trimmedUsername = String(username).trim();
  const usernameLower = trimmedUsername.toLowerCase();
  const users = db.collection('users');

  const existing = await users.findOne({ $or: [{ email: normalizedEmail }, { usernameLower }] });
  if (existing) {
    res.status(409).json({
      error: existing.email === normalizedEmail ? 'Un compte existe déjà avec cet email' : 'Ce pseudo est déjà pris',
    });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = {
    email: normalizedEmail,
    passwordHash,
    username: trimmedUsername,
    usernameLower,
    isAdmin: false,
    totalPoints: 0,
    createdAt: new Date(),
  };
  const result = await users.insertOne(user);
  user._id = result.insertedId;

  const token = signSession(user);
  setSessionCookie(res, token);

  res.status(201).json({
    user: { id: user._id, email: user.email, username: user.username, isAdmin: user.isAdmin, totalPoints: user.totalPoints },
  });
}

async function login(req, res, db) {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    res.status(400).json({ error: 'Email/pseudo et mot de passe requis' });
    return;
  }

  const normalized = String(identifier).trim().toLowerCase();
  const user = await db.collection('users').findOne({ $or: [{ email: normalized }, { usernameLower: normalized }] });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: 'Identifiants incorrects' });
    return;
  }

  const token = signSession(user);
  setSessionCookie(res, token);

  res.status(200).json({
    user: { id: user._id, email: user.email, username: user.username, isAdmin: user.isAdmin, totalPoints: user.totalPoints },
  });
}

async function logout(req, res) {
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}

async function me(req, res, db) {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(200).json({ user: null });
    return;
  }

  const user = await db.collection('users').findOne({ _id: new ObjectId(session.userId) });
  if (!user) {
    clearSessionCookie(res);
    res.status(200).json({ user: null });
    return;
  }

  res.status(200).json({
    user: { id: user._id, email: user.email, username: user.username, isAdmin: user.isAdmin, totalPoints: user.totalPoints },
  });
}

module.exports = async (req, res) => {
  const { action } = req.query;
  const db = await getDb();

  if (action === 'signup' && req.method === 'POST') return signup(req, res, db);
  if (action === 'login' && req.method === 'POST') return login(req, res, db);
  if (action === 'logout' && req.method === 'POST') return logout(req, res);
  if (action === 'me' && req.method === 'GET') return me(req, res, db);

  res.status(404).json({ error: 'Route inconnue' });
};
