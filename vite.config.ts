import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

// `--mode https` serves over TLS with a self-signed certificate, via the
// dev:https / preview:https scripts. Everything else is a normal HTTP server.
export default defineConfig(({ mode }) => ({
  // Relative asset URLs, so the build works from any base path
  // (localhost root, a GitHub Pages project page, a custom domain).
  base: './',
  plugins: mode === 'https' ? [basicSsl()] : [],
  server: { port: 5173 },
  preview: { port: 5173 },
  build: { outDir: 'dist', emptyOutDir: true },
}));
