import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' giúp app chạy được dù deploy ở root (Vercel) hay subfolder (GitHub Pages)
export default defineConfig({
  plugins: [react()],
  base: './',
})
