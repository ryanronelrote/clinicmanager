import { authFetch } from '../authFetch';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function request(url, options) {
  const res = await authFetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error = new Error(err.error || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export const clientService = {
  getAll: () => request('/clients'),
  getById: (id) => request(`/clients/${id}`),
  create: (data) => request('/clients', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) }),
  update: (id, data) => request(`/clients/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) }),
  bulkImport: (clients) => request('/clients/bulk', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ clients }) }),
};
