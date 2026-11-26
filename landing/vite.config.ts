import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Root base: the page also answers nested routes such as /en/privacy, where a relative base would
// look for its scripts under /en/assets/. Public files are referenced through BASE_URL.
export default defineConfig(({ mode }) => {
  const publicUrl = loadEnv(mode, '.', 'VITE_').VITE_PUBLIC_URL
  const socialImage = publicUrl ? new URL('social-card.png', `${publicUrl.replace(/\/$/, '')}/`).href : './social-card.png'
  return {
    base: '/',
    plugins: [react(), tailwindcss(), {
      name: 'pivoris-social-image',
      transformIndexHtml: (html) => html.replaceAll('content="./social-card.png"', `content="${socialImage}"`),
    }],
    // 5173 belongs to the app's frontend; keep both runnable side by side.
    server: { port: 5174 },
  }
})
