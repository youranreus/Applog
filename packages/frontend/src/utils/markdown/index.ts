import { registerBBCodeComponent, registerPassthroughTag } from './component-registry';
import { registerBBCodeHandler } from './bbcode-handler-registry';
import { h } from 'hastscript';
import ArticleCard from '@/components/ui/article-card/ArticleCard.vue';

export { processMarkdown } from './markdown-processor';
export {
  registerBBCodeComponent,
  getBBCodeComponent,
  hasBBCodeComponent,
  registerPassthroughTag,
  type IBBCodeComponentConfig,
} from './component-registry';
export {
  registerBBCodeHandler,
  getBBCodeHandler,
  hasBBCodeHandler,
  type IBBCodeHandler,
  type IBBCodeHandlerParams,
} from './bbcode-handler-registry';
export { parseContent, type IContentFragment } from './content-parser';

// 注册 BBCode 组件
registerBBCodeComponent('art', ArticleCard);

['tag', 'warn', 'notice'].forEach(tag => {
  registerPassthroughTag(tag);
});

registerBBCodeHandler('tag', ({ content, attrs }) => {
  console.log(attrs, content);
  return h('span', { 
    class: 'applog-tag',
  }, content);
});

registerBBCodeHandler('warn', ({ content, attrs }) => {
  return h('div', { 
    class: 'applog-warn',
  }, content);
});

registerBBCodeHandler('notice', ({ content, attrs }) => {
  return h('div', { 
    class: 'applog-notice',
  }, content);
});
