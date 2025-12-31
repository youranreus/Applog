import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeStringify from 'rehype-stringify';

/**
 * 创建配置好的 unified markdown 处理器
 * @returns 配置好的 unified processor
 *
 * 逻辑说明：
 * 1. 创建 unified processor
 * 2. 依次添加所有插件：
 *    - remarkParse: 解析 Markdown
 *    - remarkGfm: GitHub Flavored Markdown 支持
 *    - remarkBreaks: 支持换行
 *    - remarkRehype: 将 Markdown AST 转换为 HTML AST
 *    - rehypeSlug: 为标题添加 id 属性
 *    - rehypeAutolinkHeadings: 为标题自动添加链接
 *    - rehypeStringify: 将 HTML AST 转换为 HTML 字符串
 * 3. 返回配置好的 processor
 * 
 * 注意：BBCode 处理已移至 ArticleRenderer 组件，在此不再处理
 */
function createMarkdownProcessor() {
  return unified()
    // 解析 Markdown
    .use(remarkParse)
    // GitHub Flavored Markdown 支持（表格、任务列表、删除线等）
    .use(remarkGfm)
    // 支持换行（两个空格或反斜杠换行）
    .use(remarkBreaks)
    // 将 Markdown AST 转换为 HTML AST
    .use(remarkRehype)
    // 为标题添加 id 属性（用于锚点链接）
    .use(rehypeSlug)
    // // 为标题自动添加链接
    // .use(rehypeAutolinkHeadings, {
    //   behavior: 'wrap',
    //   properties: {
    //     className: ['heading-anchor'],
    //   },
    // })
    // 将 HTML AST 转换为 HTML 字符串
    .use(rehypeStringify);
}

/**
 * 处理 Markdown 并转换为 HTML
 * @param markdown - Markdown 字符串
 * @returns 渲染后的 HTML 字符串
 * @throws {Error} 当处理失败时抛出错误
 *
 * 逻辑说明：
 * 1. 创建 markdown processor
 * 2. 处理 markdown 内容
 * 3. 返回 HTML 字符串
 * 4. 捕获并处理错误
 */
export async function processMarkdown(markdown: string): Promise<string> {
  try {
    const processor = createMarkdownProcessor();
    const result = await processor.process(markdown);
    return String(result);
  } catch (error) {
    console.error('Markdown 渲染失败:', error);
    return `<p>内容渲染失败: ${error instanceof Error ? error.message : '未知错误'}</p>`;
  }
}
