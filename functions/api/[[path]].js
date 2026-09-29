import { getWarehouseSummary, rebuildWarehouseSummary, syncWarehouseSummary } from '../warehouseSummary.js';

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
  const { query = {}, ...fetchInit } = init || {};
  const url = new URL(`${dbUrl(env)}/${cleanPath}.json`);
  url.searchParams.set('auth', token);
  for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, String(value));

  let response;
  let text = '';
  let data = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(url, {
      ...fetchInit,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {})
      }
    });
    text = await response.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    if (response.ok) return data;

    // Firebase can transiently return 502/503/504. Retry before failing the API request.
    if (![502, 503, 504].includes(response.status) || attempt === 2) break;
    await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
  }

  const message = typeof data === 'object' && data?.error
    ? data.error
    : `Firebase request failed (${response?.status || 500})`;
  throw new HttpError(response?.status || 500, message);
}

function todayISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
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

function normalizeCartonNumber(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  const match = raw.match(/(?:KARTON|CARTON|CTN)[ _-]*(\d+)/i) || raw.match(/^#?\s*(\d+)$/) || raw.match(/\d+/);
  return match ? match[1] : raw.replace(/^#/, '').trim();
}

function extractCartonNumber(value) {
  if (!value || typeof value !== 'object') return undefined;
  const preferred = [
    'nomor_karton','no_karton','noKarton','nomorKarton','no_carton','noCarton',
    'carton_no','cartonNo','carton_number','cartonNumber','carton_id','cartonId',
    'ctn_no','ctnNo','ctn_number','ctnNumber','No. Karton','No Karton',
    'NOMOR KARTON','NO KARTON'
  ];
  for (const key of preferred) {
    if (value[key] !== undefined && value[key] !== null && String(value[key]).trim() !== '') {
      return value[key];
    }
  }

  const entries = Object.entries(value);
  for (const [key, val] of entries) {
    const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
      normalized === 'nomorkarton' ||
      normalized === 'nokarton' ||
      normalized === 'cartonno' ||
      normalized === 'cartonnumber' ||
      normalized === 'cartonid' ||
      normalized === 'ctnno' ||
      normalized === 'ctnnumber' ||
      normalized.includes('nomorkarton') ||
      normalized.includes('nokarton') ||
      normalized.includes('cartonno') ||
      normalized.includes('cartonnumber')
    ) {
      if (val !== undefined && val !== null && String(val).trim() !== '') return val;
    }
  }

  // Some legacy records store the carton number one level deeper.
  for (const [, val] of entries) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const nested = extractCartonNumber(val);
      if (nested !== undefined) return nested;
    }
  }

  return undefined;
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
    destination: clean(row.destination ?? row.destinasi ?? row.Destination ?? row.dest ?? master.destination)?.toUpperCase(),
    jenis: clean(row.jenis ?? row.type ?? row.carton_type ?? master.jenis ?? master.type),
    size: clean(row.size ?? row.ukuran ?? row.Size),
    nomor_karton: normalizeCartonNumber(extractCartonNumber(row) ?? context.cartonKey),
    isi_karton: Number(row.isi_karton ?? row.qty ?? row.quantity ?? row.qty_pcs ?? row.jumlah ?? row.total_qty) || 0,
    tanggal: clean(row.tanggal ?? master.tanggal) || todayISO(),
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
          ...normalizeStoredInbound(carton, { soKey: topKey, master, cartonKey })
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
    const key = normalizeSO(row.so_number || row.so_key) || '-';
    if (!bySO.has(key)) {
      bySO.set(key, {
        so: key,
        artikel: row.artikel || '-',
        destination: String(row.destination || '-').toUpperCase(),
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


function summaryKey(value) {
  const bytes = new TextEncoder().encode(String(value ?? ''));
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function summaryIncrement(delta) {
  return { '.sv': { increment: Number(delta) || 0 } };
}

function activeRowsForSO(topKey, node) {
  if (!node || typeof node !== 'object') return [];
  return flattenInbound({ [topKey]: node }).filter(row => !row._emptySO);
}

async function getInbound(env, request) {
  const value = await firebaseRequest(env, request, 'stok_inbound_wh');
  return value && typeof value === 'object' ? value : {};
}

async function getDashboardInbound(env, request) {
  // Dashboard only needs the list of SO nodes first. Reading the whole RTDB
  // subtree in one request can exceed the upstream response limit, so always
  // discover top-level SO keys with shallow=true and fetch each SO separately.
  const keys = await firebaseRequest(env, request, 'stok_inbound_wh', {
    method: 'GET',
    query: { shallow: 'true' }
  });

  const entries = Object.keys(keys || {});
  const values = [];

  // Keep Firebase concurrency bounded so a large warehouse dataset does not
  // create a burst of simultaneous requests from the Pages Function.
  const concurrency = 6;
  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);
    const batchValues = await Promise.all(batch.map(async key => {
      try {
        return [key, await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(key)}`)];
      } catch (error) {
        console.warn('[PPFG Dashboard] SO read skipped:', key, error?.message || error);
        return [key, null];
      }
    }));
    values.push(...batchValues);
  }

  return Object.fromEntries(values.filter(([, value]) => value !== null));
}

function normalizeSO(value) {
  return String(value || '').toUpperCase().trim().replace(/^SO_/, '');
}

async function getPlanning(env, request) {
  const value = await firebaseRequest(env, request, 'so_planning');
  return value && typeof value === 'object' ? value : {};
}

async function getPlanningActualMap(env, request, planningValue) {
  const summary = await getWarehouseSummary(env, request);
  const map = new Map();
  for (const row of Object.values(summary?.by_so || {})) {
    const so = normalizeSO(row?.so_number);
    if (so) map.set(so, Number(row?.qty) || 0);
  }
  return map;
}

async function getHistory(env, request) {
  const value = await firebaseRequest(env, request, 'export_history');
  return value && typeof value === 'object' ? value : {};
}

async function ensureWarehouseSummary(env, request) {
  const existing = await getWarehouseSummary(firebaseRequest, env, request);
  if (existing && existing.version === 1) return existing;

  const source = await getInbound(env, request);
  const rows = flattenInbound(source);
  return rebuildWarehouseSummary(firebaseRequest, env, request, rows);
}

function summaryRows(summary, group, limit = 20) {
  return Object.values(summary?.[group] || {})
    .filter(Boolean)
    .sort((a, b) => (Number(b.qty) || 0) - (Number(a.qty) || 0))
    .slice(0, limit);
}

async function handleDashboard(env, request) {
  const summary = await ensureWarehouseSummary(env, request);
  let planningValue = {};
  try {
    planningValue = await getPlanning(env, request);
  } catch (error) {
    console.warn('[PPFG Dashboard] Planning read skipped:', error?.message || error);
  }

  const bySO = Object.values(summary.by_so || {});
  const activeCartons = Number(summary.meta?.totalKarton) || 0;
  const totalQty = Number(summary.meta?.totalQty) || 0;
  const destinationStats = summaryRows(summary, 'by_destination', 10);
  const articleStats = summaryRows(summary, 'by_article', 10);
  const sizeStats = summaryRows(summary, 'by_size', 15);
  const planningActualBySO = new Map(
    bySO.map(row => [normalizeSO(row.so_number), Number(row.qty) || 0])
  );

  const planning = Object.values(planningValue || {}).map(item => {
    const row = item || {};
    const so = normalizeSO(row.so_number);
    const target = Number(row.target_qty) || 0;
    const actual = planningActualBySO.get(so) || 0;
    return {
      so_number: so,
      artikel: String(row.artikel || '-').toUpperCase(),
      target_qty: target,
      actual_qty: actual,
      shortage: Math.max(target - actual, 0),
      percentage: target ? Math.min(Math.round((actual / target) * 100), 100) : 0,
      status: target && actual >= target ? 'COMPLETED' : 'IN_PROGRESS'
    };
  }).sort((a, b) => b.target_qty - a.target_qty);

  const totalTarget = planning.reduce((sum, row) => sum + row.target_qty, 0);
  const totalActual = planning.reduce((sum, row) => sum + row.actual_qty, 0);
  const completedPlanning = planning.filter(row => row.status === 'COMPLETED').length;

  const recentSO = bySO
    .map(row => ({
      so: normalizeSO(row.so_number),
      artikel: row.artikel || '-',
      destination: String(row.destination || '-').toUpperCase(),
      jenis: row.jenis || '-',
      karton: Number(row.karton) || 0,
      qty: Number(row.qty) || 0,
      sizes: Array.isArray(row.sizes) ? row.sizes : [],
      lastUpdate: row.last_update || 0
    }))
    .sort((a, b) => Number(b.lastUpdate || 0) - Number(a.lastUpdate || 0))
    .slice(0, 20);

  return json({
    success: true,
    data: {
      summary: {
        totalSO: Number(summary.meta?.totalSO) || bySO.length,
        totalKarton: activeCartons,
        totalQty,
        totalArticles: Object.keys(summary.by_article || {}).length,
        totalDestinations: Object.keys(summary.by_destination || {}).length,
        avgQtyPerSO: bySO.length ? Math.round(totalQty / bySO.length) : 0
      },
      recentSO,
      destinationStats,
      articleStats,
      sizeStats,
      planning: {
        rows: planning.slice(0, 12),
        totalTarget,
        totalActual,
        totalShortage: Math.max(totalTarget - totalActual, 0),
        completionRate: totalTarget ? Math.min(Math.round((totalActual / totalTarget) * 100), 100) : 0,
        completed: completedPlanning,
        total: planning.length
      },
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

    const afterNode = await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(targetSOKey)}`);
    await syncWarehouseSummary(
      firebaseRequest,
      env,
      request,
      activeRowsForSO(targetSOKey, existing),
      activeRowsForSO(targetSOKey, afterNode)
    );
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
      const beforeRows = activeRowsForSO(topKey, existingSO);
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
      const afterSO = await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(topKey)}`);
      await syncWarehouseSummary(firebaseRequest, env, request, beforeRows, activeRowsForSO(topKey, afterSO));
      return json({ success: true, data: { id, ...normalizeStoredInbound(value, { soKey: topKey, master: afterSO?.informasi_master || master }) } });
    }

    const body = await request.json().catch(() => ({}));
    const patch = normalizeInbound(body);
    const beforeValue = await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(id)}`);
    await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...patch, timestamp_in: Date.now() })
    });
    const value = await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(id)}`);
    if (!value) return json({ success: false, message: 'Inbound record not found.' }, 404);
    await syncWarehouseSummary(firebaseRequest, env, request, [normalizeStoredInbound(beforeValue, { soKey: id })], [normalizeStoredInbound(value, { soKey: id })]);
    return json({ success: true, data: { id, ...value } });
  }

  if (method === 'DELETE' && id) {
    const parts = id.split('/');
    if (parts.length >= 2) {
      const topKey = parts[0];
      const cartonKey = parts.slice(1).join('/');
      const parent = await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(topKey)}`);
      if (isNestedSO(parent)) {
        const beforeRows = activeRowsForSO(topKey, parent);
        await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(topKey)}/karton/${encodeURIComponent(cartonKey)}`, { method: 'DELETE' });
        const afterParent = await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(topKey)}`);
        await syncWarehouseSummary(firebaseRequest, env, request, beforeRows, activeRowsForSO(topKey, afterParent));
        return json({ success: true, id });
      }
    }

    const current = await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(id)}`);
    if (!current) return json({ success: false, message: 'Inbound record not found.' }, 404);
    await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await syncWarehouseSummary(firebaseRequest, env, request, [normalizeStoredInbound(current, { soKey: id })], []);
    return json({ success: true, id });
  }

  return json({ success: false, message: 'Inbound route not found.' }, 404);
}

async function handleSO(env, request) {
  const summary = await ensureWarehouseSummary(env, request);
  const data = Object.values(summary.by_so || {}).map(row => ({
    so_number: normalizeSO(row.so_number),
    artikel: row.artikel || '-',
    destination: String(row.destination || '-').toUpperCase(),
    jenis: row.jenis || '-',
    total_cartons: Number(row.karton) || 0,
    total_pcs: Number(row.qty) || 0,
    sizes: Array.isArray(row.sizes) ? row.sizes : [],
    last_update: row.last_update || null
  })).sort((a, b) => String(a.so_number).localeCompare(String(b.so_number), undefined, { numeric: true }));

  return json({ success: true, data });
}

async function handleSODetail(env, request, soParam) {
  const so = String(soParam || '').toUpperCase().replace(/^SO_/, '').trim();
  if (!so) return json({ success: false, message: 'SO number is required.' }, 400);

  const topKey = soKey(so);
  const parent = await firebaseRequest(env, request, `stok_inbound_wh/${encodeURIComponent(topKey)}`);

  if (isNestedSO(parent)) {
    const master = parent.informasi_master || {};
    const cartons = Object.entries(parent.karton || {}).map(([id, item]) => ({
      id: `${topKey}/${id}`,
      ...normalizeStoredInbound(item, { soKey: topKey, master, cartonKey: id }),
      carton_key: id
    }));

    const sizes = [...new Set(cartons.map(item => item.size).filter(Boolean))];
    const totalPcs = cartons.reduce((sum, item) => sum + (Number(item.isi_karton) || 0), 0);
    const inferredJenis = clean(master.jenis || master.type || '') || (sizes.length > 1 ? 'MIX' : 'SOLID');

    return json({
      success: true,
      data: {
        so_number: so,
        master: {
          tanggal: clean(master.tanggal) || todayISO(),
          jenis: inferredJenis.toUpperCase(),
          artikel: clean(master.artikel) || '-',
          destination: clean(master.destination || master.destinasi || '').toUpperCase() || '-',
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

  const rows = flattenInbound({ [topKey]: parent }).filter(row =>
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
        tanggal: first.tanggal || todayISO(),
        jenis: first.jenis || '-',
        artikel: first.artikel || '-',
        destination: String(first.destination || '-').toUpperCase(),
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
    const planningValue = await getPlanning(env, request);
    const summary = await ensureWarehouseSummary(env, request);
    const actualBySO = new Map(
      Object.values(summary.by_so || {}).map(row => [normalizeSO(row.so_number), Number(row.qty) || 0])
    );

    const data = Object.entries(planningValue).map(([key, item]) => {
      const row = item || {};
      const so = normalizeSO(row.so_number);
      const target = Number(row.target_qty) || 0;
      const actual = actualBySO.get(so) || 0;
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
    const so = normalizeSO(body.so_number);
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
    const summary = await ensureWarehouseSummary(env, request);
    const data = Object.values(summary.by_so || {}).map(row => ({
      so: normalizeSO(row.so_number),
      artikel: row.artikel || '-',
      destination: String(row.destination || '-').toUpperCase(),
      items: [],
      total_cartons: Number(row.karton) || 0,
      total_pcs: Number(row.qty) || 0
    })).sort((a, b) => String(a.so).localeCompare(String(b.so), undefined, { numeric: true }));

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
        destination: String(master.destination || '-').toUpperCase(),
        total_cartons: items.length,
        total_pcs: totalPcs,
        export_date: new Date().toISOString().slice(0, 10),
        exported_by: 'WMS User',
        items
      };

      const updates = { [`export_history/${historyKey}`]: history, [`stok_inbound_wh/${topKey}`]: null };
      await firebaseRequest(env, request, '', { method: 'PATCH', body: JSON.stringify(updates) });
      await syncWarehouseSummary(firebaseRequest, env, request, items, []);
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
    await syncWarehouseSummary(firebaseRequest, env, request, rows, []);
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
    if (route === 'warehouse-summary' && request.method === 'GET') {
      const summary = await ensureWarehouseSummary(env, request);
      return json({ success: true, data: summary });
    }
    if (route === 'warehouse-summary/rebuild' && request.method === 'POST') {
      const source = await getInbound(env, request);
      const summary = await rebuildWarehouseSummary(firebaseRequest, env, request, flattenInbound(source));
      return json({ success: true, data: summary });
    }
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
