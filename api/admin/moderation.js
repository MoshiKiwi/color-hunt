const { ObjectId } = require('mongodb');
const { getDb } = require('../_lib/db');
const { requireAdmin } = require('../_lib/auth');

async function listPending(req, res, db) {
  const submissions = await db.collection('submissions').find({ 'photos.status': 'pending_review' }).toArray();
  const cycleIds = [...new Set(submissions.map((s) => s.cycleId.toString()))].map((id) => new ObjectId(id));
  const cycles = await db.collection('cycles').find({ _id: { $in: cycleIds } }).toArray();
  const cycleById = new Map(cycles.map((c) => [c._id.toString(), c]));

  const items = submissions.flatMap((s) =>
    s.photos
      .filter((p) => p.status === 'pending_review')
      .map((p) => ({
        submissionId: s._id,
        cyclePromptText: cycleById.get(s.cycleId.toString())?.promptText || '?',
        username: s.username,
        url: p.url,
      }))
  );

  res.status(200).json({ items });
}

async function decide(req, res, db) {
  const { submissionId, url, decision } = req.body || {};
  if (!submissionId || !ObjectId.isValid(submissionId) || !url || !['approve', 'reject'].includes(decision)) {
    res.status(400).json({ error: 'submissionId, url et decision (approve|reject) requis' });
    return;
  }

  const status = decision === 'approve' ? 'approved' : 'rejected';
  const result = await db
    .collection('submissions')
    .updateOne({ _id: new ObjectId(submissionId), 'photos.url': url }, { $set: { 'photos.$.status': status } });

  if (result.matchedCount === 0) {
    res.status(404).json({ error: 'Photo introuvable' });
    return;
  }
  res.status(200).json({ ok: true });
}

module.exports = async (req, res) => {
  const db = await getDb();
  const admin = await requireAdmin(req, res, db);
  if (!admin) return;

  if (req.method === 'GET') return listPending(req, res, db);
  if (req.method === 'POST') return decide(req, res, db);

  res.status(405).json({ error: 'Méthode non autorisée' });
};
