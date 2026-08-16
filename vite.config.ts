import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages serves the site from /D-C/, while Vercel serves it from
  // the domain root. Keep both deployment targets working from one build.
  base: process.env.VERCEL ? '/' : '/D-C/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    // Target modern browsers for smaller output
    target: 'es2020',
    // Use lightningcss for faster CSS minification
    cssMinify: 'lightningcss',
    // Inline CSS into HTML (total CSS is ~10KB, saves a render-blocking request)
    cssCodeSplit: false,
    // Inline assets < 4KB as base64 (saves HTTP requests for small images)
    assetsInlineLimit: 4096,
    // Manual chunk splitting for parallel loading & better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate heavy libs into their own chunks for parallel download
          'vendor-react': ['react', 'react-dom'],
          // hls.js is NOT listed here — it's dynamically imported via import('hls.js')
          // so Vite code-splits it automatically without modulepreloading it
          'vendor-motion': ['motion'],
        },
      },
    },
    // Reduce chunk size warnings threshold
    chunkSizeWarningLimit: 500,
    // Disable source maps in production for smaller bundles
    sourcemap: false,
  },
});
