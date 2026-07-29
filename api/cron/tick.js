const { getDb } = require('../_lib/db');
const { POINTS } = require('../_lib/difficulty');

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured: allow (local/dev convenience)
  return req.headers.authorization === `Bearer ${secret}`;
}

async function startDueCycles(db, now) {
  const cycles = db.collection('cycles');
  const alreadyActive = await cycles.countDocuments({ status: { $in: ['submission_open', 'voting_open'] } });
  if (alreadyActive > 0) return 0;

  const next = await cycles.findOne(
    { status: 'scheduled', submissionStart: { $lte: now } },
    { sort: { submissionStart: 1 } }
  );
  if (!next) return 0;

  await cycles.updateOne({ _id: next._id }, { $set: { status: 'submission_open' } });
  return 1;
}

async function openVotingForFinishedSubmissions(db, now) {
  const result = await db
    .collection('cycles')
    .updateMany({ status: 'submission_open', submissionEnd: { $lte: now } }, { $set: { status: 'voting_open' } });
  return result.modifiedCount;
}

async function completeFinishedVotes(db, now) {
  const cycles = db.collection('cycles');
  const due = await cycles.find({ status: 'voting_open', votingEnd: { $lte: now } }).toArray();

  for (const cycle of due) {
    const submissions = await db
      .collection('submissions')
      .find({ cycleId: cycle._id, $expr: { $gte: [{ $size: '$photoUrls' }, cycle.minPhotos] } })
      .toArray();

    const tallies = await db
      .collection('votes')
      .aggregate([{ $match: { cycleId: cycle._id } }, { $group: { _id: '$submissionId', score: { $sum: '$weight' } } }])
      .toArray();
    const scoreBySubmission = new Map(tallies.map((t) => [t._id.toString(), t.score]));

    const results = submissions.map((s) => ({
      submissionId: s._id,
      userId: s.userId,
      username: s.username,
      score: scoreBySubmission.get(s._id.toString()) || 0,
    }));

    const maxScore = results.reduce((max, r) => Math.max(max, r.score), 0);
    const winners = maxScore > 0 ? results.filter((r) => r.score === maxScore) : [];
    const winnerUserIds = new Set(winners.map((w) => w.userId.toString()));

    const users = db.collection('users');
    for (const r of results) {
      const points = POINTS.participation + (winnerUserIds.has(r.userId.toString()) ? POINTS.winner : 0);
      await users.updateOne({ _id: r.userId }, { $inc: { totalPoints: points } });
    }

    await cycles.updateOne(
      { _id: cycle._id },
      { $set: { status: 'completed', completedAt: new Date(), results, winners } }
    );
  }

  return due.length;
}

module.exports = async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Non autorisé' });
    return;
  }

  const db = await getDb();
  const now = new Date();

  const started = await startDueCycles(db, now);
  const openedVoting = await openVotingForFinishedSubmissions(db, now);
  const completed = await completeFinishedVotes(db, now);

  res.status(200).json({ ok: true, started, openedVoting, completed });
};
