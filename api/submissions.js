const { ObjectId } = require('mongodb');
const { getDb } = require('./_lib/db');
const { requireAuth } = require('./_lib/auth');

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

// Removes one photo from the caller's own submission. Only allowed while
// submissions are still open, so nobody can pull a photo out from under
// an already-published vote. This only forgets the URL on our side - the
// underlying Cloudinary asset isn't deleted (that needs a signed request
// with the API secret, which this app deliberately never holds server-side).
async function removePhoto(req, res, db, session) {
  const { photoUrl } = req.body || {};
  if (!photoUrl) {
    res.status(400).json({ error: 'photoUrl requis' });
    return;
  }

  const cycle = await db.collection('cycles').findOne({ status: 'submission_open' });
  if (!cycle) {
    res.status(400).json({ error: "Aucun défi n'est ouvert aux soumissions en ce moment" });
    return;
  }

  const userId = new ObjectId(session.userId);
  const result = await db
    .collection('submissions')
    .findOneAndUpdate(
      { cycleId: cycle._id, userId },
      { $pull: { photoUrls: photoUrl } },
      { returnDocument: 'after' }
    );

  const submission = result.value || result;
  res.status(200).json({ submission: submission ? { id: submission._id, photoUrls: submission.photoUrls } : null });
}

module.exports = async (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;

  const db = await getDb();

  if (req.method === 'POST') return create(req, res, db, session);
  if (req.method === 'DELETE') return removePhoto(req, res, db, session);

  res.status(405).json({ error: 'Méthode non autorisée' });
};
