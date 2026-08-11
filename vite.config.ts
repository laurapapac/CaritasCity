import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Guarantee a single instance of these libraries. Multiple copies of
    // `three` break instanceof checks inside react-three-fiber and surface
    // as cryptic errors like reading 'fg'.
    dedupe: ['three', 'react', 'react-dom'],
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
