const { getDb } = require('../../_lib/db');
const { requireAdmin } = require('../../_lib/auth');
const { MIN_PHOTOS_BY_DIFFICULTY } = require('../../_lib/difficulty');

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  const db = await getDb();
  const admin = await requireAdmin(req, res, db);
  if (!admin) return;

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
};
