const { ObjectId } = require('mongodb');
const { getDb } = require('../../_lib/db');
const { requireAuth } = require('../../_lib/auth');

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  const session = requireAuth(req, res);
  if (!session) return;

  const { id } = req.query;
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Identifiant de cycle invalide' });
    return;
  }

  const db = await getDb();
  const cycle = await db.collection('cycles').findOne({ _id: new ObjectId(id) });
  if (!cycle) {
    res.status(404).json({ error: 'Cycle introuvable' });
    return;
  }

  if (!['voting_open', 'completed'].includes(cycle.status)) {
    res.status(403).json({ error: "Les participations ne sont pas encore visibles" });
    return;
  }

  const submissions = await db
    .collection('submissions')
    .find({ cycleId: cycle._id, $expr: { $gte: [{ $size: '$photoUrls' }, cycle.minPhotos] } })
    .toArray();

  const visible = submissions
    .filter((s) => cycle.status === 'completed' || s.userId.toString() !== session.userId)
    .map((s) => ({
      id: s._id,
      username: s.username,
      photoUrls: s.photoUrls,
      isOwn: s.userId.toString() === session.userId,
    }));

  res.status(200).json({
    cycle: { id: cycle._id, promptText: cycle.promptText, difficulty: cycle.difficulty, minPhotos: cycle.minPhotos, status: cycle.status },
    submissions: cycle.status === 'voting_open' ? shuffle(visible) : visible,
  });
};
