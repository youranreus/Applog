import { registerBBCodeComponent, registerPassthroughTag } from './component-registry';
import { registerBBCodeHandler } from './bbcode-handler-registry';
import { parseBBCodeAttrs } from './remark-bbcode-plugin';
import { h } from 'hastscript';
import ArticleCard from '@/components/ui/article-card/ArticleCard.vue';
import BiliVideo from '@/components/ui/bili-video/BiliVideo.vue';
import Collapse from '@/components/ui/collapse/Collapse.vue';
import Photos from '@/components/ui/photos/index.vue';
import VideoPlayer from '@/components/ui/video-player/VideoPlayer.vue';

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
registerBBCodeComponent('photos', Photos);
registerBBCodeComponent('dplayer', VideoPlayer);

['tag', 'warn', 'notice', 'friends'].forEach(tag => {
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

/**
 * 解析 [friends] 内层 [friend ...][/friend] 并构建好友卡片 hast 树
 * @param content - [friends] 标签内的原始内容
 * @returns hast Element（div.friends）
 */
registerBBCodeHandler('friends', ({ content }) => {
  const FRIEND_REGEX = /\[friend([^\]]*)\]\s*\[\/friend\]/g;
  const items: ReturnType<typeof h>[] = [];
  let match: RegExpExecArray | null;
  while ((match = FRIEND_REGEX.exec(content ?? '')) !== null) {
    const attrs = parseBBCodeAttrs(match[1] ?? '');
    const url = attrs.url ?? '#';
    const name = attrs.name ?? '';
    const image = attrs.image ?? '';
    const description = attrs.description ?? '';
    items.push(
      h(
        'a.friend-item',
        {
          href: url,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        [
          h('img.friend-avatar', { src: image, alt: name }),
          h('div.friend-info', [
            h('span.friend-name', name),
            h('span.friend-desc', description),
          ]),
        ],
      ),
    );
  }
  return h('div.friends', items);
});
