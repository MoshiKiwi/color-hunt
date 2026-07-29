const { ObjectId } = require('mongodb');
const { getDb } = require('../../_lib/db');
const { requireAdmin } = require('../../_lib/auth');
const { MIN_PHOTOS_BY_DIFFICULTY, CYCLE_DURATION_DAYS, VOTING_WINDOW_DAYS } = require('../../_lib/difficulty');
const { pathSegments } = require('../../_lib/path');

const DAY_MS = 24 * 60 * 60 * 1000;

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function generate(req, res, db) {
  const { count = 1, cadence = 'weekly' } = req.body || {};
  if (!['weekly', 'monthly'].includes(cadence)) {
    res.status(400).json({ error: 'cadence doit être weekly ou monthly' });
    return;
  }
  const n = Math.max(1, Math.min(12, Number(count) || 1));

  const cyclesCol = db.collection('cycles');
  const promptsCol = db.collection('promptPool');

  const alreadyQueued = await cyclesCol
    .find({ status: { $in: ['pending_approval', 'scheduled', 'submission_open', 'voting_open'] } })
    .project({ promptPoolId: 1 })
    .toArray();
  const excludedIds = new Set(alreadyQueued.map((c) => c.promptPoolId && c.promptPoolId.toString()));

  const pool = await promptsCol.find({}).sort({ lastUsedAt: 1 }).toArray();
  const eligible = shuffle(pool.filter((p) => !excludedIds.has(p._id.toString())));

  if (eligible.length < n) {
    res.status(400).json({
      error: `Pas assez de prompts disponibles dans la réserve (${eligible.length} dispo, ${n} demandés). Ajoutez des prompts.`,
    });
    return;
  }

  const drafts = eligible.slice(0, n).map((prompt) => ({
    status: 'pending_approval',
    promptPoolId: prompt._id,
    promptText: prompt.text,
    difficulty: prompt.difficulty,
    minPhotos: MIN_PHOTOS_BY_DIFFICULTY[prompt.difficulty],
    cadence,
    submissionStart: null,
    submissionEnd: null,
    votingEnd: null,
    createdAt: new Date(),
  }));

  const result = await cyclesCol.insertMany(drafts);
  res.status(201).json({ createdCount: result.insertedCount });
}

async function pending(req, res, db) {
  const cycles = await db
    .collection('cycles')
    .find({ status: { $in: ['pending_approval', 'scheduled'] } })
    .sort({ createdAt: 1 })
    .toArray();
  res.status(200).json({ cycles });
}

async function loadEditableCycle(res, db, id) {
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Identifiant invalide' });
    return null;
  }
  const cycle = await db.collection('cycles').findOne({ _id: new ObjectId(id) });
  if (!cycle) {
    res.status(404).json({ error: 'Cycle introuvable' });
    return null;
  }
  if (cycle.status !== 'pending_approval') {
    res.status(400).json({ error: 'Seul un cycle en attente peut être modifié, supprimé ou approuvé' });
    return null;
  }
  return cycle;
}

async function update(req, res, db, id) {
  const cycle = await loadEditableCycle(res, db, id);
  if (!cycle) return;

  const { promptText, difficulty, cadence } = req.body || {};
  const patch = {};
  if (promptText) patch.promptText = String(promptText).trim();
  if (difficulty) {
    if (!MIN_PHOTOS_BY_DIFFICULTY[difficulty]) {
      res.status(400).json({ error: 'difficulty doit être easy, medium ou hard' });
      return;
    }
    patch.difficulty = difficulty;
    patch.minPhotos = MIN_PHOTOS_BY_DIFFICULTY[difficulty];
  }
  if (cadence) {
    if (!['weekly', 'monthly'].includes(cadence)) {
      res.status(400).json({ error: 'cadence doit être weekly ou monthly' });
      return;
    }
    patch.cadence = cadence;
  }
  await db.collection('cycles').updateOne({ _id: cycle._id }, { $set: patch });
  res.status(200).json({ ok: true });
}

async function discard(req, res, db, id) {
  const cycle = await loadEditableCycle(res, db, id);
  if (!cycle) return;
  await db.collection('cycles').deleteOne({ _id: cycle._id });
  res.status(200).json({ ok: true });
}

async function approve(req, res, db, id) {
  const cycle = await loadEditableCycle(res, db, id);
  if (!cycle) return;

  const { startAt } = req.body || {};
  const submissionStart = startAt ? new Date(startAt) : new Date();
  if (Number.isNaN(submissionStart.getTime())) {
    res.status(400).json({ error: 'startAt invalide' });
    return;
  }

  const durationDays = CYCLE_DURATION_DAYS[cycle.cadence] || CYCLE_DURATION_DAYS.weekly;
  const submissionEnd = new Date(submissionStart.getTime() + durationDays * DAY_MS);
  const votingEnd = new Date(submissionEnd.getTime() + VOTING_WINDOW_DAYS * DAY_MS);

  await db
    .collection('cycles')
    .updateOne({ _id: cycle._id }, { $set: { status: 'scheduled', submissionStart, submissionEnd, votingEnd } });

  if (cycle.promptPoolId) {
    await db.collection('promptPool').updateOne({ _id: cycle.promptPoolId }, { $set: { lastUsedAt: new Date() } });
  }

  res.status(200).json({ ok: true, submissionStart, submissionEnd, votingEnd });
}

module.exports = async (req, res) => {
  const db = await getDb();
  const admin = await requireAdmin(req, res, db);
  if (!admin) return;

  const path = pathSegments(req, '/api/admin/schedule');

  if (path.length === 1 && path[0] === 'generate' && req.method === 'POST') return generate(req, res, db);
  if (path.length === 1 && path[0] === 'pending' && req.method === 'GET') return pending(req, res, db);
  if (path.length === 1 && req.method === 'PATCH') return update(req, res, db, path[0]);
  if (path.length === 1 && req.method === 'DELETE') return discard(req, res, db, path[0]);
  if (path.length === 2 && path[1] === 'approve' && req.method === 'POST') return approve(req, res, db, path[0]);

  res.status(404).json({ error: 'Route inconnue' });
};
