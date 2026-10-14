import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [react()],
  resolve: {
    // `@/…` imports point at src/ (Base44's build plugin used to set this up).
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
