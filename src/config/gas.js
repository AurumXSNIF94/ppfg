const GAS_API_URL = import.meta.env.VITE_GAS_API_URL || '';

export function getGasApiUrl() {
  return GAS_API_URL.replace(/\/$/, '');
}

async function request(params = '') {
  const base = getGasApiUrl();
  if (!base) throw new Error('VITE_GAS_API_URL belum diatur.');
  const response = await fetch(`${base}${params}`, { method: 'GET', cache: 'no-store' });
  if (!response.ok) throw new Error(`GAS HTTP ${response.status}`);
  return response.json();
}

export function lookupSO(so) {
  return request(`?so=${encodeURIComponent(so)}`);
}

export function syncCartons(payload) {
  if (!Array.isArray(payload) || payload.length === 0) return Promise.resolve({ success: true, updated: 0 });
  return request(`?action=sync&payload=${encodeURIComponent(JSON.stringify(payload))}`);
}

export function getSyncStatus() {
  return request('?action=status');
}

export function startSync() {
  return request('?action=start-sync');
}

export function stopSync() {
  return request('?action=stop-sync');
}
