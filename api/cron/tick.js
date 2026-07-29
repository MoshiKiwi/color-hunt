const { getDb } = require('../_lib/db');
const { advanceCycles } = require('../_lib/cycleEngine');

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured: allow (local/dev convenience)
  return req.headers.authorization === `Bearer ${secret}`;
}

module.exports = async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Non autorisé' });
    return;
  }

  const db = await getDb();
  const result = await advanceCycles(db);
  res.status(200).json({ ok: true, ...result });
};
