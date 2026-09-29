import { adminAuth } from '../firebase.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Missing Bearer token.' });
    }

    const token = header.slice(7);
    req.user = await adminAuth.verifyIdToken(token);
    next();
  } catch (error) {
    console.error('[AUTH]', error.message);
    res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
  }
}
