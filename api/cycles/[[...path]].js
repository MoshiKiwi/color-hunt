const { ObjectId } = require('mongodb');
const { getDb } = require('../_lib/db');
const { requireAuth } = require('../_lib/auth');
const { pathSegments } = require('../_lib/path');

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function current(req, res, db) {
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
}

async function archive(req, res, db) {
  const cycles = await db
    .collection('cycles')
    .find({ status: 'completed' })
    .sort({ submissionStart: -1 })
    .limit(50)
    .toArray();
  res.status(200).json({ cycles });
}

async function submissionsForCycle(req, res, db, id) {
  const session = requireAuth(req, res);
  if (!session) return;

  if (!ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Identifiant de cycle invalide' });
    return;
  }

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
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  const db = await getDb();
  const path = pathSegments(req, '/api/cycles');

  if (path.length === 0 || path[0] === 'current') return current(req, res, db);
  if (path[0] === 'archive') return archive(req, res, db);
  if (path.length === 2 && path[1] === 'submissions') return submissionsForCycle(req, res, db, path[0]);

  res.status(404).json({ error: 'Route inconnue' });
};
