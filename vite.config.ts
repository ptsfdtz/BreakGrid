import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig(({ mode }) => {
  const base = (loadEnv(mode, '.', 'VITE_').VITE_BASE_PATH || '/').replace(/\/?$/, '/');
  return {
    base,
    plugins: [react(), VitePWA({
      base,
      scope: base,
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icon.svg'],
      manifest: {
        id: base,
        name: '方块破坏王 · BREAKGRID',
        short_name: '方块破坏王',
        description: '击穿灰墙，清除绿块，释放多球风暴。',
        lang: 'zh-CN',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait-primary',
        theme_color: '#080f20',
        background_color: '#080f20',
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${base}icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: `${base}index.html`,
        navigateFallbackAllowlist: [new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)],
        cleanupOutdatedCaches: true,
      },
    })],
  };
});
