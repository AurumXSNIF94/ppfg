import { Router } from 'express';
import { ServerValue } from 'firebase-admin/database';
import { adminDb } from '../firebase.js';

const router = Router();

async function buildInboundMap() {
  const snapshot = await adminDb.ref('stok_inbound_wh').once('value');
  const value = snapshot.val() || {};
  const map = {};
  for (const item of Object.values(value)) {
    const so = String(item.so_number || '').toUpperCase().trim();
    if (!so) continue;
    map[so] = (map[so] || 0) + (Number(item.isi_karton) || 0);
  }
  return map;
}

router.get('/', async (_req, res, next) => {
  try {
    const [planningSnapshot, inboundMap] = await Promise.all([
      adminDb.ref('so_planning').once('value'),
      buildInboundMap()
    ]);
    const value = planningSnapshot.val() || {};
    const rows = Object.entries(value).map(([id, item]) => {
      const so = String(item.so_number || '').toUpperCase().trim();
      const target = Number(item.target_qty) || 0;
      const actual = inboundMap[so] || 0;
      return {
        id, ...item, so_number: so, target_qty: target, actual_qty: actual,
        shortage: Math.max(target - actual, 0),
        percentage: target ? Math.min(Math.round((actual / target) * 100), 100) : 0,
        status: target && actual >= target ? 'COMPLETED' : 'IN_PROGRESS'
      };
    });
    rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const so = String(req.body.so_number || '').toUpperCase().trim();
    const artikel = String(req.body.artikel || '').toUpperCase().trim();
    const target = Number(req.body.target_qty) || 0;
    if (!so || !artikel || target <= 0) return res.status(400).json({ success: false, message: 'SO, article and target quantity are required.' });

    const ref = adminDb.ref('so_planning').push();
    const data = { so_number: so, artikel, target_qty: target, created_at: new Date().toISOString().split('T')[0], created_by: req.user.email || req.user.uid, created_at_ts: ServerValue.TIMESTAMP };
    await ref.set(data);
    res.status(201).json({ success: true, data: { id: ref.key, ...data } });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const ref = adminDb.ref('so_planning').child(req.params.id);
    const snapshot = await ref.once('value');
    if (!snapshot.exists()) return res.status(404).json({ success: false, message: 'Planning target not found.' });
    await ref.remove();
    res.json({ success: true, id: req.params.id });
  } catch (error) { next(error); }
});

export default router;
