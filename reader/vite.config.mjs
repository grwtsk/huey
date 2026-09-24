import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

// The repository itself is deliberately NOT the development server's root.
const root = fileURLToPath(new URL('.', import.meta.url));
export default ({ mode }) => ({
  root,
  base: mode === 'editorial' ? '/' : './',
  publicDir: 'generated-public',
  // Explicit editorial mode adds only the sanitized derived payload. Ordinary
  // publication builds never copy the editorial directory, even if it exists.
  plugins: mode === 'editorial' ? [{
    name: 'huey-editorial-traversal',
    configureServer(server) {
      server.middlewares.use('/data/traversal.json', (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; res.end(); return; }
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(req.method === 'HEAD' ? undefined : readFileSync(new URL('./generated-editorial/data/traversal.json', import.meta.url)));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'data/traversal.json',
        source: readFileSync(new URL('./generated-editorial/data/traversal.json', import.meta.url)) });
    }
  }] : [],
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    allowedHosts: ['localhost'],
    fs: { strict: true, allow: [root],
      // Preserve Vite 8.1's default sensitive-file exclusions, and prevent its
      // source-file server from bypassing the explicit editorial-mode endpoint.
      deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/generated-editorial/**'] },
    headers: { 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }
  },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false }
});
