import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import viteTsconfigPaths from 'vite-tsconfig-paths'
import eslint from 'vite-plugin-eslint'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.REACT_BACKEND_URL || 'http://127.0.0.1:9011'

  return {
    base: '/',
    plugins: [react(), viteTsconfigPaths(), eslint()],
    define: {
      __APP_ENV__: JSON.stringify(env.APP_ENV),
    },
    envPrefix: 'REACT_',
    server: {
      host: '127.0.0.1',
      open: true,
      port: 3000,
      proxy: {
        '/env': backend,
        '/api': backend,
        '/stats': backend,
        '/ml': backend,
        '/iiif': {
          target: backend,
          changeOrigin: true,
          bypass(req) {
            const url = req.url || ''
            const pathname = url.split('?')[0]
            if (pathname === '/iiif') {
              return '/index.html'
            }
            return undefined
          },
        },
      },
    },
  }
})
