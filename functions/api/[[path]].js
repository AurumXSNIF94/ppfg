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

function getToken(request) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
}

function dbUrl(env) {
  return String(env.FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
}

async function firebaseRequest(env, request, path, init = {}) {
  const token = getToken(request);
  if (!token) throw new HttpError(401, 'Missing Bearer token.');

  const url = new URL(`${dbUrl(env)}/${path.replace(/^\//, '')}.json`);
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
    const message = typeof data === 'object' && data?.error ? data.error : `Firebase request failed (${response.status})`;
    throw new HttpError(response.status, message);
  }

  return data;
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
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
    lokasi: clean(payload.lokasi)?.toUpperCase(),
    keterangan: clean(payload.keterangan) || '',
    status: clean(payload.status) || 'INBOUND'
  };
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

function inboundRows(value) {
  return Object.entries(value).map(([id, item]) => ({ id, ...(item || {}) }));
}

async function handleDashboard(env, request) {
  const value = await getInbound(env, request);
  const rows = inboundRows(value);
  const totalSO = new Set(rows.map(x => x.so_number).filter(Boolean)).size;
  const totalKarton = rows.length;
  const totalQty = rows.reduce((sum, x) => sum + (Number(x.isi_karton) || 0), 0);

  const bySO = new Map();
  for (const row of rows) {
    const key = row.so_number || '-';
    const current = bySO.get(key) || {
      so: key,
      artikel: row.artikel || '-',
      destination: row.destination || '-',
      karton: 0,
      qty: 0,
      lastUpdate: Number(row.timestamp_in) || 0
    };
    current.karton += 1;
    current.qty += Number(row.isi_karton) || 0;
    current.lastUpdate = Math.max(current.lastUpdate, Number(row.timestamp_in) || 0);
    bySO.set(key, current);
  }

  const recentSO = [...bySO.values()]
    .sort((a, b) => b.lastUpdate - a.lastUpdate)
    .slice(0, 20);

  return json({
    success: true,
    data: {
      summary: { totalSO, totalKarton, totalQty },
      recentSO,
      updatedAt: new Date().toISOString()
    }
  });
}

async function handleInbound(env, request, segments) {
  const method = request.method;
  const id = segments[1];

  if (method === 'GET' && !id) {
    const value = await getInbound(env, request);
    const rows = inboundRows(value).sort((a, b) => Number(b.timestamp_in || 0) - Number(a.timestamp_in || 0));
    return json({ success: true, data: rows });
  }

  if (method === 'POST' && !id) {
    const body = await request.json().catch(() => ({}));
    const base = normalizeInbound(body);
    if (!base.so_number || !base.artikel || !base.destination || !base.lokasi) {
      return json({ success: false, message: 'SO, article, destination and location are required.' }, 400);
    }

    const cartons = Array.isArray(body.cartons) && body.cartons.length ? body.cartons : [base];
    const created = [];

    for (const carton of cartons) {
      const item = {
        ...base,
        ...normalizeInbound({ ...base, ...carton }),
        timestamp_in: Date.now(),
        user: body.user || 'WMS User'
      };
      const key = await firebaseRequest(env, request, 'stok_inbound_wh', {
        method: 'POST',
        body: JSON.stringify(item)
      });
      created.push({ id: key?.name, ...item });
    }

    return json({ success: true, data: created }, 201);
  }

  if ((method === 'PATCH' || method === 'PUT') && id) {
    const body = await request.json().catch(() => ({}));
    const patch = normalizeInbound(body);
    delete patch.timestamp_in;
    delete patch.user;
    await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch)
    });
    const value = await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(id)}`);
    if (!value) return json({ success: false, message: 'Inbound record not found.' }, 404);
    return json({ success: true, data: { id, ...value } });
  }

  if (method === 'DELETE' && id) {
    const current = await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(id)}`);
    if (!current) return json({ success: false, message: 'Inbound record not found.' }, 404);
    await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return json({ success: true, id });
  }

  return json({ success: false, message: 'Inbound route not found.' }, 404);
}

