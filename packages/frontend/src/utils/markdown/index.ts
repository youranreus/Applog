import { registerBBCodeComponent, registerPassthroughTag } from './component-registry';
import { registerBBCodeHandler } from './bbcode-handler-registry';
import { h } from 'hastscript';
import ArticleCard from '@/components/ui/article-card/ArticleCard.vue';
import BiliVideo from '@/components/ui/bili-video/BiliVideo.vue';
import Collapse from '@/components/ui/collapse/Collapse.vue';

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
registerBBCodeComponent('bili', BiliVideo);
registerBBCodeComponent('collapse', Collapse);

['tag', 'warn', 'notice'].forEach(tag => {
  registerPassthroughTag(tag);
});

registerBBCodeHandler('tag', ({ content, attrs }) => {
  return h('span', { 
    class: `applog-tag applog-tag--${attrs.type || 'blue'}`,
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
