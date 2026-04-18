import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
