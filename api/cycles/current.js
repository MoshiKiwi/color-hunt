const { getDb } = require('../_lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  const db = await getDb();
  const cycles = db.collection('cycles');

  const active = await cycles.findOne(
    { status: { $in: ['submission_open', 'voting_open'] } },
    { sort: { submissionStart: -1 } }
  );

  if (active) {
    res.status(200).json({ cycle: active });
    return;
  }

  const upcoming = await cycles.findOne(
    { status: 'scheduled' },
    { sort: { submissionStart: 1 }, projection: { promptText: 0, difficulty: 0 } }
  );

  res.status(200).json({ cycle: null, upcoming: upcoming || null });
};
