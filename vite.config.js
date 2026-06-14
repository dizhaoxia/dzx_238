import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5007,
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
