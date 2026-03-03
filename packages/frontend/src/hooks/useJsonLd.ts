import { useHead } from '@unhead/vue';

const SITE_URL = import.meta.env.VITE_SITE_URL || '';

export interface WebSiteJsonLdOptions {
  name: string;
  description?: string;
  url?: string;
}

export interface ArticleJsonLdOptions {
  title: string;
  description?: string;
  url?: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
  tags?: string[];
}

/**
 * 注入 WebSite JSON-LD 结构化数据
 */
export function useWebSiteJsonLd(options: WebSiteJsonLdOptions) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: options.name,
    ...(options.description && { description: options.description }),
    url: options.url || SITE_URL || undefined,
  };

  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(jsonLd),
      },
    ],
  });
}

/**
 * 注入 BlogPosting JSON-LD 结构化数据
 */
export function useArticleJsonLd(options: ArticleJsonLdOptions) {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: options.title,
  };

  if (options.description) {
    jsonLd.description = options.description;
  }
  if (options.url) {
    jsonLd.url = options.url;
  }
  if (options.image) {
    jsonLd.image = options.image;
  }
  if (options.datePublished) {
    jsonLd.datePublished = options.datePublished;
  }
  if (options.dateModified) {
    jsonLd.dateModified = options.dateModified;
  }
  if (options.authorName) {
    jsonLd.author = {
      '@type': 'Person',
      name: options.authorName,
    };
  }
  if (options.tags && options.tags.length > 0) {
    jsonLd.keywords = options.tags.join(', ');
  }

  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(jsonLd),
      },
    ],
  });
}
