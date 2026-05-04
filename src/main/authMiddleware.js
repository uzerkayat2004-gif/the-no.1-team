// authMiddleware.js — Firebase Authentication Middleware
const admin = require('firebase-admin');

// Initialize Firebase Admin (assuming credentials are in environment or config)
// admin.initializeApp({
//   credential: admin.credential.applicationDefault()
// });

/**
 * Middleware to verify Firebase ID tokens
 */
async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authentication token provided.' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // Add user info to request
    next();
  } catch (error) {
    console.error('Firebase Auth Error:', error);
    res.status(403).json({ error: 'Invalid or expired authentication token.' });
  }
}

/**
 * Simple session check for Electron main process (if needed)
 */
function checkSession(session) {
  if (!session || !session.userId) {
    throw new Error('Unauthorized: No active session found.');
  }
  return true;
}

module.exports = { verifyAuth, checkSession };
