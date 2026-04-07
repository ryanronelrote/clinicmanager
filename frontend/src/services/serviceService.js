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

export const serviceService = {
  getAll: () => request('/services'),
  create: (data) => request('/services', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) }),
  delete: (id) => request(`/services/${id}`, { method: 'DELETE' }),
};
