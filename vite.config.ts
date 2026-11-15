import basicSsl from '@vitejs/plugin-basic-ssl';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// The version shown beside the logo. `package.json` is the one place it is
// written; the deploy workflow bumps it on every merge to main (see
// VERSIONING.md), so the git tag, the deployed build and the number on screen
// all say the same thing.
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

// The notices name the libraries we bundle and the versions we bundle, and the
// versions are read from what is installed rather than typed in — so they cannot
// go stale the next time a dependency is bumped.
function thirdPartyNotices(): string {
  return readFileSync('THIRD-PARTY-NOTICES.template.txt', 'utf8')
    .replace(/\{\{([a-z0-9-]+)\}\}/g, (_match, pkg: string) => {
      const meta = JSON.parse(readFileSync(`node_modules/${pkg}/package.json`, 'utf8')) as { version: string };
      return meta.version;
    });
}

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
      // written out here — after minification, where they survive. Mediabunny,
      // which the offline export brings in, is MPL-2.0, and its notice is meant
      // to travel with the copies made of it. They ship as a file beside the app
      // too, so they can be read without opening a minified bundle.
      name: 'demoshine-notices',
      apply: 'build',
      generateBundle(_options, bundle) {
        const notices = thirdPartyNotices();
        this.emitFile({ type: 'asset', fileName: 'THIRD-PARTY-NOTICES.txt', source: notices });
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
