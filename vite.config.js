import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png'],
      manifest: {
        name: 'Eazy Finance',
        short_name: 'Eazy',
        description: 'Tranquilidade Financeira',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api/bolsai': {
        target: 'https://api.usebolsai.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/bolsai/, '/api/v1'),
        headers: { 'X-API-Key': 'sk_a6a7a04e94be0d894314e6a7747c58342b01f8c8285c5d12' },
      },
    },
  },
})
