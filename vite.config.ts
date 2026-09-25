import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const demoAlias = (file: string) => fileURLToPath(new URL(`./demo/${file}`, import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Modo demonstração (npm run dev:demo): troca Auth/Firestore por versões falsas em memória.
  resolve:
    mode === 'demo'
      ? {
          alias: [
            { find: 'firebase/auth', replacement: demoAlias('auth-mock.js') },
            { find: 'firebase/firestore', replacement: demoAlias('firestore-mock.js') },
          ],
        }
      : {},
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'AACN - Associação de Airsoft de Caldas Novas',
        short_name: 'AACN',
        description: 'Carteirinha digital dos associados da AACN',
        theme_color: '#080c12',
        background_color: '#080c12',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
}))
