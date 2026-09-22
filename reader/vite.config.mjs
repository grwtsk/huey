import { fileURLToPath } from 'node:url';

// The repository itself is deliberately NOT the development server's root.
const root = fileURLToPath(new URL('.', import.meta.url));
export default {
  root,
  base: './',
  publicDir: 'generated-public',
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    allowedHosts: ['localhost'],
    fs: { strict: true, allow: [root] },
    headers: { 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }
  },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false }
};
