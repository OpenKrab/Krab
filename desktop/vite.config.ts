import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html'
    }
  },
  server: {
    port: 3000,
    strictPort: true
  },
  base: './',
  publicDir: '.'
});
