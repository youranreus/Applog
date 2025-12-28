import type { IBBCodeAttrs } from "../bbcode-registry";
import type { Element } from "hast";

export function article(attrs: IBBCodeAttrs, content: string): Element {
  return {
    type: 'element',
    tagName: 'div',
    properties: {
      className: ['article'],
    },
    children: [{ type: 'text', value: content }],
  };
}