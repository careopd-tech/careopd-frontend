import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'prompt', // Enables prompting the user when an update is available
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'], 
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'] // Ensures all static assets are cached for offline use
      },
      manifest: {
        name: 'CareOPD',
        short_name: 'CareOPD',
        description: 'Mobile-First Clinic Management Platform',
        theme_color: '#0d9488', // Teal color to match your UI
        background_color: '#ffffff',
        display: 'standalone', // This hides the browser address bar!
        orientation: 'portrait',
        icons: [
          {
            src: '/icon_192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: "any"
          },
          {
            src: '/icon_512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // 'maskable' supports modern Android adaptive icons
          }
        ]
      }
    })
  ],
})