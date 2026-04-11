import { authFetch } from '../authFetch';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function request(url, options) {
  const res = await authFetch(url, options);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Request failed');
  }
  return res.json();
}

export const staffService = {
  getAll:  ()     => request('/staff'),
  create:  (data) => request('/staff', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) }),
  delete:  (id)   => request(`/staff/${id}`, { method: 'DELETE' }),
};
