import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 7445,
    // In dev the UI runs on its own port; the API and MCP stay on the server.
    proxy: { '/api': 'http://127.0.0.1:7444' },
  },
  build: { outDir: 'dist', emptyOutDir: true },
})
