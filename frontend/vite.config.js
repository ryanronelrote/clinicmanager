import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function apiProxy(target) {
  return {
    target,
    bypass(req) {
      if (req.headers.accept?.includes('text/html')) return req.url;
    },
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/clients':       apiProxy('http://localhost:3001'),
      '/appointments':  apiProxy('http://localhost:3001'),
      '/blocked-slots': apiProxy('http://localhost:3001'),
      '/inventory':     apiProxy('http://localhost:3001'),
      '/settings':      apiProxy('http://localhost:3001'),
      '/settings/email': apiProxy('http://localhost:3001'),
      '/services':      apiProxy('http://localhost:3001'),
    },
  },
});
