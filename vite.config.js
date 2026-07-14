import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: true, // exposes the server on local network IP address
    open: true  // auto opens the browser on server startup
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: false, // disable minification to build without extra esbuild/terser deps
    sourcemap: false
  }
});
