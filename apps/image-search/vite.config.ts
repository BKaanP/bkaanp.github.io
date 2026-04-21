import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
 
export default defineConfig({
  base: '/image-search/',
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  build: {
    target: 'esnext',
  },
  worker: {
    format: 'es',
  },
})
 