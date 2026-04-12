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

export const invoiceService = {
  getAll:      (params) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.patient_id) qs.set('patient_id', params.patient_id);
    if (params?.from_date) qs.set('from_date', params.from_date);
    if (params?.to_date) qs.set('to_date', params.to_date);
    const q = qs.toString();
    return request(`/invoices${q ? '?' + q : ''}`);
  },
  getById:     (id) => request(`/invoices/${id}`),
  create:      (data) => request('/invoices', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) }),
  updateItems: (id, items) => request(`/invoices/${id}/items`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ items }) }),
  addPayment:  (id, data) => request(`/invoices/${id}/payments`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) }),
  markPaid:    (id, receivedBy, paymentDate) =>
    request(`/invoices/${id}/mark-paid`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        received_by: receivedBy,
        ...(paymentDate ? { payment_date: paymentDate } : {}),
      }),
    }),
  updateNotes: (id, notes) =>
    request(`/invoices/${id}/notes`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ notes }) }),
  updateInvoiceDate: (id, invoiceDate) =>
    request(`/invoices/${id}/invoice-date`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ invoice_date: invoiceDate }),
    }),
  listPayments: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.from_date) qs.set('from_date', params.from_date);
    if (params.to_date)   qs.set('to_date',   params.to_date);
    const q = qs.toString();
    return request(`/invoices/payments${q ? '?' + q : ''}`);
  },
  delete:      (id) => request(`/invoices/${id}`, { method: 'DELETE' }),
  getStats:    () => request('/invoices/stats'),
};
