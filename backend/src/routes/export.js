import { Router } from 'express';
import { adminDb } from '../firebase.js';

const router = Router();

router.get('/ready', async (_req, res, next) => {
  try {
    const snapshot = await adminDb.ref('stok_inbound_wh').once('value');
    const value = snapshot.val() || {};
    const map = {};
    for (const [id, item] of Object.entries(value)) {
      const so = String(item.so_number || 'UNKNOWN').toUpperCase().trim();
      if (!map[so]) map[so] = { so: so, artikel: item.artikel || '-', destination: item.destination || '-', lokasi: item.lokasi || '-', items: [] };
      map[so].items.push({ id, ...item });
    }
    const rows = Object.values(map).map(row => ({
      ...row,
      total_cartons: row.items.length,
      total_pcs: row.items.reduce((sum, item) => sum + (Number(item.isi_karton) || 0), 0)
    }));
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.post('/:so/execute', async (req, res, next) => {
  try {
    const so = decodeURIComponent(req.params.so).toUpperCase().trim();
    const snapshot = await adminDb.ref('stok_inbound_wh').once('value');
    const value = snapshot.val() || {};
    const items = Object.entries(value).filter(([, item]) => String(item.so_number || '').toUpperCase().trim() === so).map(([id, item]) => ({ id, ...item }));
    if (!items.length) return res.status(404).json({ success: false, message: 'No active inbound cartons found for this SO.' });

    const first = items[0];
    const totalPcs = items.reduce((sum, item) => sum + (Number(item.isi_karton) || 0), 0);
    const historyRef = adminDb.ref('export_history').push();
    const history = {
      so_number: so,
      artikel: first.artikel || '-',
      destination: first.destination || '-',
      lokasi: first.lokasi || '-',
      total_cartons: items.length,
      total_pcs: totalPcs,
      export_date: new Date().toISOString().split('T')[0],
      exported_by: req.user.email || req.user.uid,
      items
    };

    const updates = {};
    updates[`export_history/${historyRef.key}`] = history;
    for (const item of items) updates[`stok_inbound_wh/${item.id}`] = null;
    await adminDb.ref().update(updates);

    res.json({ success: true, data: { id: historyRef.key, ...history } });
  } catch (error) { next(error); }
});

export default router;
