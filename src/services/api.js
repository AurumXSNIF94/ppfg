import { auth } from '../config/firebase';
import { getCache, setCache, enqueueMutation, isOffline } from './offlineStore';
import { syncOfflineQueue } from './offlineSync';

const API_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function cacheKey(path) {
  return `api:${path}`;
}

function absoluteUrl(path) {
  return `${API_URL}${path}`;
}

async function networkRequest(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('User is not authenticated.');

  const token = await user.getIdToken();
  const response = await fetch(absoluteUrl(path), {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `API request failed (${response.status})`);
  return payload;
}

function jsonBody(options) {
  if (!options.body) return undefined;
  try { return JSON.parse(options.body); } catch { return options.body; }
}

async function optimisticMutation(path, method, body) {
  const id = crypto.randomUUID();
  const now = Date.now();

  await enqueueMutation({
    id,
    url: absoluteUrl(path),
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {}
  });

  if (path === '/api/inbound' && method === 'POST') {
    const current = await getCache(cacheKey('/api/inbound')) || { success: true, data: [] };
    const payload = body || {};
    const cartons = Array.isArray(payload.cartons) ? payload.cartons : [payload];
    const created = cartons.map((carton, index) => ({
      id: `offline/${id}/${index}`,
      so_number: String(payload.so_number || '').toUpperCase(),
      artikel: String(payload.artikel || '').toUpperCase(),
      destination: String(payload.destination || '').toUpperCase(),
      size: String(carton.size || '').toUpperCase(),
      nomor_karton: String(carton.no_karton ?? carton.nomor_karton ?? '').toUpperCase().replace(/^#?/, ''),
      isi_karton: Number(carton.isi_karton ?? carton.qty) || 0,
      tanggal: payload.tanggal,
      keterangan: payload.keterangan || '',
      status: payload.status || 'INBOUND',
      timestamp_in: now,
      lastUpdate: now
    }));
    await setCache(cacheKey('/api/inbound'), { success: true, data: [...(current.data || []), ...created] });
    await patchDashboardCache(created);
    await patchSOListCache(created);
    for (const row of created) await patchSODetailCache(row);
  }

  if (path.startsWith('/api/inbound/') && (method === 'PATCH' || method === 'PUT')) {
    await patchInboundCache(path, body);
  }

  if (path.startsWith('/api/inbound/') && method === 'DELETE') {
    const current = await getCache(cacheKey('/api/inbound'));
    if (current?.data) {
      const idPart = decodeURIComponent(path.slice('/api/inbound/'.length));
      await setCache(cacheKey('/api/inbound'), {
        ...current,
        data: current.data.filter(row => row.id !== idPart)
      });
    }
  }

  if (path === '/api/export' || path === '/api/export/ready') {
    // Export queue is read-only; execution is handled below.
  }

  if (path.startsWith('/api/export/') && path.endsWith('/execute') && method === 'POST') {
    const so = decodeURIComponent(path.split('/')[3] || '');
    const ready = await getCache(cacheKey('/api/export/ready'));
    const row = ready?.data?.find(item => item.so === so);
    if (ready?.data) await setCache(cacheKey('/api/export/ready'), { ...ready, data: ready.data.filter(item => item.so !== so) });
    const history = await getCache(cacheKey('/api/export-history')) || { success: true, data: [] };
    if (row) {
      await setCache(cacheKey('/api/export-history'), {
        success: true,
        data: [{
          id: `offline/${id}`,
          so_number: row.so,
          artikel: row.artikel,
          destination: row.destination,
          total_cartons: row.total_cartons,
          total_pcs: row.total_pcs,
          export_date: new Date().toISOString(),
          status: 'EXPORTED'
        }, ...(history.data || [])]
      });
    }
  }

  return { success: true, offline: true, queued: true, transaction_id: id, data: [] };
}

async function patchDashboardCache(createdRows) {
  const key = cacheKey('/api/dashboard');
  const cached = await getCache(key);
  if (!cached?.data) return;
  const data = { ...cached.data, summary: { ...(cached.data.summary || {}) } };
  data.summary.totalKarton = (Number(data.summary.totalKarton) || 0) + createdRows.length;
  data.summary.totalQty = (Number(data.summary.totalQty) || 0) + createdRows.reduce((sum, row) => sum + Number(row.isi_karton || 0), 0);
  data.updatedAt = new Date().toISOString();
  await setCache(key, { ...cached, data });
}

async function patchSOListCache(createdRows) {
  const key = cacheKey('/api/so');
  const cached = await getCache(key);
  if (!cached?.data) return;
  const map = new Map(cached.data.map(row => [String(row.so_number).toUpperCase(), { ...row }]));
  for (const row of createdRows) {
    const so = String(row.so_number).toUpperCase();
    const current = map.get(so) || { so_number: so, artikel: row.artikel, destination: row.destination, total_cartons: 0, total_pcs: 0, sizes: [] };
    const sizes = new Set(current.sizes || []);
    if (row.size) sizes.add(row.size);
    map.set(so, {
      ...current,
      artikel: row.artikel || current.artikel,
      destination: row.destination || current.destination,
      total_cartons: Number(current.total_cartons || 0) + 1,
      total_pcs: Number(current.total_pcs || 0) + Number(row.isi_karton || 0),
      sizes: [...sizes]
    });
  }
  await setCache(key, { success: true, data: [...map.values()] });
}

function buildSODetailFromInbound(so, inboundPayload) {
  const wanted = String(so || '').toUpperCase().replace(/^SO_/, '').trim();
  const rows = (inboundPayload?.data || []).filter(row =>
    String(row?.so_number || '').toUpperCase().replace(/^SO_/, '').trim() === wanted
  );
  if (!rows.length) return null;
  const first = rows[0];
  const cartons = rows.map(row => ({ ...row, so_number: wanted, destination: String(row.destination || '-').toUpperCase() }));
  const sizes = [...new Set(cartons.map(row => row.size).filter(Boolean))];
  const totalPcs = cartons.reduce((sum, row) => sum + (Number(row.isi_karton) || 0), 0);
  return { success: true, data: {
    so_number: wanted,
    master: {
      tanggal: first.tanggal || new Date().toISOString().slice(0, 10),
      jenis: first.jenis || '-',
      artikel: first.artikel || '-',
      destination: String(first.destination || '-').toUpperCase(),
      keterangan: first.keterangan || '',
      status: first.status || 'INBOUND',
      terakhir_update: first.lastUpdate || first.timestamp_in || null
    },
    summary: { total_cartons: cartons.length, total_pcs: totalPcs, sizes },
    cartons
  }};
}

async function patchSODetailCache(row) {
  const key = cacheKey(`/api/so/${encodeURIComponent(row.so_number)}`);
  const cached = await getCache(key);
  if (!cached?.data) return;
  const data = { ...cached.data };
  data.so_number = row.so_number;
  data.master = {
    ...(data.master || {}),
    artikel: row.artikel || data.master?.artikel,
    destination: row.destination || data.master?.destination,
    tanggal: row.tanggal || data.master?.tanggal,
    terakhir_update: new Date().toISOString()
  };
  data.cartons = [...(data.cartons || []), row];
  data.summary = {
    ...(data.summary || {}),
    total_cartons: Number(data.summary?.total_cartons || 0) + 1,
    total_pcs: Number(data.summary?.total_pcs || 0) + Number(row.isi_karton || 0),
    sizes: [...new Set([...(data.summary?.sizes || []), row.size].filter(Boolean))]
  };
  await setCache(key, { success: true, data });
}

async function patchInboundCache(path, body) {
  const cached = await getCache(cacheKey('/api/inbound'));
  if (!cached?.data) return;
  const id = decodeURIComponent(path.slice('/api/inbound/'.length));
  await setCache(cacheKey('/api/inbound'), {
    ...cached,
    data: cached.data.map(row => row.id === id ? { ...row, ...(body || {}), lastUpdate: Date.now() } : row)
  });
}

async function queueOfflineMutation(path, method, body) {
  const item = await enqueueMutation({
    url: absoluteUrl(path),
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {}
  });
  void syncOfflineQueue();
  return { success: true, offline: true, queued: true, transaction_id: item.id, data: [] };
}

async function request(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const key = cacheKey(path);

  if (method === 'GET') {
    const cached = await getCache(key).catch(() => null);
    if (isOffline()) {
      if (cached !== null) return cached;
      throw new Error('You are offline and this data has not been cached on this device yet.');
    }

    try {
      const payload = await networkRequest(path, options);
      await setCache(key, payload).catch(() => {});
      return payload;
    } catch (error) {
      if (cached !== null) return cached;
      throw error;
    }
  }

  if (isOffline()) {
    return optimisticMutation(path, method, jsonBody(options));
  }

  try {
    const payload = await networkRequest(path, options);
    void syncOfflineQueue();
    return payload;
  } catch (error) {
    // Only queue genuine transport failures. HTTP 4xx/5xx responses are real
    // server responses and must remain visible to the user.
    if (error instanceof TypeError || /Failed to fetch|NetworkError|Load failed|network/i.test(error.message || '')) {
      return optimisticMutation(path, method, jsonBody(options));
    }
    throw error;
  }
}

export async function warmOfflineCache() {
  const jobs = [
    () => api.dashboard(),
    () => api.inbound.list(),
    () => api.so.list(),
    () => api.export.ready(),
    () => api.exportHistory()
  ];
  const results = await Promise.allSettled(jobs.map(job => job()));
  return { cached: results.filter(result => result.status === 'fulfilled').length, total: jobs.length };
}

export const api = {
  health: () => fetch(absoluteUrl('/api/health'), { cache: 'no-store' }).then(async response => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `Health check failed (${response.status})`);
    return payload;
  }),
  dashboard: () => request('/api/dashboard'),
  warehouseSummary: {
    get: () => request('/api/warehouse-summary'),
    rebuild: () => request('/api/warehouse-summary/rebuild', { method: 'POST' })
  },
  inbound: {
    list: () => request('/api/inbound'),
    create: payload => request('/api/inbound', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/api/inbound/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    remove: id => request(`/api/inbound/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
  so: {
    list: () => request('/api/so'),
    detail: async so => {
      const path = '/api/so/' + encodeURIComponent(so);
      try {
        return await request(path);
      } catch (error) {
        if (isOffline()) {
          const inbound = await getCache(cacheKey('/api/inbound'));
          const derived = buildSODetailFromInbound(so, inbound);
          if (derived) {
            await setCache(cacheKey(path), derived).catch(() => {});
            return derived;
          }
        }
        throw error;
      }
    }
  },
  export: {
    ready: () => request('/api/export/ready'),
    execute: so => request(`/api/export/${encodeURIComponent(so)}/execute`, { method: 'POST' })
  },
  exportHistory: () => request('/api/export-history'),
  gas: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const action = String(params.action || '').toLowerCase();
    if (action === 'start-sync' || action === 'stop-sync') {
      if (isOffline()) return Promise.reject(new Error('WMS Auto Sync actions require an internet connection.'));
      return networkRequest('/api/gas' + (query ? '?' + query : ''));
    }
    return request('/api/gas' + (query ? '?' + query : ''));
  }
};
