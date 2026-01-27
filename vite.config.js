import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // For GitHub Pages: set base to '/<repo-name>/' when deploying
  // Or use '/' for custom domain or root deployment
  base: process.env.NODE_ENV === 'production' ? '/practice-tracker/' : '/',
})
