import basicSsl from '@vitejs/plugin-basic-ssl';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// The version shown beside the logo. `package.json` is the one place it is
// written; the deploy workflow bumps it on every merge to main (see
// VERSIONING.md), so the git tag, the deployed build and the number on screen
// all say the same thing.
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

// HTTPS is on by default, using a self-signed certificate from
// @vitejs/plugin-basic-ssl. Browsers warn until it is trusted, and the service
// worker will not register on an untrusted certificate. Serve plain HTTP with
// `--mode http` (npm run dev:http / preview:http).
export default defineConfig(({ mode }) => ({
  // Relative asset URLs, so the build works from any base path
  // (localhost root, a GitHub Pages project page, a custom domain).
  base: './',
  // Baked into the bundle so the app can show which build it is (src/ui/version.ts).
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: mode === 'http' ? [] : [basicSsl()],
  server: { port: 5173 },
  preview: { port: 5173 },
  build: { outDir: 'dist', emptyOutDir: true },
}));
