import { Router } from 'express';
import { adminDb } from '../firebase.js';

const router = Router();

function isNestedSO(node) {
  return !!node && typeof node === 'object' && (
    Object.prototype.hasOwnProperty.call(node, 'informasi_master') ||
    Object.prototype.hasOwnProperty.call(node, 'karton')
  );
}

router.get('/ready', async (_req, res, next) => {
  try {
    const snapshot = await adminDb.ref('stok_inbound_wh').once('value');
    const value = snapshot.val() || {};
    const map = {};

    for (const [soKey, node] of Object.entries(value)) {
      const master = node?.informasi_master || {};
      const cartons = isNestedSO(node) ? Object.entries(node.karton || {}) : [['', node]];
      for (const [cartonKey, item] of cartons) {
        const row = item || {};
        const so = String(row.so_number || master.so_number || soKey.replace(/^SO_/, '')).toUpperCase().trim();
        if (!map[so]) {
          map[so] = {
            so,
            artikel: String(row.artikel || master.artikel || '-').toUpperCase(),
            destination: String(row.destination || master.destination || '-').toUpperCase(),
            items: []
          };
        }
        map[so].items.push({ id: cartonKey ? `${soKey}/${cartonKey}` : soKey, ...row });
      }
    }

    const data = Object.values(map).map(row => ({
      ...row,
      total_cartons: row.items.length,
      total_pcs: row.items.reduce((sum, item) => sum + (Number(item.isi_karton || item.qty) || 0), 0)
    }));

    res.json({ success: true, data });
  } catch (error) { next(error); }
});

router.post('/:so/execute', async (req, res, next) => {
  try {
    const so = decodeURIComponent(req.params.so).toUpperCase().replace(/^SO_/, '').trim();
    const topRef = adminDb.ref('stok_inbound_wh').child(`SO_${so}`);
    const snapshot = await topRef.once('value');
    if (!snapshot.exists()) return res.status(404).json({ success: false, message: 'No active inbound cartons found for this SO.' });

    const node = snapshot.val();
    const master = node?.informasi_master || {};
    const items = isNestedSO(node)
      ? Object.entries(node.karton || {}).map(([key, item]) => ({ id: `SO_${so}/${key}`, ...item }))
      : [{ id: `SO_${so}`, ...node }];

    if (!items.length) return res.status(404).json({ success: false, message: 'No active inbound cartons found for this SO.' });

    const totalPcs = items.reduce((sum, item) => sum + (Number(item.isi_karton || item.qty) || 0), 0);
    const historyRef = adminDb.ref('export_history').push();
    const history = {
      so_number: so,
      artikel: String(master.artikel || items[0].artikel || '-').toUpperCase(),
      destination: String(master.destination || items[0].destination || '-').toUpperCase(),
      total_cartons: items.length,
      total_pcs: totalPcs,
      export_date: new Date().toISOString().slice(0, 10),
      exported_by: req.user?.email || req.user?.uid || 'WMS User',
      items
    };

    const updates = {};
    updates[`export_history/${historyRef.key}`] = history;
    updates[`stok_inbound_wh/SO_${so}`] = null;
    await adminDb.ref().update(updates);

    res.json({ success: true, data: { id: historyRef.key, ...history } });
  } catch (error) { next(error); }
});

export default router;
