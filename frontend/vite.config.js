import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/clients': 'http://localhost:3001',
      '/appointments': 'http://localhost:3001',
      '/blocked-slots': 'http://localhost:3001',
    },
  },
});
