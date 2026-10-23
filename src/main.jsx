import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@flaticon/flaticon-uicons/css/regular/rounded.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { reloadOnce } from './utils/chunkReload'

// O Vite pré-carrega CSS e dependências de cada chunk lazy; com o index de um
// deploy antigo esses arquivos dão 404 e isto dispara antes do import() falhar.
window.addEventListener('vite:preloadError', (e) => {
  if (reloadOnce()) e.preventDefault()
})

// O index.html está trocando um service worker antigo e recarregando para a
// landing (ver o script no próprio index.html): não monta o app nesse meio
// tempo, senão a conta pisca na tela antes da landing.
if (!window.__eazyLandingRedirect) createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
    <Analytics />
    <SpeedInsights />
  </StrictMode>,
)
