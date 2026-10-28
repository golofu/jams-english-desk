import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * `npm run dev` = Vite (hot reload) + `wrangler dev` for the Worker on :8787.
 * Login, data and AI calls are proxied there, so the browser talks to one origin.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      '/auth': 'http://127.0.0.1:8787',
    },
  },
});
