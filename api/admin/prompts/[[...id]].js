const { ObjectId } = require('mongodb');
const { getDb } = require('../../_lib/db');
const { requireAdmin } = require('../../_lib/auth');
const { MIN_PHOTOS_BY_DIFFICULTY } = require('../../_lib/difficulty');
const { pathSegments } = require('../../_lib/path');

async function update(req, res, db, id) {
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Identifiant invalide' });
    return;
  }
  const { text, difficulty } = req.body || {};
  const patch = {};
  if (text) patch.text = String(text).trim();
  if (difficulty) {
    if (!MIN_PHOTOS_BY_DIFFICULTY[difficulty]) {
      res.status(400).json({ error: 'difficulty doit être easy, medium ou hard' });
      return;
    }
    patch.difficulty = difficulty;
  }
  await db.collection('promptPool').updateOne({ _id: new ObjectId(id) }, { $set: patch });
  res.status(200).json({ ok: true });
}

async function remove(req, res, db, id) {
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Identifiant invalide' });
    return;
  }
  await db.collection('promptPool').deleteOne({ _id: new ObjectId(id) });
  res.status(200).json({ ok: true });
}

module.exports = async (req, res) => {
  const db = await getDb();
  const admin = await requireAdmin(req, res, db);
  if (!admin) return;

  const [id] = pathSegments(req, '/api/admin/prompts');
  if (!id) {
    res.status(404).json({ error: 'Route inconnue' });
    return;
  }

  if (req.method === 'PATCH') return update(req, res, db, id);
  if (req.method === 'DELETE') return remove(req, res, db, id);

  res.status(404).json({ error: 'Route inconnue' });
};
