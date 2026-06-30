import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Project is served from https://nambach.github.io/chinese-vocab-app/ on GitHub
// Pages, so production assets must be referenced under that base path.
export default defineConfig(({ command }) => {
  const base = command === 'build' ? '/chinese-vocab-app/' : '/'

  return {
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Học từ vựng tiếng Trung',
        short_name: 'Trung-VN',
        description: 'Luyện từ vựng tiếng Trung — lưu trữ cục bộ',
        theme_color: '#0f766e',
        background_color: '#f0fdfa',
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
  }
})
