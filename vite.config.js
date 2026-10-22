import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

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
        includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'badge-96x96.png'],
        // O logo da UI é SVG importado (vai pra assets/): sem o svg aqui o menu
        // abre sem logo offline. As splash do iOS ficam de fora de propósito —
        // o Safari só as lê na instalação e elas pesam ~1,4 MB.
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg}'],
          // A landing (/conheca) é página própria: sem isto, quem já instalou o
          // app teria a navegação interceptada e cairia no index.html do app.
          navigateFallbackDenylist: [/^\/conheca/, /^\/landing/],
        },
        manifest: {
          name: 'Eazy Finance',
          short_name: 'Eazy',
          description: 'Tranquilidade Financeira',
          // Creme da marca: é a cor da splash do Android enquanto o app abre.
          theme_color: '#FFF9EF',
          background_color: '#FFF9EF',
          display: 'standalone',
          orientation: 'portrait',
          // any: tile arredondado com cantos transparentes (desktop, atalhos).
          // maskable: sangria total, o launcher do Android recorta no formato dele.
          // monochrome: ícone temático do Android 13+. Gerados por scripts/brand.
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'maskable-icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: 'monochrome-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
          ],

          // Segurar o ícone no launcher cai direto na ação, sem abrir o app e
          // navegar. As rotas já existem — é o roteador por hash de sempre.
          shortcuts: [
            {
              name: 'Nova despesa',
              short_name: 'Despesa',
              url: '/#/overview?quick=1',
              icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'Transações',
              short_name: 'Transações',
              url: '/#/transactions',
              icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'Visão geral',
              short_name: 'Saldo',
              url: '/#/overview',
              icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
          ],

          // Compartilhar do app do banco cai no lançamento rápido com o texto
          // já na linha. GET e não POST de propósito: receber arquivo exige
          // service worker próprio (injectManifest) — ver README.
          share_target: {
            action: '/',
            method: 'GET',
            params: { title: 'title', text: 'text', url: 'url' },
          },
        },
      }),
    ],
    // Duas páginas no build: o app (index.html) e a landing (landing.html,
    // servida em /conheca pelo rewrite do vercel.json). O preview.html segue
    // só em dev.
    build: {
      rolldownOptions: {
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          landing: fileURLToPath(new URL('./landing.html', import.meta.url)),
        },
      },
    },
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
