import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    __COART_WIDGET_BUILD__: JSON.stringify(process.env.COART_WIDGET_BUILD === '1')
  },
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000
  }
})
