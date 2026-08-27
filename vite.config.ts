import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sites } from '@openai/sites-vite-plugin';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Identifies the running build so a user can report exactly what they are on.
// Cloudflare Pages supplies the commit; local builds fall back to git, then to 'dev'.
const buildId = (() => {
  const fromPages = process.env.CF_PAGES_COMMIT_SHA;
  if (fromPages) return fromPages.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
})();

const configuredSupabaseOrigin = process.env.VITE_SUPABASE_URL
  ? new URL(process.env.VITE_SUPABASE_URL).origin
  : null;
const supabaseOriginPattern = configuredSupabaseOrigin
  ? new RegExp(`^${configuredSupabaseOrigin.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}$`)
  : /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/;

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    react(),
    sites(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      manifest: false,
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/products\//],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        globIgnores: ['products/**/*'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: supabaseOriginPattern,
            handler: 'NetworkOnly',
            options: { cacheName: 'supabase-network-only' },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/products/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'homies-product-images',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
