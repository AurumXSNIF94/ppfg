import { Router } from 'express';
import { adminDb } from '../firebase.js';

const router = Router();

function isNestedSO(node) {
  return !!node && typeof node === 'object' && (
    Object.prototype.hasOwnProperty.call(node, 'informasi_master') ||
    Object.prototype.hasOwnProperty.call(node, 'karton')
  );
}

function normalizeRow(item = {}, master = {}, soKey = '', cartonKey = '') {
  return {
    so_number: String(item.so_number || master.so_number || soKey.replace(/^SO_/, '') || '').toUpperCase(),
    artikel: String(item.artikel || master.artikel || '').toUpperCase(),
    destination: String(item.destination || master.destination || '').toUpperCase(),
    size: String(item.size || '').toUpperCase(),
    isi_karton: Number(item.isi_karton || item.qty || item.quantity || 0),
    lastUpdate: item.lastUpdate || item.timestamp_in || master.terakhir_update || master.timestamp_in || null,
    carton_key: cartonKey
  };
}

function flatten(value) {
  const rows = [];
  for (const [soKey, node] of Object.entries(value || {})) {
    if (isNestedSO(node)) {
      const master = node.informasi_master || {};
      for (const [cartonKey, item] of Object.entries(node.karton || {})) {
        rows.push(normalizeRow(item || {}, master, soKey, cartonKey));
      }
    } else {
      rows.push(normalizeRow(node || {}, {}, soKey, ''));
    }
  }
  return rows;
}

router.get('/', async (_req, res, next) => {
  try {
    const snapshot = await adminDb.ref('stok_inbound_wh').once('value');
    const rows = flatten(snapshot.val() || {});
    const bySO = new Map();

    for (const row of rows) {
      if (!row.so_number) continue;
      const current = bySO.get(row.so_number) || {
        so: row.so_number, artikel: row.artikel || '-', destination: row.destination || '-',
        karton: 0, qty: 0, lastUpdate: row.lastUpdate || 0
      };
      current.artikel = current.artikel === '-' && row.artikel ? row.artikel : current.artikel;
      current.destination = current.destination === '-' && row.destination ? row.destination : current.destination;
      current.karton += 1;
      current.qty += row.isi_karton;
      const rowTime = new Date(row.lastUpdate || 0).getTime() || Number(row.lastUpdate) || 0;
      const currentTime = new Date(current.lastUpdate || 0).getTime() || Number(current.lastUpdate) || 0;
      current.lastUpdate = Math.max(currentTime, rowTime);
      bySO.set(row.so_number, current);
    }

    const allSO = [...bySO.values()];
    const sumMap = (keyFn) => {
      const map = new Map();
      for (const row of rows) {
        const key = keyFn(row) || '-';
        const current = map.get(key) || { name: key, qty: 0, cartons: 0 };
        current.qty += row.isi_karton;
        current.cartons += 1;
        map.set(key, current);
      }
      return [...map.values()].sort((a, b) => b.qty - a.qty);
    };

    const lastUpdateStats = allSO
      .filter(row => Number(row.lastUpdate || 0) > 0)
      .sort((a,b) => Number(b.lastUpdate || 0) - Number(a.lastUpdate || 0))
      .slice(0,14)
      .reverse()
      .map(row => ({ so: row.so, qty: row.qty, cartons: row.karton, lastUpdate: row.lastUpdate }));

    res.json({
      success: true,
      data: {
        summary: {
          totalSO: bySO.size,
          totalKarton: rows.length,
          totalQty: rows.reduce((s,r)=>s+r.isi_karton,0),
          totalArticles: new Set(rows.map(r=>r.artikel).filter(Boolean)).size,
          totalDestinations: new Set(rows.map(r=>r.destination || '-')).size,
          avgQtyPerSO: bySO.size ? Math.round(rows.reduce((s,r)=>s+r.isi_karton,0)/bySO.size) : 0
        },
        recentSO: [...allSO].sort((a,b)=>Number(b.lastUpdate)-Number(a.lastUpdate)).slice(0,20),
        destinationStats: sumMap(r=>r.destination).slice(0,10),
        articleStats: sumMap(r=>r.artikel).slice(0,10),
        sizeStats: sumMap(r=>r.size).slice(0,15),
        lastUpdateStats,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) { next(error); }
});

export default router;
