import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The seed JSON is bundled into JS, so the whole app works offline after first load.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // The 6 MB CC-CEDICT is fetched on first Capture use, then served from cache offline.
            urlPattern: ({ url }) => url.pathname.endsWith('/cedict.json'),
            handler: 'CacheFirst',
            options: { cacheName: 'cedict', expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
      manifest: {
        name: '学中文 · Chinese Study',
        short_name: '学中文',
        description: 'Turn the Chinese you meet in the wild into spaced-repetition study cards.',
        theme_color: '#ffffff',
        background_color: '#f4f5f7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
