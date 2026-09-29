import { Router } from 'express';
import { FieldValue } from 'firebase-admin/database';
import { adminDb } from '../firebase.js';

const router = Router();
const ROOT = 'stok_inbound_wh';

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalize(payload = {}) {
  return {
    tanggal: clean(payload.tanggal),
    so_number: clean(payload.so_number)?.toUpperCase(),
    jenis: clean(payload.jenis) || 'SOLID',
    artikel: clean(payload.artikel)?.toUpperCase(),
    size: clean(payload.size)?.toUpperCase(),
    nomor_karton: clean(payload.nomor_karton)?.toUpperCase(),
    isi_karton: Number(payload.isi_karton) || 0,
    destination: clean(payload.destination)?.toUpperCase(),
    lokasi: clean(payload.lokasi)?.toUpperCase(),
    keterangan: clean(payload.keterangan) || '',
    status: clean(payload.status) || 'INBOUND'
  };
}

router.get('/', async (req, res, next) => {
  try {
    const snapshot = await adminDb.ref(ROOT).once('value');
    const value = snapshot.val() || {};
    const rows = Object.entries(value).map(([id, data]) => ({ id, ...data }));
    rows.sort((a, b) => Number(b.timestamp_in || 0) - Number(a.timestamp_in || 0));
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const data = normalize(req.body);
    if (!data.so_number || !data.artikel || !data.destination || !data.lokasi) {
      return res.status(400).json({ success: false, message: 'SO, article, destination and location are required.' });
    }

    const rows = Array.isArray(req.body.cartons) ? req.body.cartons : [data];
    const created = [];

    for (const carton of rows) {
      const item = normalize({ ...data, ...carton });
      const ref = adminDb.ref(ROOT).push();
      await ref.set({
        ...item,
        timestamp_in: FieldValue.serverTimestamp(),
        user: req.user.email || req.user.uid
      });
      created.push({ id: ref.key, ...item });
    }

    res.status(201).json({ success: true, data: created });
  } catch (error) { next(error); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const ref = adminDb.ref(ROOT).child(req.params.id);
    const snapshot = await ref.once('value');
    if (!snapshot.exists()) return res.status(404).json({ success: false, message: 'Inbound record not found.' });

    const current = snapshot.val() || {};
    const patch = normalize({ ...current, ...req.body });
    await ref.update(patch);
    res.json({ success: true, data: { id: req.params.id, ...current, ...patch } });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const ref = adminDb.ref(ROOT).child(req.params.id);
    const snapshot = await ref.once('value');
    if (!snapshot.exists()) return res.status(404).json({ success: false, message: 'Inbound record not found.' });
    await ref.remove();
    res.json({ success: true, id: req.params.id });
  } catch (error) { next(error); }
});

export default router;
