import { Router } from 'express';
import { adminDb } from '../firebase.js';

const router = Router();

function isNestedSO(node) {
  return !!node && typeof node === 'object' && (
    Object.prototype.hasOwnProperty.call(node, 'informasi_master') ||
    Object.prototype.hasOwnProperty.call(node, 'karton')
  );
}

function cartonNo(value, key) {
  const raw = String(value ?? key ?? '').trim();
  if (!raw) return '-';
  const match = raw.match(/(?:KARTON|CARTON|CTN)[ _-]*(\d+)/i) || raw.match(/^#?\s*(\d+)$/) || raw.match(/\d+/);
  return match ? match[1] : raw.replace(/^#/, '').trim();
}

router.get('/', async (_req, res, next) => {
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
        if (!so) continue;
        if (!map[so]) {
          map[so] = {
            so_number: so,
            artikel: String(row.artikel || master.artikel || '-').toUpperCase(),
            destination: String(row.destination || master.destination || '-').toUpperCase(),
            total_cartons: 0,
            total_pcs: 0,
            sizes: new Set()
          };
        }
        map[so].total_cartons += 1;
        map[so].total_pcs += Number(row.isi_karton || row.qty || 0) || 0;
        if (row.size) map[so].sizes.add(String(row.size).toUpperCase());
      }
    }

    const rows = Object.values(map).map(row => ({ ...row, sizes: [...row.sizes] }));
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.get('/:so', async (req, res, next) => {
  try {
    const so = String(req.params.so || '').toUpperCase().replace(/^SO_/, '').trim();
    const topKey = `SO_${so}`;
    const snapshot = await adminDb.ref('stok_inbound_wh').child(topKey).once('value');
    if (!snapshot.exists()) return res.status(404).json({ success: false, message: `SO ${so} not found.` });

    const node = snapshot.val();
    if (isNestedSO(node)) {
      const master = node.informasi_master || {};
      const cartons = Object.entries(node.karton || {}).map(([key, item]) => ({
        id: `${topKey}/${key}`,
        carton_key: key,
        so_number: so,
        artikel: String(item?.artikel || master.artikel || '-').toUpperCase(),
        destination: String(item?.destination || master.destination || '-').toUpperCase(),
        size: String(item?.size || '').toUpperCase(),
        nomor_karton: cartonNo(item?.nomor_karton, key),
        isi_karton: Number(item?.isi_karton || item?.qty || 0) || 0,
        tanggal: item?.tanggal || master.tanggal || new Date().toISOString().slice(0, 10),
        status: item?.status || master.status || 'INBOUND'
      }));
      const sizes = [...new Set(cartons.map(item => item.size).filter(Boolean))];
      return res.json({
        success: true,
        data: {
          so_number: so,
          master: {
            tanggal: master.tanggal || new Date().toISOString().slice(0, 10),
            artikel: String(master.artikel || '-').toUpperCase(),
            destination: String(master.destination || '-').toUpperCase(),
            keterangan: master.keterangan || '',
            status: master.status || 'INBOUND',
            terakhir_update: master.terakhir_update || master.timestamp_in || null
          },
          summary: { total_cartons: cartons.length, total_pcs: cartons.reduce((s, r) => s + r.isi_karton, 0), sizes },
          cartons: cartons.sort((a, b) => Number(a.nomor_karton) - Number(b.nomor_karton))
        }
      });
    }

    return res.json({
      success: true,
      data: {
        so_number: so,
        master: {
          tanggal: node.tanggal || new Date().toISOString().slice(0, 10),
          artikel: String(node.artikel || '-').toUpperCase(),
          destination: String(node.destination || '-').toUpperCase(),
          keterangan: node.keterangan || '',
          status: node.status || 'INBOUND',
          terakhir_update: node.lastUpdate || node.timestamp_in || null
        },
        summary: { total_cartons: 1, total_pcs: Number(node.isi_karton || node.qty || 0) || 0, sizes: node.size ? [String(node.size).toUpperCase()] : [] },
        cartons: [{ id: topKey, ...node, nomor_karton: cartonNo(node.nomor_karton, node.id || topKey) }]
      }
    });
  } catch (error) { next(error); }
});

export default router;
