import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Portable build: assets are emitted with relative paths so the bundled
// frontend works both from the Tauri custom protocol and from a static server.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: 'dist',
    target: 'chrome110',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
  server: { port: 5183 },
});
