const { getDb } = require('../_lib/db');
const { requireAdmin } = require('../_lib/auth');
const { MIN_PHOTOS_BY_DIFFICULTY } = require('../_lib/difficulty');

async function list(req, res, db) {
  const prompts = await db.collection('promptPool').find({}).sort({ lastUsedAt: 1 }).toArray();
  res.status(200).json({ prompts });
}

async function create(req, res, db) {
  const { text, difficulty } = req.body || {};
  if (!text || !MIN_PHOTOS_BY_DIFFICULTY[difficulty]) {
    res.status(400).json({ error: 'text et difficulty (easy|medium|hard) requis' });
    return;
  }
  const prompt = { text: String(text).trim(), difficulty, lastUsedAt: null, createdAt: new Date() };
  const result = await db.collection('promptPool').insertOne(prompt);
  res.status(201).json({ prompt: { ...prompt, _id: result.insertedId } });
}

module.exports = async (req, res) => {
  const db = await getDb();
  const admin = await requireAdmin(req, res, db);
  if (!admin) return;

  if (req.method === 'GET') return list(req, res, db);
  if (req.method === 'POST') return create(req, res, db);

  res.status(404).json({ error: 'Route inconnue' });
};
