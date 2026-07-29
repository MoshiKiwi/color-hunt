const { getDb } = require('../../_lib/db');
const { requireAdmin } = require('../../_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  const db = await getDb();
  const admin = await requireAdmin(req, res, db);
  if (!admin) return;

  const cycles = await db
    .collection('cycles')
    .find({ status: { $in: ['pending_approval', 'scheduled'] } })
    .sort({ createdAt: 1 })
    .toArray();

  res.status(200).json({ cycles });
};
