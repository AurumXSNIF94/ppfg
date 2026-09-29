const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extra }
  });
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function getToken(request) {
  const header = request.headers.get('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function dbUrl(env) {
  return String(env.FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
}

async function firebaseRequest(env, request, path, init = {}) {
  const token = getToken(request);
  if (!token) throw new HttpError(401, 'Missing Bearer token.');

  const cleanPath = String(path || '').replace(/^\//, '');
  const url = new URL(`${dbUrl(env)}/${cleanPath}.json`);
  url.searchParams.set('auth', token);

  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!response.ok) {
    const message = typeof data === 'object' && data?.error
      ? data.error
      : `Firebase request failed (${response.status})`;
    throw new HttpError(response.status, message);
  }

  return data;
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeInbound(payload = {}) {
  return {
    tanggal: clean(payload.tanggal),
    so_number: clean(payload.so_number)?.toUpperCase(),
    jenis: clean(payload.jenis) || 'SOLID',
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

function normalizeStoredInbound(item = {}, context = {}) {
  const row = item || {};
  const master = context.master || {};
  const { lokasi, location, Location, track_lane, ...safeRow } = row;
  const rawSO = row.so_number ?? row.so ?? row.SO ?? row.soNumber ?? row.nomor_so
    ?? master.so_number ?? master.so ?? master.SO ?? context.soKey?.replace(/^SO_/, '');

  return {
    ...safeRow,
    so_number: clean(rawSO)?.toUpperCase(),
    artikel: clean(row.artikel ?? row.article ?? row.Article ?? row.style ?? row.style_code ?? master.artikel),
    destination: clean(row.destination ?? row.destinasi ?? row.Destination ?? row.dest ?? master.destination),
    jenis: clean(row.jenis ?? row.type ?? row.carton_type ?? master.jenis ?? master.type),
    size: clean(row.size ?? row.ukuran ?? row.Size),
    nomor_karton: clean(row.nomor_karton ?? row.no_karton ?? row.noKarton ?? row.carton_no ?? row.cartonNumber),
    isi_karton: Number(row.isi_karton ?? row.qty ?? row.quantity ?? row.qty_pcs ?? row.jumlah ?? row.total_qty) || 0,
    tanggal: clean(row.tanggal ?? master.tanggal),
    keterangan: clean(row.keterangan ?? master.keterangan) || '',
    status: clean(row.status ?? master.status) || 'INBOUND',
    timestamp_in: Number(row.timestamp_in ?? row.timestamp ?? row.created_at_ts ?? row.createdAt ?? row.created_at) || 0,
    lastUpdate: row.lastUpdate ?? row.timestamp_in ?? row.timestamp ?? master.terakhir_update ?? null
  };
}

function flattenInbound(value) {
  const rows = [];
  for (const [topKey, node] of Object.entries(value || {})) {
    if (isNestedSO(node)) {
      const master = node.informasi_master || {};
      const cartons = node.karton && typeof node.karton === 'object' ? node.karton : {};
      const cartonEntries = Object.entries(cartons);

      for (const [cartonKey, carton] of cartonEntries) {
        rows.push({
          id: `${topKey}/${cartonKey}`,
          so_key: topKey,
          carton_key: cartonKey,
          ...normalizeStoredInbound(carton, { soKey: topKey, master })
        });
      }

      if (!cartonEntries.length) {
        rows.push({
          id: topKey,
          so_key: topKey,
          carton_key: null,
          _emptySO: true,
          ...normalizeStoredInbound({}, { soKey: topKey, master })
        });
      }
      continue;
    }

    rows.push({
      id: topKey,
      ...normalizeStoredInbound(node, { soKey: topKey })
    });
  }
  return rows;
}

function aggregateInbound(value) {
  const rows = flattenInbound(value);
  const bySO = new Map();

  for (const row of rows) {
    const key = row.so_number || row.so_key?.replace(/^SO_/, '') || '-';
    if (!bySO.has(key)) {
      bySO.set(key, {
        so: key,
        artikel: row.artikel || '-',
        destination: row.destination || '-',
        jenis: row.jenis || '-',
        karton: 0,
        qty: 0,
        sizes: new Set(),
        lastUpdate: row.lastUpdate || row.timestamp_in || 0
      });
    }

    const current = bySO.get(key);
    current.artikel = current.artikel === '-' && row.artikel ? row.artikel : current.artikel;
    current.destination = current.destination === '-' && row.destination ? row.destination : current.destination;
    current.jenis = current.jenis === '-' && row.jenis ? row.jenis : current.jenis;
    if (row.size) current.sizes.add(row.size);
    if (!row._emptySO) {
      current.karton += 1;
      current.qty += Number(row.isi_karton) || 0;
    }
    current.lastUpdate = Math.max(
      Number(current.lastUpdate || 0),
      Number(row.timestamp_in || 0),
      new Date(row.lastUpdate || 0).getTime() || 0
    );
  }

  return { rows, bySO };
}

async function getInbound(env, request) {
  const value = await firebaseRequest(env, request, 'stok_inbound_wh');
  return value && typeof value === 'object' ? value : {};
}

async function getPlanning(env, request) {
  const value = await firebaseRequest(env, request, 'so_planning');
  return value && typeof value === 'object' ? value : {};
}

async function getHistory(env, request) {
  const value = await firebaseRequest(env, request, 'export_history');
  return value && typeof value === 'object' ? value : {};
}

async function handleDashboard(env, request) {
  const value = await getInbound(env, request);
  const { bySO } = aggregateInbound(value);
  const recentSO = [...bySO.values()]
    .sort((a, b) => Number(b.lastUpdate || 0) - Number(a.lastUpdate || 0))
    .slice(0, 20);

  return json({
    success: true,
    data: {
      summary: {
        totalSO: bySO.size,
        totalKarton: recentSO.length ? [...bySO.values()].reduce((sum, row) => sum + row.karton, 0) : 0,
        totalQty: [...bySO.values()].reduce((sum, row) => sum + row.qty, 0)
      },
      recentSO,
      updatedAt: new Date().toISOString()
    }
  });
}

async function handleInbound(env, request, segments) {
  const method = request.method;
  const rawId = segments.slice(1).join('/');
  const id = rawId ? decodeURIComponent(rawId) : '';

  if (method === 'GET' && !id) {
    const value = await getInbound(env, request);
    const rows = flattenInbound(value)
      .filter(row => !row._emptySO)
      .sort((a, b) => Number(b.timestamp_in || 0) - Number(a.timestamp_in || 0));
    return json({ success: true, data: rows });
  }

  if (method === 'POST' && !id) {
    const body = await request.json().catch(() => ({}));
    const base = normalizeInbound(body);
    if (!base.so_number || !base.artikel || !base.destination) {
      return json({ success: false, message: 'SO, article and destination are required.' }, 400);
    }

    const cartons = Array.isArray(body.cartons) && body.cartons.length ? body.cartons : [base];
    const targetSOKey = soKey(base.so_number);
    if (!targetSOKey) return json({ success: false, message: 'Invalid SO number.' }, 400);

    const existing = await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(targetSOKey)}`);
    const created = [];
    const now = Date.now();

    if (isNestedSO(existing)) {
      const updates = {};
      const master = {
        ...(existing.informasi_master || {}),
        so_number: base.so_number,
        tanggal: base.tanggal || existing.informasi_master?.tanggal || '',
        jenis: base.jenis,
        artikel: base.artikel,
        destination: base.destination,
        keterangan: base.keterangan,
        status: base.status,
        terakhir_update: new Date(now).toISOString(),
        timestamp_in: now,
        user: body.user || existing.informasi_master?.user || 'WMS User'
      };
      updates[`stok_inbound_wh/${targetSOKey}/informasi_master`] = master;

      for (const carton of cartons) {
        const normalized = normalizeInbound({ ...base, ...carton });
        const key = `carton_${now}_${crypto.randomUUID().slice(0, 8)}`;
        const item = {
          size: normalized.size,
          nomor_karton: normalized.nomor_karton,
          isi_karton: normalized.isi_karton,
          status: normalized.status,
          tanggal: normalized.tanggal,
          timestamp_in: now,
          user: body.user || 'WMS User'
        };
        updates[`stok_inbound_wh/${targetSOKey}/karton/${key}`] = item;
        created.push({ id: `${targetSOKey}/${key}`, so_number: base.so_number, artikel: base.artikel, destination: base.destination, ...item });
      }

      await firebaseRequest(env, request, '', { method: 'PATCH', body: JSON.stringify(updates) });
    } else if (existing && typeof existing === 'object') {
      return json({
        success: false,
        message: `SO node ${targetSOKey} exists in legacy flat format. Existing data is left untouched; migrate this SO before adding new cartons.`
      }, 409);
    } else {
      const cartonMap = {};
      for (const carton of cartons) {
        const normalized = normalizeInbound({ ...base, ...carton });
        const key = `carton_${now}_${crypto.randomUUID().slice(0, 8)}`;
        cartonMap[key] = {
          size: normalized.size,
          nomor_karton: normalized.nomor_karton,
          isi_karton: normalized.isi_karton,
          status: normalized.status,
          tanggal: normalized.tanggal,
          timestamp_in: now,
          user: body.user || 'WMS User'
        };
        created.push({ id: `${targetSOKey}/${key}`, so_number: base.so_number, artikel: base.artikel, destination: base.destination, ...cartonMap[key] });
      }

      const node = {
        informasi_master: {
          so_number: base.so_number,
          tanggal: base.tanggal,
          jenis: base.jenis,
          artikel: base.artikel,
          destination: base.destination,
          keterangan: base.keterangan,
          status: base.status,
          terakhir_update: new Date(now).toISOString(),
          timestamp_in: now,
          user: body.user || 'WMS User'
        },
        karton: cartonMap
      };

      await firebaseRequest(env, request, `stok_inbound_wh/${targetSOKey}`, {
        method: 'PUT',
        body: JSON.stringify(node)
      });
    }

    return json({ success: true, data: created }, 201);
  }

  if ((method === 'PATCH' || method === 'PUT') && id) {
    const parts = id.split('/');
    if (parts.length >= 2 && isNestedSO(await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(parts[0])}`))) {
      const topKey = parts[0];
      const cartonKey = parts.slice(1).join('/');
      const body = await request.json().catch(() => ({}));
      const patch = normalizeInbound(body);
      const existingSO = await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(topKey)}`);
      const master = existingSO?.informasi_master || {};
      const updates = {};

      for (const [key, value] of Object.entries(patch)) {
        if (['so_number', 'jenis', 'artikel', 'destination', 'keterangan', 'tanggal', 'status'].includes(key)) {
          updates[`stok_inbound_wh/${encodeURIComponent(topKey)}/informasi_master/${key}`] = value;
        }
      }
      for (const key of ['size', 'nomor_karton', 'isi_karton', 'status', 'tanggal']) {
        if (patch[key] !== undefined) updates[`stok_inbound_wh/${encodeURIComponent(topKey)}/karton/${encodeURIComponent(cartonKey)}/${key}`] = patch[key];
      }
      updates[`stok_inbound_wh/${encodeURIComponent(topKey)}/informasi_master/terakhir_update`] = new Date().toISOString();

      await firebaseRequest(env, request, '', { method: 'PATCH', body: JSON.stringify(updates) });
      const value = await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(topKey)}/karton/${encodeURIComponent(cartonKey)}`);
      return json({ success: true, data: { id, ...normalizeStoredInbound(value, { soKey: topKey, master }) } });
    }

    const body = await request.json().catch(() => ({}));
    const patch = normalizeInbound(body);
    await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...patch, timestamp_in: Date.now() })
    });
    const value = await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(id)}`);
    if (!value) return json({ success: false, message: 'Inbound record not found.' }, 404);
    return json({ success: true, data: { id, ...value } });
  }

  if (method === 'DELETE' && id) {
    const parts = id.split('/');
    if (parts.length >= 2) {
      const topKey = parts[0];
      const cartonKey = parts.slice(1).join('/');
      const parent = await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(topKey)}`);
      if (isNestedSO(parent)) {
        await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(topKey)}/karton/${encodeURIComponent(cartonKey)}`, { method: 'DELETE' });
        return json({ success: true, id });
      }
    }

    const current = await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(id)}`);
    if (!current) return json({ success: false, message: 'Inbound record not found.' }, 404);
    await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return json({ success: true, id });
  }

  return json({ success: false, message: 'Inbound route not found.' }, 404);
}

