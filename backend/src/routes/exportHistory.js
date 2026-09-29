import { Router } from 'express';
import { adminDb } from '../firebase.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const snapshot = await adminDb.ref('export_history').once('value');
    const value = snapshot.val() || {};
    const rows = Object.entries(value).map(([id, item]) => ({ id, ...item }));
    rows.reverse();
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

export default router;
