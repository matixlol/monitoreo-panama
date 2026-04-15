import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const root = resolve(__dirname);

const debugRouteAlias = () => {
  const rewriteDebugRoute = (req, _res, next) => {
    if (req.url === '/debug') req.url = '/debug/';
    next();
  };

  return {
    name: 'debug-route-alias',
    configureServer(server) {
      server.middlewares.use(rewriteDebugRoute);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewriteDebugRoute);
    },
  };
};

export default defineConfig({
  root,
  publicDir: false,
  plugins: [react(), debugRouteAlias()],
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        debug: resolve(root, 'debug/index.html'),
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