async function handleSO(env, request) {
  const value = await getInbound(env, request);
  const { bySO } = aggregateInbound(value);
  const data = [...bySO.values()].map(row => ({
    so_number: row.so,
    artikel: row.artikel,
    destination: row.destination,
    jenis: row.jenis || '-',
    total_cartons: row.karton,
    total_pcs: row.qty,
    sizes: [...(row.sizes || [])],
    last_update: row.lastUpdate
  }));
  return json({ success: true, data });
}

async function handleSODetail(env, request, soParam) {
  const so = String(soParam || '').toUpperCase().replace(/^SO_/, '').trim();
  if (!so) return json({ success: false, message: 'SO number is required.' }, 400);

  const value = await getInbound(env, request);
  const topKey = soKey(so);
  const parent = await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(topKey)}`);

  if (isNestedSO(parent)) {
    const master = parent.informasi_master || {};
    const cartons = Object.entries(parent.karton || {}).map(([id, item]) => ({
      id: `${topKey}/${id}`,
      ...normalizeStoredInbound(item, { soKey: topKey, master })
    }));

    const sizes = [...new Set(cartons.map(item => item.size).filter(Boolean))];
    const totalPcs = cartons.reduce((sum, item) => sum + (Number(item.isi_karton) || 0), 0);

    return json({
      success: true,
      data: {
        so_number: so,
        master: {
          tanggal: clean(master.tanggal),
          jenis: clean(master.jenis) || '-',
          artikel: clean(master.artikel) || '-',
          destination: clean(master.destination) || '-',
          keterangan: clean(master.keterangan) || '',
          status: clean(master.status) || 'INBOUND',
          terakhir_update: master.terakhir_update || master.timestamp_in || null
        },
        summary: {
          total_cartons: cartons.length,
          total_pcs: totalPcs,
          sizes
        },
        cartons
      }
    });
  }

  const rows = flattenInbound(value).filter(row =>
    !row._emptySO &&
    String(row.so_number || '').toUpperCase().replace(/^SO_/, '').trim() === so
  );

  if (!rows.length) {
    return json({ success: false, message: `SO ${so} not found.` }, 404);
  }

  const sizes = [...new Set(rows.map(item => item.size).filter(Boolean))];
  const totalPcs = rows.reduce((sum, item) => sum + (Number(item.isi_karton) || 0), 0);
  const first = rows[0];

  return json({
    success: true,
    data: {
      so_number: so,
      master: {
        tanggal: first.tanggal || '-',
        jenis: first.jenis || '-',
        artikel: first.artikel || '-',
        destination: first.destination || '-',
        keterangan: first.keterangan || '',
        status: first.status || 'INBOUND',
        terakhir_update: first.lastUpdate || first.timestamp_in || null
      },
      summary: {
        total_cartons: rows.length,
        total_pcs: totalPcs,
        sizes
      },
      cartons: rows
    }
  });
}

async function handlePlanning(env, request, segments) {
  const id = segments[1];

  if (request.method === 'GET' && !id) {
    const [planningValue, inboundValue] = await Promise.all([
      getPlanning(env, request),
      getInbound(env, request)
    ]);
    const { bySO } = aggregateInbound(inboundValue);

    const data = Object.entries(planningValue).map(([key, item]) => {
      const row = item || {};
      const so = String(row.so_number || '').toUpperCase().trim();
      const target = Number(row.target_qty) || 0;
      const actual = bySO.get(so)?.qty || 0;
      return {
        id: key,
        ...row,
        so_number: so,
        target_qty: target,
        actual_qty: actual,
        shortage: Math.max(target - actual, 0),
        percentage: target ? Math.min(Math.round((actual / target) * 100), 100) : 0,
        status: target && actual >= target ? 'COMPLETED' : 'IN_PROGRESS'
      };
    });

    data.sort((a, b) => Number(b.created_at_ts || 0) - Number(a.created_at_ts || 0));
    return json({ success: true, data });
  }

  if (request.method === 'POST' && !id) {
    const body = await request.json().catch(() => ({}));
    const so = String(body.so_number || '').toUpperCase().trim();
    const artikel = String(body.artikel || '').toUpperCase().trim();
    const target = Number(body.target_qty) || 0;
    if (!so || !artikel || target <= 0) {
      return json({ success: false, message: 'SO, article and target quantity are required.' }, 400);
    }

    const item = {
      so_number: so,
      artikel,
      target_qty: target,
      created_at: new Date().toISOString().slice(0, 10),
      created_at_ts: Date.now(),
      created_by: 'WMS User'
    };
    const key = await firebaseRequest(env, request, 'so_planning', {
      method: 'POST',
      body: JSON.stringify(item)
    });
    return json({ success: true, data: { id: key?.name, ...item } }, 201);
  }

  if (request.method === 'DELETE' && id) {
    const current = await firebaseRequest(env, request, `so_planning/${encodeURIComponent(id)}`);
    if (!current) return json({ success: false, message: 'Planning target not found.' }, 404);
    await firebaseRequest(env, request, `so_planning/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return json({ success: true, id });
  }

  return json({ success: false, message: 'Planning route not found.' }, 404);
}

