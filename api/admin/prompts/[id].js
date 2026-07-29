const { ObjectId } = require('mongodb');
const { getDb } = require('../../_lib/db');
const { requireAdmin } = require('../../_lib/auth');
const { MIN_PHOTOS_BY_DIFFICULTY } = require('../../_lib/difficulty');

module.exports = async (req, res) => {
  const db = await getDb();
  const admin = await requireAdmin(req, res, db);
  if (!admin) return;

  const { id } = req.query;
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Identifiant invalide' });
    return;
  }
  const _id = new ObjectId(id);

  if (req.method === 'PATCH') {
    const { text, difficulty } = req.body || {};
    const update = {};
    if (text) update.text = String(text).trim();
    if (difficulty) {
      if (!MIN_PHOTOS_BY_DIFFICULTY[difficulty]) {
        res.status(400).json({ error: 'difficulty doit être easy, medium ou hard' });
        return;
      }
      update.difficulty = difficulty;
    }
    await db.collection('promptPool').updateOne({ _id }, { $set: update });
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === 'DELETE') {
    await db.collection('promptPool').deleteOne({ _id });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Méthode non autorisée' });
};
