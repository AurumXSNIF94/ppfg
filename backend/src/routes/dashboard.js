import { Router } from 'express';
import { adminDb } from '../firebase.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const snapshot = await adminDb.ref('stok_inbound_wh').once('value');
    const value = snapshot.val() || {};
    const rows = Object.entries(value).map(([id, item]) => ({ id, ...item }));

    const totalSO = new Set(rows.map((x) => x.so_number).filter(Boolean)).size;
    const totalKarton = rows.length;
    const totalQty = rows.reduce((sum, x) => sum + (Number(x.isi_karton) || 0), 0);

    const bySO = new Map();
    for (const row of rows) {
      const key = row.so_number || '-';
      const current = bySO.get(key) || { so: key, artikel: row.artikel || '-', destination: row.destination || '-', karton: 0, qty: 0, lastUpdate: row.timestamp_in || 0 };
      current.karton += 1;
      current.qty += Number(row.isi_karton) || 0;
      current.lastUpdate = Math.max(Number(current.lastUpdate) || 0, Number(row.timestamp_in) || 0);
      bySO.set(key, current);
    }

    const soRows = [...bySO.values()].sort((a, b) => Number(b.lastUpdate) - Number(a.lastUpdate));

    res.json({
      success: true,
      data: {
        summary: { totalSO, totalKarton, totalQty },
        recentSO: soRows.slice(0, 20),
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) { next(error); }
});

export default router;
