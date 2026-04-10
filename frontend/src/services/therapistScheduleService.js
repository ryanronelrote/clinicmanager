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

export const therapistScheduleService = {
  // Schedule
  getMonthly:      (month) => request(`/therapist-schedules?month=${month}`),
  upsert:          (data)  => request('/therapist-schedules', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) }),
  remove:          (therapistId, date) => request('/therapist-schedules', { method: 'DELETE', headers: JSON_HEADERS, body: JSON.stringify({ therapist_id: therapistId, date }) }),
  // Therapists
  getTherapists:   ()      => request('/therapist-schedules/therapists'),
  addTherapist:    (name)  => request('/therapist-schedules/therapists', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name }) }),
  removeTherapist: (id)    => request(`/therapist-schedules/therapists/${id}`, { method: 'DELETE' }),
};
