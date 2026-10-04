import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  /**
   * Dev-only proxy target for the WattWise backend.
   * Set VITE_PROXY_TARGET in .env (e.g. http://localhost:8000).
   */
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:8000'

  return {
    plugins: [react()],

    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },

    server: {
      port: Number(env.VITE_PORT || 5173),
      host: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          // Allows EventSource / SSE through the dev proxy without buffering.
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
                proxyRes.headers['cache-control'] = 'no-cache, no-transform'
              }
            })
          },
        },
      },
    },

    preview: {
      port: 4173,
    },

    build: {
      target: 'es2020',
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 1400,
      cssCodeSplit: true,
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          /**
           * Manual vendor chunks keep the heavy 3D + charting libraries out of the
           * critical path so the shell paints fast and pages lazy-load on demand.
           */
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('three') || id.includes('@react-three')) return 'vendor-three'
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
            if (id.includes('framer-motion') || id.includes('motion-')) return 'vendor-motion'
            if (id.includes('react-router')) return 'vendor-router'
            if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react'
            if (id.includes('axios')) return 'vendor-http'
            return undefined
          },
        },
      },
    },
  }
})
