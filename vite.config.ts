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
  plugins: [
    ...(mode === 'http' ? [] : [basicSsl()]),
    {
      // `version.json` says which version the deployment is serving, for the app
      // to compare its own against and offer a reload when a newer build is out
      // (see src/ui/version.ts). Written for the build only: under the dev
      // server there is no deployment that could be newer.
      name: 'demoshine-version',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) });
      },
    },
    {
      // Carry the licences of what we bundle. Vite's minifier drops every comment
      // and does not take esbuild's `legalComments` for it, so the notices are
      // appended here — after minification, where they survive. Mediabunny, which
      // the offline export brings in, is MPL-2.0, and its notice is meant to
      // travel with the copies made of it. public/THIRD-PARTY-NOTICES.txt is the
      // readable version, and ships beside the app as well.
      name: 'demoshine-notices',
      apply: 'build',
      generateBundle(_options, bundle) {
        const notices = readFileSync('public/THIRD-PARTY-NOTICES.txt', 'utf8');
        for (const file of Object.values(bundle)) {
          if (file.type === 'chunk') file.code += '\n/*!\n' + notices + '*/\n';
        }
      },
    },
  ],
  server: { port: 5173 },
  preview: { port: 5173 },
  build: { outDir: 'dist', emptyOutDir: true },
}));
