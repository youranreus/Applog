import { registerBBCodeHandler } from './bbcode-registry';
import { article } from './bbcode/article';

export { processMarkdown } from './markdown-processor';
export {
  registerBBCodeHandler,
  getBBCodeHandler,
  hasBBCodeHandler,
  type IBBCodeHandler,
  type IBBCodeAttrs,
} from './bbcode-registry';

registerBBCodeHandler('art', article);
