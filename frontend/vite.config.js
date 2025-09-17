import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Phase 5: Frontend-Client - Vite Configuration - Generated September 2025
// Enhanced configuration for SSE streaming and production optimization

export default defineConfig({
  plugins: [react()],
  
  // Production build optimization
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable for production
    minify: 'esbuild', // Fast minification
    rollupOptions: {
      output: {
        // Code splitting for better performance
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mui: ['@mui/material', '@emotion/react', '@emotion/styled']
        }
      }
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000
  },
  
  // Development server configuration
  server: {
    port: 3000,
    host: '0.0.0.0', // Allow external connections
    
    // Proxy configuration for SSE and API
    proxy: {
      // API endpoints
      '/api': {
        target: 'http://localhost:5051',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      
      // SSE streaming endpoint - critical for Phase 5
      '/stream': {
        target: 'http://localhost:5051',
        changeOrigin: true,
        ws: false, // Disable websocket upgrade
        configure: (proxy) => {
          // Ensure SSE headers are preserved
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Accept', 'text/event-stream');
            proxyReq.setHeader('Cache-Control', 'no-cache');
          });
        }
      },
      
      // Health check endpoints
      '/health': {
        target: 'http://localhost:5051',
        changeOrigin: true
      }
    }
  },
  
  // Enable modern JS features
  esbuild: {
    target: 'es2022'
  },
  
  // CSS processing
  css: {
    devSourcemap: true
  }
})