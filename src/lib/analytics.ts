const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

function isEnabled(): boolean {
  return Boolean(MEASUREMENT_ID) && !import.meta.env.DEV
}

export function initAnalytics(): void {
  if (!isEnabled()) return

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer ?? []
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args)
  }
  window.gtag('js', new Date())
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false })
}

export function trackPageView(path: string): void {
  if (!isEnabled() || !window.gtag) return

  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: `${window.location.origin}${window.location.pathname}${path}`,
    page_title: document.title,
  })
}
