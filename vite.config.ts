import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/zhihu-api': {
        target: 'https://developer.zhihu.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zhihu-api/, ''),
      },
      '/zhihu-ring-api': {
        target: 'https://openapi.zhihu.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/zhihu-ring-api/, ''),
      },
    },
  },
})
