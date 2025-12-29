import { registerBBCodeComponent } from './component-registry';
import ArticleCard from '@/components/ui/article-card/ArticleCard.vue';

export { processMarkdown } from './markdown-processor';
export {
  registerBBCodeComponent,
  getBBCodeComponent,
  hasBBCodeComponent,
  type IBBCodeComponentConfig,
} from './component-registry';
export { parseContent, type IContentFragment } from './content-parser';

// 注册 BBCode 组件
registerBBCodeComponent('art', ArticleCard);
