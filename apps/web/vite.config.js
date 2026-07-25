import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Warn when the Web3Forms key is missing on Vercel builds (VITE_* is inlined at build time). */
function warnWeb3formsKeyOnVercel() {
  return {
    name: 'warn-web3forms-key-vercel',
    configResolved() {
      if (process.env.VERCEL !== '1') return
      const key = process.env.VITE_WEB3FORMS_ACCESS_KEY
      if (key && String(key).trim()) return
      console.warn(
        '\n[Help & Support] VITE_WEB3FORMS_ACCESS_KEY is empty for this Vercel build.\n' +
          'Add it under Project → Settings → Environment Variables for Production (and Preview if you use preview URLs),\n' +
          'then trigger a new deployment — local .env is not used on Vercel.\n'
      )
    },
  }
}

export default defineConfig({
  // Load .env / .env.local from the repo root (one level up from apps/web).
  // Vercel sets VERCEL=1 and injects env vars directly, so this only matters locally.
  envDir: path.resolve(__dirname, '..', '..'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    warnWeb3formsKeyOnVercel(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Workaround: avoid SW minification crashes from workbox/terser in some environments.
      // (We will revisit once CI/CD build is wired up.)
      workbox: {
        mode: 'development',
        // Main bundle exceeds Workbox's default 2 MiB precache limit.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icons.svg'],
      manifest: {
        name: 'FinPlan - Financial Planning PWA',
        short_name: 'FinPlan',
        description: 'Comprehensive financial planning report and projections',
        theme_color: '#0f172a',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})