async function handleExport(env, request, segments) {
  if (request.method === 'GET' && segments[1] === 'ready') {
    const value = await getInbound(env, request);
    const rows = flattenInbound(value).filter(row => !row._emptySO);
    const map = {};

    for (const row of rows) {
      const so = String(row.so_number || 'UNKNOWN').toUpperCase().trim();
      if (!map[so]) {
        map[so] = {
          so,
          artikel: row.artikel || '-',
          destination: row.destination || '-',
          items: []
        };
      }
      map[so].items.push(row);
    }

    const data = Object.values(map).map(row => ({
      ...row,
      total_cartons: row.items.length,
      total_pcs: row.items.reduce((sum, item) => sum + (Number(item.isi_karton) || 0), 0)
    }));

    return json({ success: true, data });
  }

  if (request.method === 'POST' && segments.length >= 3 && segments[2] === 'execute') {
    const so = decodeURIComponent(segments[1]).toUpperCase().replace(/^SO_/, '').trim();
    const value = await getInbound(env, request);
    const topKey = soKey(so);
    const parent = await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(topKey)}`);

    if (isNestedSO(parent)) {
      const items = Object.entries(parent.karton || {}).map(([id, item]) => ({
        id: `${topKey}/${id}`,
        ...normalizeStoredInbound(item, { soKey: topKey, master: parent.informasi_master || {} })
      }));
      if (!items.length) return json({ success: false, message: 'No active inbound cartons found for this SO.' }, 404);

      const master = parent.informasi_master || {};
      const totalPcs = items.reduce((sum, item) => sum + (Number(item.isi_karton) || 0), 0);
      const historyKey = `export_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
      const history = {
        so_number: so,
        artikel: master.artikel || '-',
        destination: master.destination || '-',
        total_cartons: items.length,
        total_pcs: totalPcs,
        export_date: new Date().toISOString().slice(0, 10),
        exported_by: 'WMS User',
        items
      };

      const updates = { [`export_history/${historyKey}`]: history, [`stok_inbound_wh/${topKey}`]: null };
      await firebaseRequest(env, request, '', { method: 'PATCH', body: JSON.stringify(updates) });
      return json({ success: true, data: { id: historyKey, ...history } });
    }

    const rows = flattenInbound(value).filter(row => !row._emptySO && String(row.so_number || '').toUpperCase() === so);
    if (!rows.length) return json({ success: false, message: 'No active inbound cartons found for this SO.' }, 404);

    const first = rows[0];
    const totalPcs = rows.reduce((sum, item) => sum + (Number(item.isi_karton) || 0), 0);
    const historyKey = `export_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const history = {
      so_number: so,
      artikel: first.artikel || '-',
      destination: first.destination || '-',
      total_cartons: rows.length,
      total_pcs: totalPcs,
      export_date: new Date().toISOString().slice(0, 10),
      exported_by: 'WMS User',
      items: rows
    };

    const updates = { [`export_history/${historyKey}`]: history };
    for (const row of rows) updates[`stok_inbound_wh/${row.id}`] = null;
    await firebaseRequest(env, request, '', { method: 'PATCH', body: JSON.stringify(updates) });
    return json({ success: true, data: { id: historyKey, ...history } });
  }

  return json({ success: false, message: 'Export route not found.' }, 404);
}

async function handleHistory(env, request) {
  if (request.method !== 'GET') return json({ success: false, message: 'Method not allowed.' }, 405);
  const value = await getHistory(env, request);
  const data = Object.entries(value).map(([id, item]) => ({ id, ...(item || {}) }));
  data.sort((a, b) => String(b.export_date || '').localeCompare(String(a.export_date || '')) || String(b.id).localeCompare(String(a.id)));
  return json({ success: true, data });
}

async function handleGas(env, request) {
  if (request.method !== 'GET') return json({ success: false, message: 'Method not allowed.' }, 405);
  const base = String(env.GAS_API_URL || '').replace(/\/$/, '');
  if (!base) return json({ success: false, message: 'GAS_API_URL is not configured.' }, 503);

  const url = new URL(base);
  for (const [key, value] of new URL(request.url).searchParams.entries()) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, { method: 'GET', cache: 'no-store' });
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const path = Array.isArray(params?.path) ? params.path : [];
  const route = path.join('/');

  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS'
        }
      });
    }

    if (route === 'health' && request.method === 'GET') {
      return json({ success: true, service: 'ppfg-wms-pages-function', status: 'ok', time: new Date().toISOString() });
    }

    const token = getToken(request);
    if (!token) return json({ success: false, message: 'Missing Bearer token.' }, 401);
    if (!dbUrl(env)) return json({ success: false, message: 'FIREBASE_DATABASE_URL is not configured.' }, 500);

    if (route === 'dashboard') return handleDashboard(env, request);
    if (route === 'inbound' || route.startsWith('inbound/')) return handleInbound(env, request, path);
    if (route.startsWith('so/') && path.length >= 2 && request.method === 'GET') return handleSODetail(env, request, path[1]);
    if (route === 'so') return handleSO(env, request);
    if (route === 'planning' || route.startsWith('planning/')) return handlePlanning(env, request, path);
    if (route === 'export' || route.startsWith('export/')) return handleExport(env, request, path);
    if (route === 'export-history') return handleHistory(env, request);
    if (route === 'gas') return handleGas(env, request);

    return json({ success: false, message: 'API route not found.' }, 404);
  } catch (error) {
    console.error('[PPFG API]', error);
    return json({
      success: false,
      message: error instanceof HttpError ? error.message : (error?.message || 'Internal server error.')
    }, error instanceof HttpError ? error.status : 500);
  }
}
