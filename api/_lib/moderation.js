// Loose moderation: only flag the highest-confidence explicit categories
// (Sightengine's nudity-2.1 model), ignoring suggestive/artistic/partial
// scores entirely. Photographic porn scores these very high; statues and
// paintings rarely do, since the model is trained mostly on photos - that
// asymmetry is what lets classical art through while still catching porn.
const EXPLICIT_THRESHOLD = 0.8;

// Checks a publicly-reachable image URL (e.g. the Cloudinary secure_url)
// against Sightengine. Returns { flagged, score }. If credentials aren't
// configured, or the API call fails for any reason, treats the image as
// clean rather than blocking uploads on an unrelated outage.
async function checkImage(url) {
  const apiUser = process.env.SIGHTENGINE_API_USER;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;
  if (!apiUser || !apiSecret) {
    return { flagged: false, score: 0 };
  }

  try {
    const params = new URLSearchParams({ url, models: 'nudity-2.1', api_user: apiUser, api_secret: apiSecret });
    const res = await fetch(`https://api.sightengine.com/1.0/check.json?${params}`);
    const data = await res.json();
    if (data.status !== 'success' || !data.nudity) {
      return { flagged: false, score: 0 };
    }

    const score = Math.max(data.nudity.sexual_activity || 0, data.nudity.sexual_display || 0);
    return { flagged: score >= EXPLICIT_THRESHOLD, score };
  } catch {
    return { flagged: false, score: 0 };
  }
}

const VISIBLE_STATUSES = ['clean', 'approved'];

// Photos in 'pending_review' or 'rejected' stay invisible to everyone but
// the uploader (and the admin review queue) until an admin clears them.
function visiblePhotoUrls(photos) {
  return (photos || []).filter((p) => VISIBLE_STATUSES.includes(p.status)).map((p) => p.url);
}

module.exports = { checkImage, visiblePhotoUrls };
