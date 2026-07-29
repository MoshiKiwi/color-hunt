const { ObjectId } = require('mongodb');
const { getDb } = require('../../../_lib/db');
const { requireAdmin } = require('../../../_lib/auth');
const { CYCLE_DURATION_DAYS, VOTING_WINDOW_DAYS } = require('../../../_lib/difficulty');

const DAY_MS = 24 * 60 * 60 * 1000;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

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
    res.status(400).json({ error: 'Ce cycle a déjà été traité' });
    return;
  }

  const { startAt } = req.body || {};
  const submissionStart = startAt ? new Date(startAt) : new Date();
  if (Number.isNaN(submissionStart.getTime())) {
    res.status(400).json({ error: 'startAt invalide' });
    return;
  }

  const durationDays = CYCLE_DURATION_DAYS[cycle.cadence] || CYCLE_DURATION_DAYS.weekly;
  const submissionEnd = new Date(submissionStart.getTime() + durationDays * DAY_MS);
  const votingEnd = new Date(submissionEnd.getTime() + VOTING_WINDOW_DAYS * DAY_MS);

  await cycles.updateOne(
    { _id },
    { $set: { status: 'scheduled', submissionStart, submissionEnd, votingEnd } }
  );

  if (cycle.promptPoolId) {
    await db.collection('promptPool').updateOne({ _id: cycle.promptPoolId }, { $set: { lastUsedAt: new Date() } });
  }

  res.status(200).json({ ok: true, submissionStart, submissionEnd, votingEnd });
};
