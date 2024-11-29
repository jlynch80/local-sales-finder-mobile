import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), mkcert()],
  server: {
    https: true,
    port: 5173
  },
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'chart.js',
      'react-chartjs-2',
      'react-infinite-scroll-component',
      '@react-google-maps/api'
    ],
    esbuildOptions: {
      target: 'es2020'
    }
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      output: {
        format: 'es',
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'maps-vendor': ['@react-google-maps/api'],
          'ui-vendor': [
            '@headlessui/react',
            '@heroicons/react',
            'react-infinite-scroll-component'
          ]
        }
      }
    },
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },
  // Copy service worker files to dist and inject environment variables
  publicDir: 'public',
  experimental: {
    renderBuiltUrl(filename) {
      if (filename.includes('firebase-messaging-sw.js')) {
        return `/firebase-messaging-sw.js?v=${Date.now()}`
      }
      return filename
    }
  }
})
