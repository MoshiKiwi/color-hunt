const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const { ObjectId } = require('mongodb');

const COOKIE_NAME = 'session';
const SESSION_DAYS = 30;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signSession(user) {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email, username: user.username },
    getJwtSecret(),
    { expiresIn: `${SESSION_DAYS}d` }
  );
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    })
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  );
}

function getSessionFromRequest(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  const parsed = cookie.parse(header);
  const token = parsed[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret());
    return { userId: payload.userId, email: payload.email, username: payload.username };
  } catch {
    return null;
  }
}

/** Returns the session payload or writes a 401 and returns null. */
function requireAuth(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: 'Non authentifié' });
    return null;
  }
  return session;
}

/** Returns { session, user } for an admin, or writes 401/403 and returns null. */
async function requireAdmin(req, res, db) {
  const session = requireAuth(req, res);
  if (!session) return null;
  const user = await db.collection('users').findOne({ _id: new ObjectId(session.userId) });
  if (!user || !user.isAdmin) {
    res.status(403).json({ error: 'Réservé aux administrateurs' });
    return null;
  }
  return { session, user };
}

module.exports = {
  hashPassword,
  verifyPassword,
  signSession,
  setSessionCookie,
  clearSessionCookie,
  getSessionFromRequest,
  requireAuth,
  requireAdmin,
};
