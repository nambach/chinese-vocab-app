import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initAnalytics } from './lib/analytics'
import './index.css'
import App from './App.tsx'

function isLocalTestingHost(): boolean {
  const { hostname, protocol } = window.location
  return (
    import.meta.env.DEV ||
    protocol === 'http:' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local') ||
    /^192\.168\.\d+\.\d+$/.test(hostname) ||
    /^10\.\d+\.\d+\.\d+$/.test(hostname)
  )
}

async function unregisterServiceWorkersForLocalTesting(): Promise<void> {
  if (!('serviceWorker' in navigator) || !isLocalTestingHost()) return

  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((registration) => registration.unregister()))
}

void unregisterServiceWorkersForLocalTesting()
initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
