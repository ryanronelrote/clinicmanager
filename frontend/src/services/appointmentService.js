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

export const appointmentService = {
  getByWeek: (weekStart) => request(`/appointments?week=${weekStart}`),
  getByMonth: (monthStr) => request(`/appointments?month=${monthStr}`),
  getByClient: (clientId) => request(`/appointments?client_id=${clientId}`),
  getById: (id) => request(`/appointments/${id}`),
  create: (data) => request('/appointments', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) }),
  update: (id, data) => request(`/appointments/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) }),
  delete: (id) => request(`/appointments/${id}`, { method: 'DELETE' }),
  reschedule: (id, data) => request(`/appointments/${id}/reschedule`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) }),
  sendReminder: (id) => request(`/appointments/${id}/send-reminder`, { method: 'POST' }),
  checkConflicts: (date, startTime, duration, excludeId) => {
    let url = `/appointments/check-conflicts?date=${date}&start_time=${startTime}&duration=${duration}`;
    if (excludeId) url += `&exclude_id=${excludeId}`;
    return request(url);
  },
};