async function handleSO(env, request) {
  const value = await getInbound(env, request);
  const map = {};

  for (const item of Object.values(value)) {
    const row = item || {};
    const so = String(row.so_number || 'UNKNOWN').toUpperCase().trim();
    if (!map[so]) {
      map[so] = {
        so_number: so,
        artikel: row.artikel || '-',
        destination: row.destination || '-',
        lokasi: row.lokasi || '-',
        jenis: row.jenis || '-',
        total_cartons: 0,
        total_pcs: 0,
        sizes: new Set(),
        last_update: 0
      };
    }
    map[so].total_cartons += 1;
    map[so].total_pcs += Number(row.isi_karton) || 0;
    if (row.size) map[so].sizes.add(row.size);
    map[so].last_update = Math.max(map[so].last_update, Number(row.timestamp_in) || 0);
  }

  const data = Object.values(map)
    .map(row => ({ ...row, sizes: [...row.sizes] }))
    .sort((a, b) => b.last_update - a.last_update);

  return json({ success: true, data });
}

async function handlePlanning(env, request, segments) {
  const id = segments[1];

  if (request.method === 'GET' && !id) {
    const [planningValue, inboundValue] = await Promise.all([
      getPlanning(env, request),
      getInbound(env, request)
    ]);

    const inboundMap = {};
    for (const item of Object.values(inboundValue)) {
      const so = String(item?.so_number || '').toUpperCase().trim();
      if (so) inboundMap[so] = (inboundMap[so] || 0) + (Number(item?.isi_karton) || 0);
    }

    const data = Object.entries(planningValue).map(([key, item]) => {
      const row = item || {};
      const so = String(row.so_number || '').toUpperCase().trim();
      const target = Number(row.target_qty) || 0;
      const actual = inboundMap[so] || 0;
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
    const map = {};

    for (const [id, item] of Object.entries(value)) {
      const row = item || {};
      const so = String(row.so_number || 'UNKNOWN').toUpperCase().trim();
      if (!map[so]) {
        map[so] = {
          so,
          artikel: row.artikel || '-',
          destination: row.destination || '-',
          lokasi: row.lokasi || '-',
          items: []
        };
      }
      map[so].items.push({ id, ...row });
    }

    const data = Object.values(map).map(row => ({
      ...row,
      total_cartons: row.items.length,
      total_pcs: row.items.reduce((sum, item) => sum + (Number(item.isi_karton) || 0), 0)
    }));

    return json({ success: true, data });
  }

  if (request.method === 'POST' && ((segments[1] === 'execute' && segments[2]) || (segments[1] && segments[2] === 'execute'))) {
    const rawSo = segments[1] === 'execute' ? segments[2] : segments[1];
    const so = decodeURIComponent(rawSo).toUpperCase().trim();
    const value = await getInbound(env, request);
    const items = Object.entries(value)
      .filter(([, item]) => String(item?.so_number || '').toUpperCase().trim() === so)
      .map(([id, item]) => ({ id, ...(item || {}) }));

    if (!items.length) {
      return json({ success: false, message: 'No active inbound cartons found for this SO.' }, 404);
    }

    const first = items[0];
    const totalPcs = items.reduce((sum, item) => sum + (Number(item.isi_karton) || 0), 0);
    const historyKey = `export_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const history = {
      so_number: so,
      artikel: first.artikel || '-',
      destination: first.destination || '-',
      lokasi: first.lokasi || '-',
      total_cartons: items.length,
      total_pcs: totalPcs,
      export_date: new Date().toISOString().slice(0, 10),
      exported_by: 'WMS User',
      items
    };

    const updates = {
      [`export_history/${historyKey}`]: history
    };
    for (const item of items) updates[`stok_inbound_wh/${item.id}`] = null;

    await firebaseRequest(env, request, '', {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });

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
      return json({
        success: true,
        service: 'ppfg-wms-pages-function',
        status: 'ok',
        time: new Date().toISOString()
      });
    }

    const token = getToken(request);
    if (!token) return json({ success: false, message: 'Missing Bearer token.' }, 401);

    if (!dbUrl(env)) return json({ success: false, message: 'FIREBASE_DATABASE_URL is not configured.' }, 500);

    if (route === 'dashboard') return handleDashboard(env, request);
    if (route === 'inbound' || route.startsWith('inbound/')) return handleInbound(env, request, path);
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
