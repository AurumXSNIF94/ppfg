import { Router } from 'express';
import { ServerValue } from 'firebase-admin/database';
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
    artikel: clean(payload.artikel)?.toUpperCase(),
    size: clean(payload.size)?.toUpperCase(),
    nomor_karton: clean(payload.nomor_karton ?? payload.no_karton ?? payload.noKarton)?.toUpperCase(),
    isi_karton: Number(payload.isi_karton ?? payload.qty) || 0,
    destination: clean(payload.destination)?.toUpperCase(),
    keterangan: clean(payload.keterangan) || '',
    status: clean(payload.status) || 'INBOUND'
  };
}

function soKey(so) {
  const value = String(so || '').trim().toUpperCase().replace(/^SO_/, '');
  return value ? `SO_${value}` : '';
}

function isNestedSO(node) {
  return !!node && typeof node === 'object' && (
    Object.prototype.hasOwnProperty.call(node, 'informasi_master') ||
    Object.prototype.hasOwnProperty.call(node, 'karton')
  );
}

function normalizeCartonNumber(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  const match = raw.match(/(?:KARTON|CARTON|CTN)[ _-]*(\d+)/i) || raw.match(/^#?\s*(\d+)$/) || raw.match(/\d+/);
  return match ? match[1] : raw.replace(/^#/, '').trim();
}

function normalizeStored(item = {}, master = {}, cartonKey = '') {
  const row = item || {};
  return {
    ...row,
    so_number: clean(row.so_number ?? master.so_number)?.toUpperCase(),
    artikel: clean(row.artikel ?? master.artikel)?.toUpperCase(),
    destination: clean(row.destination ?? master.destination)?.toUpperCase(),
    size: clean(row.size)?.toUpperCase(),
    nomor_karton: normalizeCartonNumber(row.nomor_karton ?? row.no_karton ?? row.noKarton ?? cartonKey),
    isi_karton: Number(row.isi_karton ?? row.qty ?? row.quantity ?? 0) || 0,
    tanggal: clean(row.tanggal ?? master.tanggal),
    keterangan: clean(row.keterangan ?? master.keterangan) || '',
    status: clean(row.status ?? master.status) || 'INBOUND'
  };
}

async function readRoot() {
  const snapshot = await adminDb.ref(ROOT).once('value');
  return snapshot.val() || {};
}

router.get('/', async (_req, res, next) => {
  try {
    const value = await readRoot();
    const rows = [];

    for (const [soNodeKey, node] of Object.entries(value)) {
      if (isNestedSO(node)) {
        const master = node.informasi_master || {};
        for (const [cartonKey, item] of Object.entries(node.karton || {})) {
          rows.push({
            id: `${soNodeKey}/${cartonKey}`,
            carton_key: cartonKey,
            ...normalizeStored(item, master, cartonKey)
          });
        }
      } else {
        rows.push({ id: soNodeKey, ...normalizeStored(node) });
      }
    }

    rows.sort((a, b) => Number(b.timestamp_in || 0) - Number(a.timestamp_in || 0));
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const base = normalize(req.body);
    if (!base.so_number || !base.artikel || !base.destination) {
      return res.status(400).json({ success: false, message: 'SO, article and destination are required.' });
    }

    const cartons = Array.isArray(req.body.cartons) && req.body.cartons.length ? req.body.cartons : [base];
    const targetKey = soKey(base.so_number);
    const ref = adminDb.ref(ROOT).child(targetKey);
    const existingSnapshot = await ref.once('value');
    const existing = existingSnapshot.val();
    const now = Date.now();
    const user = req.user?.email || req.user?.uid || 'WMS User';
    const created = [];

    if (isNestedSO(existing)) {
      const updates = {};
      updates[`informasi_master`] = {
        ...(existing.informasi_master || {}),
        so_number: base.so_number,
        tanggal: base.tanggal || existing.informasi_master?.tanggal || new Date(now).toISOString().slice(0, 10),
        artikel: base.artikel,
        destination: base.destination,
        keterangan: base.keterangan,
        status: base.status,
        terakhir_update: new Date(now).toISOString(),
        timestamp_in: now,
        user
      };

      for (const carton of cartons) {
        const item = normalize({ ...base, ...carton });
        const key = `carton_${now}_${Math.random().toString(36).slice(2, 10)}`;
        const value = {
          size: item.size,
          nomor_karton: item.nomor_karton,
          isi_karton: item.isi_karton,
          status: item.status,
          tanggal: item.tanggal || base.tanggal || new Date(now).toISOString().slice(0, 10),
          timestamp_in: now,
          user
        };
        updates[`karton/${key}`] = value;
        created.push({ id: `${targetKey}/${key}`, carton_key: key, so_number: base.so_number, artikel: base.artikel, destination: base.destination, ...value });
      }

      await ref.update(updates);
    } else if (existing && typeof existing === 'object') {
      return res.status(409).json({
        success: false,
        message: `SO node ${targetKey} exists in legacy flat format. Existing data was not modified; migrate this SO before adding new cartons.`
      });
    } else {
      const cartonMap = {};
      for (const carton of cartons) {
        const item = normalize({ ...base, ...carton });
        const key = `carton_${now}_${Math.random().toString(36).slice(2, 10)}`;
        cartonMap[key] = {
          size: item.size,
          nomor_karton: item.nomor_karton,
          isi_karton: item.isi_karton,
          status: item.status,
          tanggal: item.tanggal || new Date(now).toISOString().slice(0, 10),
          timestamp_in: now,
          user
        };
        created.push({ id: `${targetKey}/${key}`, carton_key: key, so_number: base.so_number, artikel: base.artikel, destination: base.destination, ...cartonMap[key] });
      }

      await ref.set({
        informasi_master: {
          so_number: base.so_number,
          tanggal: base.tanggal || new Date(now).toISOString().slice(0, 10),
          artikel: base.artikel,
          destination: base.destination,
          keterangan: base.keterangan,
          status: base.status,
          terakhir_update: new Date(now).toISOString(),
          timestamp_in: now,
          user
        },
        karton: cartonMap
      });
    }

    res.status(201).json({ success: true, data: created });
  } catch (error) { next(error); }
});

router.patch('/*id', async (req, res, next) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id.join('/') : req.params.id;
    const parts = String(rawId || '').split('/');
    const topKey = parts[0];
    const cartonKey = parts.slice(1).join('/');
    const topRef = adminDb.ref(ROOT).child(topKey);
    const topSnapshot = await topRef.once('value');
    if (!topSnapshot.exists()) return res.status(404).json({ success: false, message: 'Inbound record not found.' });

    const parent = topSnapshot.val();
    const patch = normalize(req.body);
    const updates = {};

    if (parts.length >= 2 && isNestedSO(parent)) {
      const master = parent.informasi_master || {};
      for (const key of ['so_number', 'artikel', 'destination', 'keterangan', 'tanggal', 'status']) {
        if (patch[key] !== undefined) updates[`informasi_master/${key}`] = patch[key];
      }
      for (const key of ['size', 'nomor_karton', 'isi_karton', 'tanggal', 'status']) {
        if (patch[key] !== undefined) updates[`karton/${cartonKey}/${key}`] = patch[key];
      }
      updates['informasi_master/terakhir_update'] = new Date().toISOString();
      await topRef.update(updates);

      const cartonSnapshot = await topRef.child('karton').child(cartonKey).once('value');
      const item = cartonSnapshot.val();
      return res.json({ success: true, data: { id: rawId, carton_key: cartonKey, ...normalizeStored(item, { ...master, ...updates.informasi_master }, cartonKey) } });
    }

    if (parts.length >= 2) return res.status(404).json({ success: false, message: 'Inbound carton not found.' });

    await topRef.update(patch);
    const updated = (await topRef.once('value')).val() || {};
    res.json({ success: true, data: { id: topKey, ...updated } });
  } catch (error) { next(error); }
});

router.delete('/*id', async (req, res, next) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id.join('/') : req.params.id;
    const parts = String(rawId || '').split('/');
    const topRef = adminDb.ref(ROOT).child(parts[0]);
    const topSnapshot = await topRef.once('value');
    if (!topSnapshot.exists()) return res.status(404).json({ success: false, message: 'Inbound record not found.' });

    const parent = topSnapshot.val();
    if (parts.length >= 2 && isNestedSO(parent)) {
      await topRef.child('karton').child(parts.slice(1).join('/')).remove();
      const remaining = await topRef.child('karton').once('value');
      if (!remaining.exists()) await topRef.remove();
      else await topRef.child('informasi_master/terakhir_update').set(new Date().toISOString());
      return res.json({ success: true, id: rawId });
    }

    await topRef.remove();
    res.json({ success: true, id: req.params.id });
  } catch (error) { next(error); }
});

export default router;
