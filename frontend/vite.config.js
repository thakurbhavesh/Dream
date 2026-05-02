import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const projectRootDir = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  envPrefix: ['VITE_', 'REACT_APP_'],
  plugins: [
    react(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: 'all',  // Allow tunnel domains
    proxy: {
      '/api-proxy': {
        target: 'https://dream-s3pi.onrender.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api-proxy/, ''),
        cookieDomainRewrite: { '*': '' },
        cookiePathRewrite: { '*': '/' },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
          });
          proxy.on('proxyRes', (proxyRes) => {
            const sc = proxyRes.headers['set-cookie'];
            if (Array.isArray(sc)) {
              proxyRes.headers['set-cookie'] = sc.map((c) =>
                c
                  .replace(/;\s*Secure/gi, '')
                  .replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
                  .replace(/;\s*Domain=[^;]+/gi, '')
              );
            }
          });
        },
      },
      '/socket.io': {
        target: 'https://dream-s3pi.onrender.com',
        changeOrigin: true,
        secure: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
          });
          proxy.on('proxyReqWs', (proxyReq) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
          });
        },
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui': ['@mui/material', '@emotion/react', '@emotion/styled'],
          'vendor-editor': ['react-syntax-highlighter'],
        },
      },
    },
  },
  resolve: {
    alias: {
      react: path.resolve(projectRootDir, 'node_modules/react'),
      'react-dom': path.resolve(projectRootDir, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(
        projectRootDir,
        'node_modules/react/jsx-runtime.js'
      ),
      'react/jsx-dev-runtime': path.resolve(
        projectRootDir,
        'node_modules/react/jsx-dev-runtime.js'
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
})
