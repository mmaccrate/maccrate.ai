import { defineConfig } from 'astro/config';

export default defineConfig({
  base: process.env.MIRA_BASE_PATH || '/',
  devToolbar: {
    enabled: false
  },
  output: 'static',
  build: {
    format: 'directory'
  },
  vite: {
    server: {
      host: true,
      allowedHosts: ['localhost', '127.0.0.1']
    }
  }
});
