import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@flaticon/flaticon-uicons/css/regular/rounded.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
    <Analytics />
    <SpeedInsights />
  </StrictMode>,
)
