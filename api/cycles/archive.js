const { getDb } = require('../_lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  const db = await getDb();
  const cycles = await db
    .collection('cycles')
    .find({ status: 'completed' })
    .sort({ submissionStart: -1 })
    .limit(50)
    .toArray();

  res.status(200).json({ cycles });
};
