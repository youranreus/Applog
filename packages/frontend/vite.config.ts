import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'ion-icon',
        },
      },
    }),
    vueDevTools(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  // MapLibre 自带 Web Worker 入口，交给 Vite 按原生 ESM 处理，避免预构建后
  // worker 文件名失配（maplibre-gl-worker.mjs not found）。
  optimizeDeps: {
    exclude: ['maplibre-gl', '@geoql/v-maplibre'],
  },
  server: {
    proxy: {
      '/sitemap.xml': 'http://localhost:4000',
      '/robots.txt': 'http://localhost:4000',
    },
  },
})
