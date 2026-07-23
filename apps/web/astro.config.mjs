import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  build: {
    format: 'directory'
  },
  vite: {
    server: {
      host: true,
      allowedHosts: ['localhost', '127.0.0.1']
    },
    optimizeDeps: {
      include: []
    },
 
    build: {
      rollupOptions: {
        external: []
      }
    }
  }
});
