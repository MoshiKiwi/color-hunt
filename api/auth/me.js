const { ObjectId } = require('mongodb');
const { getDb } = require('../_lib/db');
const { getSessionFromRequest, clearSessionCookie } = require('../_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(200).json({ user: null });
    return;
  }

  const db = await getDb();
  const user = await db.collection('users').findOne({ _id: new ObjectId(session.userId) });
  if (!user) {
    clearSessionCookie(res);
    res.status(200).json({ user: null });
    return;
  }

  res.status(200).json({
    user: { id: user._id, email: user.email, username: user.username, isAdmin: user.isAdmin, totalPoints: user.totalPoints },
  });
};
