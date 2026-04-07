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

export const inventoryService = {
  getAll: () => request('/inventory'),
  getById: (id) => request(`/inventory/${id}`),
  create: (data) => request('/inventory', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) }),
  update: (id, data) => request(`/inventory/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) }),
  addStock: (id, data) => request(`/inventory/${id}/add-stock`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) }),
  removeStock: (id, data) => request(`/inventory/${id}/remove-stock`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) }),
  getMovements: (id) => request(`/inventory/${id}/movements`),
};
