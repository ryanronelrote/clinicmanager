export function authFetch(url, options = {}) {
  const token = localStorage.getItem('clinic_token');
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(url, { ...options, headers });
}
