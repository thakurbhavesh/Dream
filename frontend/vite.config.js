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
