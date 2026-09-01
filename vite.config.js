import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // O terceiro argumento '' carrega TODAS as vars do .env, não só as VITE_*.
  // BOLSAI_API_KEY é segredo e fica de fora do bundle de propósito: ela só é
  // lida aqui, no processo de dev, para o proxy montar o header.
  const env = loadEnv(mode, process.cwd(), '')

  return {
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
            { src: 'logo.png', sizes: '192x192', type: 'image/png' },
            { src: 'logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
      }),
    ],
    server: {
      proxy: {
        // Espelha o api/bolsai.js de produção. A chave vem do .env local —
        // antes estava hardcoded neste arquivo, e portanto no histórico do git.
        '/api/bolsai': {
          target: 'https://api.usebolsai.com',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api\/bolsai/, '/api/v1'),
          headers: env.BOLSAI_API_KEY ? { 'X-API-Key': env.BOLSAI_API_KEY } : {},
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.js', 'api/**/*.test.js'],
    },
  }
})
