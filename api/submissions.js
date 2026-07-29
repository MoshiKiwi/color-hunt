const { ObjectId } = require('mongodb');
const { getDb } = require('./_lib/db');
const { requireAuth } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  const session = requireAuth(req, res);
  if (!session) return;

  const { photoUrls } = req.body || {};
  if (!Array.isArray(photoUrls) || photoUrls.length === 0 || !photoUrls.every((u) => typeof u === 'string' && u)) {
    res.status(400).json({ error: 'photoUrls doit être un tableau de liens non vide' });
    return;
  }

  const db = await getDb();
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
};
