import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize chunk size and splitting
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Separate vendor libraries
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('@radix-ui')) {
              return 'vendor-ui';
            }
            if (id.includes('remotion') || id.includes('@remotion')) {
              return 'vendor-remotion';
            }
            if (id.includes('@dagrejs/dagre')) {
              return 'vendor-viz';
            }
            return 'vendor-other';
          }

          // Separate large pipeline modules
          if (id.includes('/src/pipeline/') || id.includes('/src/transcription/') || id.includes('/src/analysis/')) {
            return 'pipeline-core';
          }
          if (id.includes('/src/visualization/') || id.includes('/src/remotion/')) {
            return 'pipeline-viz';
          }
        }
      },
      external: (id) => {
        // Mark Node.js modules as external for better browser compatibility
        if (mode === 'production') {
          return ['path', 'fs', 'os', 'util', 'assert'].some(nodeModule =>
            id === nodeModule || id.startsWith(`${nodeModule}/`)
          );
        }
        return false;
      }
    },
    // Enable source maps for debugging in production
    sourcemap: mode === 'development',
    // Optimize for modern browsers
    target: 'es2020'
  },
  optimizeDeps: {
    // Pre-bundle large dependencies
    include: [
      'react',
      'react-dom',
      '@remotion/captions',
      '@dagrejs/dagre'
    ],
    // Exclude problematic Node.js dependencies from optimization
    exclude: [
      'whisper-node',
      'kuromoji'
    ]
  },
  define: {
    // Polyfills for Node.js globals in browser
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(mode)
  }
}));
