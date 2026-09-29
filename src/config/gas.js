const GAS_API_URL = import.meta.env.VITE_GAS_API_URL || '';

export function getGasApiUrl() {
  return GAS_API_URL.replace(/\/$/, '');
}

export async function lookupSO(so) {
  const base = getGasApiUrl();
  if (!base) throw new Error('VITE_GAS_API_URL belum diatur.');

  const url = `${base}?so=${encodeURIComponent(so)}`;
  const response = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!response.ok) throw new Error(`GAS HTTP ${response.status}`);
  return response.json();
}

export async function syncCartons(payload) {
  const base = getGasApiUrl();
  if (!base) throw new Error('VITE_GAS_API_URL belum diatur.');
  if (!Array.isArray(payload) || payload.length === 0) {
    return { success: true, updated: 0 };
  }

  const url = `${base}?action=sync&payload=${encodeURIComponent(JSON.stringify(payload))}`;
  const response = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!response.ok) throw new Error(`GAS HTTP ${response.status}`);
  return response.json();
}
