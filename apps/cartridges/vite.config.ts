import { defineConfig } from 'vite';

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

const configuredHost = process.env.CARTRIDGE_ALLOWED_HOST?.trim();
const allowedHosts = configuredHost ? [configuredHost] : ['localhost', '127.0.0.1'];

export default defineConfig({
  base: process.env.CARTRIDGE_BASE_PATH?.trim() || '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    host: '0.0.0.0',
    port: 6342,
    strictPort: true,
    allowedHosts,
    headers: isolationHeaders,
  },
  preview: {
    host: '0.0.0.0',
    port: 6342,
    strictPort: true,
    allowedHosts,
    headers: isolationHeaders,
  },
  worker: {
    format: 'es',
  },
});
