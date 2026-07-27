export interface IMemeOptions {
  paopaoBase?: string
  mirageBase?: string
  aruCdn?: string
}

export type MemeSegment =
  | { type: 'text'; value: string }
  | { type: 'meme'; token: string; alt: string; src: string; kind: 'paopao' | 'mirage' | 'aru' }

export const DEFAULT_MEME_OPTIONS: Required<IMemeOptions> = {
  paopaoBase: 'https://cdn.jsdelivr.net/gh/youranreus/G@v3.4.2/static/img/bq/paopao',
  mirageBase: 'https://cdn.jsdelivr.net/gh/youranreus/G@v3.4.2/static/img/bq',
  aruCdn: 'https://cdn.jsdelivr.net/gh/youranreus/R/W/bq/aru/',
}

const TOKEN_REGEX = /@\((.*?)\)|(?<![a-zA-Z0-9_])::([^:]+?):([^:]+?)::(?![a-zA-Z0-9_])|#\((.*?)\)/g

function encodeName(value: string): string {
  return encodeURIComponent(value).replace(/%/g, '')
}

export function parseMemeSegments(text: string, options: IMemeOptions = {}): MemeSegment[] {
  const resolved: Required<IMemeOptions> = {
    paopaoBase: options.paopaoBase ?? DEFAULT_MEME_OPTIONS.paopaoBase,
    mirageBase: options.mirageBase ?? DEFAULT_MEME_OPTIONS.mirageBase,
    aruCdn: options.aruCdn ?? DEFAULT_MEME_OPTIONS.aruCdn,
  }
  const segments: MemeSegment[] = []
  let lastIndex = 0
  TOKEN_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TOKEN_REGEX.exec(text))) {
    if (match.index > lastIndex)
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    const token = match[0]
    if (match[1] !== undefined) {
      segments.push({
        type: 'meme',
        token,
        alt: match[1],
        src: `${resolved.paopaoBase}/${match[1]}.png`,
        kind: 'paopao',
      })
    } else if (match[2] !== undefined && match[3] !== undefined) {
      segments.push({
        type: 'meme',
        token,
        alt: match[3],
        src: `${resolved.mirageBase}/${match[2]}/${encodeName(match[3])}.png`,
        kind: 'mirage',
      })
    } else if (match[4] !== undefined) {
      segments.push({
        type: 'meme',
        token,
        alt: match[4],
        src: `${resolved.aruCdn}${encodeName(match[4])}.png`,
        kind: 'aru',
      })
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < text.length) segments.push({ type: 'text', value: text.slice(lastIndex) })
  return segments.length ? segments : [{ type: 'text', value: text }]
}
