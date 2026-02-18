import { defineConfig } from 'vite'

export default defineConfig({
  base: '/HexGame/',
  server: {
    host: true,
    proxy: {
      '/HexGame/api': {
        target: 'http://localhost:3001',
        rewrite: (path) => path.replace(/^\/HexGame/, ''),
      }
    }
  }
})
