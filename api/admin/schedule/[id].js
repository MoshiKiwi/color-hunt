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
  const cycles = db.collection('cycles');

  const cycle = await cycles.findOne({ _id });
  if (!cycle) {
    res.status(404).json({ error: 'Cycle introuvable' });
    return;
  }
  if (cycle.status !== 'pending_approval') {
    res.status(400).json({ error: 'Seul un cycle en attente peut être modifié ou supprimé' });
    return;
  }

  if (req.method === 'PATCH') {
    const { promptText, difficulty, cadence } = req.body || {};
    const update = {};
    if (promptText) update.promptText = String(promptText).trim();
    if (difficulty) {
      if (!MIN_PHOTOS_BY_DIFFICULTY[difficulty]) {
        res.status(400).json({ error: 'difficulty doit être easy, medium ou hard' });
        return;
      }
      update.difficulty = difficulty;
      update.minPhotos = MIN_PHOTOS_BY_DIFFICULTY[difficulty];
    }
    if (cadence) {
      if (!['weekly', 'monthly'].includes(cadence)) {
        res.status(400).json({ error: 'cadence doit être weekly ou monthly' });
        return;
      }
      update.cadence = cadence;
    }
    await cycles.updateOne({ _id }, { $set: update });
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === 'DELETE') {
    await cycles.deleteOne({ _id });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Méthode non autorisée' });
};
