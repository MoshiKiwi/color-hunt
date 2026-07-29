const { getDb } = require('../_lib/db');
const { hashPassword, signSession, setSessionCookie } = require('../_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

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
  const db = await getDb();
  const users = db.collection('users');

  const existing = await users.findOne({ email: normalizedEmail });
  if (existing) {
    res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = {
    email: normalizedEmail,
    passwordHash,
    username: String(username).trim(),
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
};
