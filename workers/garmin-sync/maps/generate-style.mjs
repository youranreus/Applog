import { layers, namedFlavor } from '@protomaps/basemaps'
import { writeFileSync } from 'node:fs'

const sourceUrl = process.env.APPLOG_MAP_SOURCE_URL ?? 'http://127.0.0.1:3000/basemap'
const glyphUrl = process.env.APPLOG_MAP_GLYPH_URL ?? 'http://127.0.0.1:3000/font/{fontstack}/{range}'
const fontStack = ['Noto Sans Regular', 'Noto Sans CJK SC Regular']

const generatedLayers = layers('protomaps', namedFlavor('light'), { lang: 'zh' }).map(
  (layer) => {
    if (layer.type !== 'symbol') return layer
    const layout = { ...(layer.layout ?? {}) }
    if (layout['text-field']) layout['text-font'] = fontStack
    for (const key of Object.keys(layout)) {
      if (key.startsWith('icon-')) delete layout[key]
    }
    return { ...layer, layout }
  },
)

const style = {
  version: 8,
  name: 'AppLog Protomaps Light',
  glyphs: glyphUrl,
  sources: {
    protomaps: {
      type: 'vector',
      url: sourceUrl,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: generatedLayers,
}

const output = `${JSON.stringify(style, null, 2)}\n`
if (process.env.APPLOG_MAP_STYLE_OUTPUT) {
  writeFileSync(process.env.APPLOG_MAP_STYLE_OUTPUT, output)
} else {
  process.stdout.write(output)
}
