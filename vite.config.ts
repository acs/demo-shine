import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

// HTTPS is on by default, using a self-signed certificate from
// @vitejs/plugin-basic-ssl. Browsers warn until it is trusted, and the service
// worker will not register on an untrusted certificate. Serve plain HTTP with
// `--mode http` (npm run dev:http / preview:http).
export default defineConfig(({ mode }) => ({
  // Relative asset URLs, so the build works from any base path
  // (localhost root, a GitHub Pages project page, a custom domain).
  base: './',
  plugins: mode === 'http' ? [] : [basicSsl()],
  server: { port: 5173 },
  preview: { port: 5173 },
  build: { outDir: 'dist', emptyOutDir: true },
}));
