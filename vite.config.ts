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
            if (id.includes('@radix-ui')) {
              return 'vendor-ui';
            }
            if (id.includes('remotion') || id.includes('@remotion')) {
              return 'vendor-remotion';
            }
            if (id.includes('@dagrejs/dagre')) {
              return 'vendor-viz';
            }
            // Merge react and other vendors to avoid circular chunks
            return 'vendor';
          }

          // Separate large pipeline modules (merged to avoid circular chunks)
          if (id.includes('/src/pipeline/') || id.includes('/src/transcription/') || id.includes('/src/analysis/') || id.includes('/src/visualization/') || id.includes('/src/remotion/')) {
            return 'pipeline';
          }
        }
      },
      external: (id) => {
        // Exclude native binaries from bundling
        if (id.includes('swc.linux-x64-gnu.node') || id.includes('@swc/core-linux')) {
          return true;
        }
        // Remotion server-side modules should not be browser-bundled
        if (id.includes('@remotion/renderer') || id.includes('@remotion/bundler') || id.includes('@remotion/cli')) {
          return true;
        }
        // Mark Node.js modules as external for better browser compatibility
        if (mode === 'production') {
          return ['path', 'fs', 'os', 'util', 'assert', 'module', 'child_process', 'stream', 'worker_threads', 'crypto', 'url', 'http', 'https', 'net', 'tls'].some(nodeModule =>
            id === nodeModule || id.startsWith(`${nodeModule}/`) || id.startsWith(`node:${nodeModule}`)
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
  test: {
    globals: true,
  },
  worker: {
    format: 'es',
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
      'kuromoji',
      '@swc/core',
      '@swc/core-linux-x64-gnu'
    ]
  },
  define: {
    // Polyfills for Node.js globals in browser
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(mode),
    'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL || ''),
    'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY || ''),
  }
}));
