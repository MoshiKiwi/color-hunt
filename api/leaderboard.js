const { getDb } = require('./_lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  const db = await getDb();
  const users = await db
    .collection('users')
    .find({}, { projection: { username: 1, totalPoints: 1 } })
    .sort({ totalPoints: -1 })
    .limit(100)
    .toArray();

  res.status(200).json({ users: users.map((u) => ({ username: u.username, totalPoints: u.totalPoints })) });
};
