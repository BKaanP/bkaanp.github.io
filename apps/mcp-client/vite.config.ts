import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
 
export default defineConfig({
  base: '/mcp-client/',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'esnext',
  },
  worker: {
    format: 'es',
  },
})