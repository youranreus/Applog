import { visit } from 'unist-util-visit';
import type { Root, Element, Parent } from 'hast';
import type { Plugin } from 'unified';

export const rehypeTableWrapper: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index: number | undefined, parent: Parent | undefined) => {
      if (node.tagName !== 'table' || index === undefined || !parent) return;

      const wrapper: Element = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-wrapper'] },
        children: [node],
      };

      parent.children.splice(index, 1, wrapper);
    });
  };
};
