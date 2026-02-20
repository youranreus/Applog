import type { Root } from 'mdast';
import type { Transformer } from 'unified';
import { visit } from 'unist-util-visit';

/** 表情插件配置：各表情类型的静态资源基址 */
export interface IMemePluginOptions {
  /** 泡泡表情 @(xx) 的图片目录，如 static/img/bq/paopao */
  paopaoBase?: string;
  /** Mirage 表情 ::category:name:: 的图片目录，如 static/img/bq */
  mirageBase?: string;
  /** #(xx) 阿鲁表情的 CDN 基址（末尾含 /） */
  aruCdn?: string;
}

/** 默认阿鲁表情 CDN（与 PHP 一致） */
const DEFAULT_ARU_CDN = 'https://cdn.jsdelivr.net/gh/youranreus/R/W/bq/aru/';

/** 泡泡表情 @(xx) 的图片目录，如 static/img/bq/paopao */
const DEFAULT_PAOPAO_BASE = 'https://cdn.jsdelivr.net/gh/youranreus/G@v3.4.2/static/img/bq/paopao';
/** Mirage 表情 ::category:name:: 的图片目录，如 static/img/bq */
const DEFAULT_MIRAGE_BASE = 'https://cdn.jsdelivr.net/gh/youranreus/G@v3.4.2/static/img/bq';

/** @(xx) 格式：泡泡表情 */
const PAOPAO_REGEX = /@\((.*?)\)/g;
/** ::category:name:: 格式：前后不能是字母数字下划线，中间 category 与 name 不含冒号 */
const MIRAGE_REGEX = /(?<![a-zA-Z0-9_])::([^:]+?):([^:]+?)::(?![a-zA-Z0-9_])/g;
/** #(xx) 格式：阿鲁表情 */
const ARU_REGEX = /#\((.*?)\)/g;

type MemeMatchType = 'paopao' | 'mirage' | 'aru';

interface IMemeMatch {
  start: number;
  end: number;
  type: MemeMatchType;
  fullMatch: string;
  /** paopao/aru: 单段；mirage: category */
  capture1: string;
  /** mirage: name；paopao/aru 与 capture1 相同 */
  capture2?: string;
}

/**
 * 对字符串做 encodeURIComponent 并去掉 %（与 PHP urlencode + preg_replace 行为一致）
 * @param s - 待编码字符串
 * @returns 编码后并去掉 % 的字符串
 */
function encodeForMeme(s: string): string {
  return encodeURIComponent(s).replace(/%/g, '');
}

/**
 * 在文本中收集所有三种表情格式的匹配，按 start 排序，重叠时保留先出现的
 * @param text - 原始文本
 * @returns 排序后的匹配列表
 */
function collectMemeMatches(text: string): IMemeMatch[] {
  const matches: IMemeMatch[] = [];

  const runRegex = (
    regex: RegExp,
    type: MemeMatchType,
    getCaptures: (m: RegExpExecArray) => { capture1: string; capture2?: string },
  ) => {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const { capture1, capture2 } = getCaptures(m);
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        type,
        fullMatch: m[0],
        capture1,
        ...(capture2 !== undefined && { capture2 }),
      });
    }
  };

  runRegex(PAOPAO_REGEX, 'paopao', (m) => ({ capture1: m[1] ?? '' }));
  runRegex(MIRAGE_REGEX, 'mirage', (m) => ({
    capture1: m[1] ?? '',
    capture2: m[2] ?? '',
  }));
  runRegex(ARU_REGEX, 'aru', (m) => ({ capture1: m[1] ?? '' }));

  matches.sort((a, b) => a.start - b.start);

  // 重叠时只保留先出现的
  const filtered: IMemeMatch[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }
  return filtered;
}

/**
 * 根据匹配类型与配置生成 img 的 HTML 字符串
 * @param match - 单条表情匹配
 * @param options - 插件配置（已填充默认值）
 * @returns 对应 img 标签的 HTML
 */
function memeMatchToHtml(match: IMemeMatch, options: Required<IMemePluginOptions>): string {
  const { paopaoBase, mirageBase, aruCdn } = options;
  const alt = (s: string) => s.replace(/"/g, '&quot;');

  if (match.type === 'paopao') {
    const xx = match.capture1;
    const src = paopaoBase ? `${paopaoBase}/${xx}.png` : '';
    return `<img alt="${alt(xx)}" src="${src}" class="bq" />`;
  }

  if (match.type === 'mirage' && match.capture2 !== undefined) {
    const category = match.capture1;
    const name = match.capture2;
    const nameEncoded = encodeForMeme(name);
    const src = mirageBase ? `${mirageBase}/${category}/${nameEncoded}.png` : '';
    return `<img alt="${alt(name)}" src="${src}" class="bq" />`;
  }

  if (match.type === 'aru') {
    const xx = match.capture1;
    const enc = encodeForMeme(xx);
    const src = `${aruCdn}${enc}.png`;
    return `<img class="bq bq-aru" alt="${alt(xx)}" src="${src}" />`;
  }

  return match.fullMatch;
}

/**
 * Remark 表情标签插件
 * 在 Markdown AST 阶段将三种表情写法替换为 img 标签 HTML：
 * - @(xx) 泡泡表情
 * - ::category:name:: Mirage 表情（原神、小黄脸等）
 * - #(xx) 阿鲁表情
 *
 * @param options - 可选配置，未传则使用默认 aruCdn，paopao/mirage 为空字符串
 * @returns unified Transformer
 *
 * 逻辑说明：
 * 1. 遍历所有 text 节点，用三个正则收集 @(xx)、::c:n::、#(xx) 的匹配
 * 2. 按 start 排序，重叠则保留先出现的
 * 3. 将文本切分为「普通文本」与「HTML(img)」片段，替换原 text 节点
 * 4. 与 remarkBBCode 一致，使用 allowDangerousHtml + rehypeRaw 解析生成的 HTML
 */
export function remarkMeme(options: IMemePluginOptions = {}): Transformer<Root, Root> {
  const opts: Required<IMemePluginOptions> = {
    paopaoBase: options.paopaoBase ?? DEFAULT_PAOPAO_BASE,
    mirageBase: options.mirageBase ?? DEFAULT_MIRAGE_BASE,
    aruCdn: options.aruCdn ?? DEFAULT_ARU_CDN,
  };

  return (tree: Root) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === undefined || typeof node.value !== 'string') {
        return;
      }

      const text = node.value;
      const matches = collectMemeMatches(text);
      if (matches.length === 0) {
        return;
      }

      const newNodes: Array<{ type: 'text' | 'html'; value: string }> = [];
      let lastIndex = 0;

      for (const m of matches) {
        if (m.start > lastIndex) {
          const beforeText = text.slice(lastIndex, m.start);
          if (beforeText) {
            newNodes.push({ type: 'text', value: beforeText });
          }
        }
        newNodes.push({
          type: 'html',
          value: memeMatchToHtml(m, opts),
        });
        lastIndex = m.end;
      }

      if (lastIndex < text.length) {
        const remaining = text.slice(lastIndex);
        if (remaining) {
          newNodes.push({ type: 'text', value: remaining });
        }
      }

      const replacementNodes = newNodes.map((n) =>
        n.type === 'html'
          ? { type: 'html' as const, value: n.value }
          : { type: 'text' as const, value: n.value },
      );
      parent.children.splice(index, 1, ...replacementNodes);
    });
  };
}
