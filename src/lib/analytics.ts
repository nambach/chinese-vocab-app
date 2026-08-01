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
  // gtag.js hydrates the queue by inspecting the array-like `arguments`
  // object. Pushing a plain array (e.g. via rest params) is silently
  // ignored, so every command must forward `arguments` verbatim.
  window.gtag = function gtag(..._args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
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
