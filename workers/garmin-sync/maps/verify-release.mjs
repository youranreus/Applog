import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, normalize, relative, resolve } from 'node:path'

const releaseDir = resolve(process.argv[2] ?? '')
const required = ['basemap.pmtiles', 'style.json', 'manifest.json', 'LICENSES/NOTICE.md']
for (const path of required) {
  if (!existsSync(join(releaseDir, path))) throw new Error(`missing release asset: ${path}`)
}

const manifest = JSON.parse(readFileSync(join(releaseDir, 'manifest.json'), 'utf8'))
for (const key of ['releaseId', 'sourceBuildDate', 'sourceBuildUrl', 'sourceBuildHash']) {
  if (!manifest[key]) throw new Error(`missing manifest metadata: ${key}`)
}
if (manifest.styleId !== 'applog-light' || manifest.styleVersion !== '5.7.2') {
  throw new Error('unexpected style identity')
}
if (manifest.rendererVersion !== '1.11.0' || manifest.pmtilesCliVersion !== '1.31.2') {
  throw new Error('unexpected renderer toolchain')
}

for (const [asset, expected] of Object.entries(manifest.assets ?? {})) {
  if (isAbsolute(asset) || normalize(asset).startsWith('..')) {
    throw new Error(`asset escapes release: ${asset}`)
  }
  const path = resolve(releaseDir, asset)
  if (relative(releaseDir, path).startsWith('..') || !existsSync(path)) {
    throw new Error(`asset missing or outside release: ${asset}`)
  }
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex')
  if (actual !== expected) throw new Error(`asset hash mismatch: ${asset}`)
}

for (const requiredAsset of required.filter((path) => path !== 'manifest.json')) {
  if (!manifest.assets?.[requiredAsset]) {
    throw new Error(`required asset missing from manifest: ${requiredAsset}`)
  }
}

for (const font of ['fonts/NotoSans-Regular.ttf', 'fonts/NotoSansCJK-Regular.ttc']) {
  if (!manifest.assets?.[font]) throw new Error(`required font missing: ${font}`)
}
for (const license of ['LICENSES/Noto-Sans-OFL.txt', 'LICENSES/Noto-Sans-CJK-OFL.txt']) {
  if (!manifest.assets?.[license]) throw new Error(`required font license missing: ${license}`)
}

const style = JSON.parse(readFileSync(join(releaseDir, 'style.json'), 'utf8'))
const inspect = (value) => {
  if (typeof value === 'string' && /^https?:\/\//.test(value)) {
    const host = new URL(value).hostname
    if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
      throw new Error(`external runtime URL: ${host}`)
    }
  } else if (Array.isArray(value)) value.forEach(inspect)
  else if (value && typeof value === 'object') Object.values(value).forEach(inspect)
}
inspect(style)
