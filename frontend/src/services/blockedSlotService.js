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

export const blockedSlotService = {
  getByWeek: (weekStart) => request(`/blocked-slots?week=${weekStart}`),
  getByMonth: (monthStr) => request(`/blocked-slots?month=${monthStr}`),
  create: (data) => request('/blocked-slots', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) }),
};
