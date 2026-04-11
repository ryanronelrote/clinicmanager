import { authFetch } from '../authFetch';

async function request(url) {
  const res = await authFetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error = new Error(err.error || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export function getKpi({ startDate, endDate }) {
  const q = new URLSearchParams({ startDate, endDate });
  return request(`/api/dashboard/kpi?${q}`);
}
