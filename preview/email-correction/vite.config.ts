import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const fixture = (name: string) => fileURLToPath(new URL(name, import.meta.url))
export default defineConfig(({ command }) => {
  if (command !== 'serve') throw new Error('Email correction fixtures are development-only')
  return {
    plugins: [{
      name: 'isolated-email-correction-fixtures',
      enforce: 'pre',
      resolveId(source) {
        if (source.endsWith('/auth/auth-context')) return fixture('auth.ts')
        if (source.endsWith('/components/StatementStrip') || source.endsWith('/components/AnalyticsBoundary')) return fixture('boundaries.tsx')
        if (source.endsWith('/pages/ProfilePage') || source.endsWith('/pages/VerifyEmailPage')) return fixture('pages.tsx')
      },
      transform(code, id) {
        if (!id.endsWith('/src/App.tsx')) return
        // Render the existing shell, replacing only its fixture destination and page slots.
        return code.replace('path="/profile"', 'path="/data-requests"')
          .replace('path="/verify-email"', 'path="/data-requests/verify-email"')
          .replace('const isAuthRoute = isAuthRoutePath(location.pathname)', "const isAuthRoute = location.pathname === '/data-requests/verify-email' || isAuthRoutePath(location.pathname)")
          .replace('<Route element={<CorrectionRoute key={auth.profile?.id} />} path="/data-requests" />', '')
          .replace('hasPostLoginReturnTo() ?', 'false ?').replace('verified && hasLineLinkAutoContinue()', 'false')
      },
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          if (request.url?.startsWith('/api/')) { response.statusCode = 403; response.end('No API in fixture preview'); return }
          if (request.url?.split('?')[0] !== '/__email-correction-preview') { next(); return }
          response.setHeader('Content-Type', 'text/html')
          response.setHeader('Referrer-Policy', 'no-referrer')
          response.setHeader('Content-Security-Policy', "connect-src 'self' ws://127.0.0.1:*; form-action 'none'; frame-src 'none'")
          response.end(await server.transformIndexHtml(request.url!, '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"></head><body><div id="root"></div><script type="module" src="/preview/email-correction/main.tsx"></script></body></html>'))
        })
      },
    }, react(), tailwindcss()],
    server: { host: '127.0.0.1', port: 59584, strictPort: true },
  }
})
