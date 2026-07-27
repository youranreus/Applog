import type { Root } from 'mdast'
import type { Transformer } from 'unified'
import { visit } from 'unist-util-visit'
import { parseMemeSegments, type IMemeOptions } from './meme-utils'

export type IMemePluginOptions = IMemeOptions

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function remarkMeme(options: IMemePluginOptions = {}): Transformer<Root, Root> {
  return (tree: Root) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === undefined || typeof node.value !== 'string') return
      const segments = parseMemeSegments(node.value, options)
      if (!segments.some((segment) => segment.type === 'meme')) return
      parent.children.splice(
        index,
        1,
        ...segments.map((segment) =>
          segment.type === 'text'
            ? { type: 'text' as const, value: segment.value }
            : {
                type: 'html' as const,
                value: `<img alt="${escapeAttribute(segment.alt)}" src="${escapeAttribute(segment.src)}" class="bq${segment.kind === 'aru' ? ' bq-aru' : ''}" />`,
              },
        ),
      )
    })
  }
}
