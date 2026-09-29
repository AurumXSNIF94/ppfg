import { Router } from 'express';
import { adminDb } from '../firebase.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const snapshot = await adminDb.ref('stok_inbound_wh').once('value');
    const value = snapshot.val() || {};
    const map = {};

    for (const [id, item] of Object.entries(value)) {
      const so = String(item.so_number || 'UNKNOWN').toUpperCase().trim();
      if (!map[so]) {
        map[so] = {
          so_number: so,
          artikel: item.artikel || '-',
          destination: item.destination || '-',
          lokasi: item.lokasi || '-',
          jenis: item.jenis || '-',
          total_cartons: 0,
          total_pcs: 0,
          sizes: new Set(),
          last_update: 0
        };
      }
      map[so].total_cartons += 1;
      map[so].total_pcs += Number(item.isi_karton) || 0;
      if (item.size) map[so].sizes.add(item.size);
      map[so].last_update = Math.max(Number(map[so].last_update) || 0, Number(item.timestamp_in) || 0);
    }

    const rows = Object.values(map).map(row => ({
      ...row,
      sizes: [...row.sizes]
    })).sort((a, b) => Number(b.last_update) - Number(a.last_update));

    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

export default router;
