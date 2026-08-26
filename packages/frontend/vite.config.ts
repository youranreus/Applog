import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

const require = createRequire(import.meta.url)
const maplibreWorkerFiles = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'] as const

function emitMaplibreWorkerAssets(): Plugin {
  let assetsDir = 'assets'

  return {
    name: 'emit-maplibre-worker-assets',
    apply: 'build',
    configResolved(config) {
      assetsDir = config.build.assetsDir
    },
    async buildStart() {
      for (const fileName of maplibreWorkerFiles) {
        const source = await readFile(require.resolve(`maplibre-gl/dist/${fileName}`))
        this.emitFile({
          type: 'asset',
          fileName: `${assetsDir}/${fileName}`,
          source,
        })
      }
    },
  }
}

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
    tailwindcss(),
    emitMaplibreWorkerAssets(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  // 开发期让 MapLibre 保持原生 ESM 目录结构；生产期由上面的插件补齐同目录 worker 模块图。
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
