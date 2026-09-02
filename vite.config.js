import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      selfDestroying: true,
      // Use 'injectManifest' so we provide our own SW file,
      // bypassing the Workbox path-apostrophe bug on Windows.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB to handle compiled index bundle size
      },
      includeAssets: ['favicon.svg', 'icons/*.png'],

      // ── Manifest ──────────────────────────────────────────────────────────
      manifest: {
        name: "L'CONQ — Concours Médecine",
        short_name: "L'CONQ",
        description: "La plateforme SRS gamifiée pour préparer les concours de médecine au Maroc.",
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#0D1117',
        theme_color: '#5254F0',
        lang: 'fr',
        categories: ['education', 'medical', 'productivity'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
        shortcuts: [
          {
            name: 'Réviser maintenant',
            short_name: 'Réviser',
            url: '/study',
          },
          {
            name: 'Tableau de bord',
            short_name: 'Dashboard',
            url: '/dashboard',
          },
        ],
      },

      // ── Dev mode: disabled (avoids Workbox Windows path bug) ─────────────
      devOptions: {
        enabled: false,
      },
    }),
  ],

  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('katex')) {
              return 'vendor-katex';
            }
            if (id.includes('jspdf') || id.includes('html2canvas')) {
              return 'vendor-pdf';
            }
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('xlsx') || id.includes('papaparse')) {
              return 'vendor-sheets';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
          }
        }
      }
    }
  },
})
