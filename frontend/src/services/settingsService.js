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

export const settingsService = {
  getAll: () => request('/settings'),
  save: (data) => request('/settings', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) }),
  getEmailConfig: () => request('/settings/email'),
  saveEmailConfig: (data) => request('/settings/email', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) }),
  sendTestEmail: (to) => request('/settings/email/test', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ to }) }),
  getEmailTemplates: () => request('/settings/email-templates'),
  saveEmailTemplates: (data) => request('/settings/email-templates', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) }),
};
