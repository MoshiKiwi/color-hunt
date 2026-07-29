const { getDb } = require('../_lib/db');
const { verifyPassword, signSession, setSessionCookie } = require('../_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email et mot de passe requis' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const db = await getDb();
  const user = await db.collection('users').findOne({ email: normalizedEmail });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    return;
  }

  const token = signSession(user);
  setSessionCookie(res, token);

  res.status(200).json({
    user: { id: user._id, email: user.email, username: user.username, isAdmin: user.isAdmin, totalPoints: user.totalPoints },
  });
};
