import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { useHead } from '@unhead/vue';

const SITE_URL = import.meta.env.VITE_SITE_URL || '';

export interface UseSeoHeadOptions {
  title?: MaybeRefOrGetter<string | undefined>;
  description?: MaybeRefOrGetter<string | undefined>;
  image?: MaybeRefOrGetter<string | undefined>;
  canonicalPath?: MaybeRefOrGetter<string | undefined>;
  type?: MaybeRefOrGetter<'website' | 'article'>;
  publishedTime?: MaybeRefOrGetter<string | Date | undefined>;
  modifiedTime?: MaybeRefOrGetter<string | Date | undefined>;
  tags?: MaybeRefOrGetter<string[] | undefined>;
  authorName?: MaybeRefOrGetter<string | undefined>;
}

function toISOString(value: string | Date | undefined): string | undefined {
  if (!value) return undefined;
  const date = typeof value === 'string' ? new Date(value) : value;
  return isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * 统一的 SEO head 管理 composable
 * 设置 title、description、OG、Twitter Card、canonical、keywords 等 meta 标签
 */
export function useSeoHead(options: UseSeoHeadOptions) {
  const title = computed(() => toValue(options.title));
  const description = computed(() => toValue(options.description));
  const image = computed(() => toValue(options.image));
  const canonicalPath = computed(() => toValue(options.canonicalPath));
  const type = computed(() => toValue(options.type) || 'website');
  const publishedTime = computed(() => toISOString(toValue(options.publishedTime)));
  const modifiedTime = computed(() => toISOString(toValue(options.modifiedTime)));
  const tags = computed(() => toValue(options.tags));
  const authorName = computed(() => toValue(options.authorName));

  const canonicalUrl = computed(() =>
    canonicalPath.value && SITE_URL ? `${SITE_URL}${canonicalPath.value}` : undefined,
  );

  useHead(() => {
    const meta: Array<Record<string, string>> = [];

    if (description.value) {
      meta.push({ name: 'description', content: description.value });
    }

    // Open Graph
    if (title.value) {
      meta.push({ property: 'og:title', content: title.value });
    }
    if (description.value) {
      meta.push({ property: 'og:description', content: description.value });
    }
    if (type.value) {
      meta.push({ property: 'og:type', content: type.value });
    }
    if (canonicalUrl.value) {
      meta.push({ property: 'og:url', content: canonicalUrl.value });
    }
    if (image.value) {
      meta.push({ property: 'og:image', content: image.value });
    }

    // Article-specific OG tags
    if (type.value === 'article') {
      if (publishedTime.value) {
        meta.push({ property: 'article:published_time', content: publishedTime.value });
      }
      if (modifiedTime.value) {
        meta.push({ property: 'article:modified_time', content: modifiedTime.value });
      }
      if (authorName.value) {
        meta.push({ property: 'article:author', content: authorName.value });
      }
    }

    // Twitter Card
    if (title.value) {
      meta.push({ name: 'twitter:title', content: title.value });
    }
    if (description.value) {
      meta.push({ name: 'twitter:description', content: description.value });
    }
    if (image.value) {
      meta.push({ name: 'twitter:image', content: image.value });
    }

    // Keywords from tags
    if (tags.value && tags.value.length > 0) {
      meta.push({ name: 'keywords', content: tags.value.join(', ') });
    }

    const link: Array<Record<string, string>> = [];
    if (canonicalUrl.value) {
      link.push({ rel: 'canonical', href: canonicalUrl.value });
    }

    return {
      title: title.value,
      meta,
      link,
    };
  });
}
