const { ObjectId } = require('mongodb');
const { getDb } = require('../_lib/db');
const { requireAuth } = require('../_lib/auth');
const { pathSegments } = require('../_lib/path');

async function create(req, res, db, session) {
  const { photoUrls } = req.body || {};
  if (!Array.isArray(photoUrls) || photoUrls.length === 0 || !photoUrls.every((u) => typeof u === 'string' && u)) {
    res.status(400).json({ error: 'photoUrls doit être un tableau de liens non vide' });
    return;
  }

  const cycle = await db.collection('cycles').findOne({ status: 'submission_open' });
  if (!cycle) {
    res.status(400).json({ error: "Aucun défi n'est ouvert aux soumissions en ce moment" });
    return;
  }

  const now = new Date();
  const userId = new ObjectId(session.userId);
  const result = await db.collection('submissions').findOneAndUpdate(
    { cycleId: cycle._id, userId },
    {
      $setOnInsert: { cycleId: cycle._id, userId, username: session.username, submittedAt: now },
      $push: { photoUrls: { $each: photoUrls } },
    },
    { upsert: true, returnDocument: 'after' }
  );

  const submission = result.value || result;
  res.status(200).json({
    submission: { id: submission._id, photoUrls: submission.photoUrls },
    minPhotos: cycle.minPhotos,
    complete: submission.photoUrls.length >= cycle.minPhotos,
  });
}

async function mine(req, res, db, session) {
  const cycle = await db.collection('cycles').findOne({ status: { $in: ['submission_open', 'voting_open'] } });
  if (!cycle) {
    res.status(200).json({ cycle: null, submission: null });
    return;
  }

  const submission = await db
    .collection('submissions')
    .findOne({ cycleId: cycle._id, userId: new ObjectId(session.userId) });

  res.status(200).json({
    cycle: { id: cycle._id, promptText: cycle.promptText, difficulty: cycle.difficulty, minPhotos: cycle.minPhotos, status: cycle.status, submissionEnd: cycle.submissionEnd },
    submission: submission ? { id: submission._id, photoUrls: submission.photoUrls } : null,
  });
}

module.exports = async (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;

  const db = await getDb();
  const path = pathSegments(req, '/api/submissions');

  if (req.method === 'POST' && path.length === 0) return create(req, res, db, session);
  if (req.method === 'GET' && path[0] === 'mine') return mine(req, res, db, session);

  res.status(404).json({ error: 'Route inconnue' });
};
