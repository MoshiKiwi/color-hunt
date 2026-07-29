const { ObjectId } = require('mongodb');
const { getDb } = require('./_lib/db');
const { requireAuth } = require('./_lib/auth');

const WEIGHTS_BY_RANK = [3, 2, 1];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  const session = requireAuth(req, res);
  if (!session) return;

  const { cycleId, submissionIds } = req.body || {};
  if (!cycleId || !ObjectId.isValid(cycleId) || !Array.isArray(submissionIds) || submissionIds.length === 0 || submissionIds.length > 3) {
    res.status(400).json({ error: 'cycleId et 1 à 3 submissionIds requis' });
    return;
  }
  if (!submissionIds.every((id) => ObjectId.isValid(id))) {
    res.status(400).json({ error: 'Identifiant de participation invalide' });
    return;
  }
  if (new Set(submissionIds).size !== submissionIds.length) {
    res.status(400).json({ error: 'Chaque favori doit être différent' });
    return;
  }

  const db = await getDb();
  const cycle = await db.collection('cycles').findOne({ _id: new ObjectId(cycleId) });
  if (!cycle || cycle.status !== 'voting_open') {
    res.status(400).json({ error: "Le vote n'est pas ouvert pour ce défi" });
    return;
  }

  const userId = new ObjectId(session.userId);
  const submissions = await db
    .collection('submissions')
    .find({ _id: { $in: submissionIds.map((id) => new ObjectId(id)) }, cycleId: cycle._id })
    .toArray();

  if (submissions.length !== submissionIds.length) {
    res.status(400).json({ error: 'Une ou plusieurs participations sont introuvables' });
    return;
  }
  if (submissions.some((s) => s.userId.toString() === session.userId)) {
    res.status(400).json({ error: 'Vous ne pouvez pas voter pour votre propre participation' });
    return;
  }

  const votes = db.collection('votes');
  await votes.deleteMany({ cycleId: cycle._id, voterId: userId });
  await votes.insertMany(
    submissionIds.map((submissionId, index) => ({
      cycleId: cycle._id,
      voterId: userId,
      submissionId: new ObjectId(submissionId),
      weight: WEIGHTS_BY_RANK[index],
      createdAt: new Date(),
    }))
  );

  res.status(200).json({ ok: true });
};
