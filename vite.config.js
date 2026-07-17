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
      workbox: { skipWaiting: true, clientsClaim: true, maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
      includeAssets: ['favicon.jpeg', 'logo.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Driving School Management',
        short_name: 'DriveSchool',
        description: 'Driving school management system',
        start_url: '/',
        display: 'standalone',
        background_color: '#f9fafb',
        theme_color: '#4F46E5',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
