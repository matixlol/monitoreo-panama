import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const root = resolve(__dirname);

export default defineConfig({
  root,
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        embed: resolve(root, 'visualizaciones-panama.jsx'),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'embed' ? 'visualizaciones-panama.js' : 'assets/[name]-[hash].js'),
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
