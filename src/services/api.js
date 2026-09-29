import { auth } from '../config/firebase';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

async function request(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('User is not authenticated.');

  const token = await user.getIdToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `API request failed (${response.status})`);
  return payload;
}

export const api = {
  dashboard: () => request('/api/dashboard'),
  inbound: {
    list: () => request('/api/inbound'),
    create: (payload) => request('/api/inbound', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) => request(`/api/inbound/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    remove: (id) => request(`/api/inbound/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
  exportHistory: () => request('/api/export-history'),
  gas: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/gas${query ? `?${query}` : ''}`);
  }
};
