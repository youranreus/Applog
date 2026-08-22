import { createHash } from 'crypto';
import sanitizeHtml = require('sanitize-html');
import {
  FLOMO_MAX_DISPLAY_TAG_LENGTH,
  FLOMO_MAX_DISPLAY_TAGS,
  hasExactFlomoPublicationTag,
  normalizeFlomoTag,
} from '@applog/common';
import type { IFlomoSourceMemo } from './flomo-source.types';

export interface IFlomoNormalizedMemo {
  sourceSlug: string;
  contentHtml: string;
  previewText: string;
  displayTags: string[];
  sourceCreatedAt: Date;
  sourceUpdatedAt: Date;
  contentHash: string;
}

export type FlomoNormalizedAction =
  | { type: 'upsert'; memo: IFlomoNormalizedMemo }
  | { type: 'delete'; sourceSlug: string };

/** Persisted sanitizer contract version. A change requires a full sync. */
export const FLOMO_NORMALIZER_VERSION = 1;

const INLINE_HASHTAG_PATTERN =
  /(^|[^\p{L}\p{N}\p{M}_#])#([\p{L}\p{N}\p{M}_]+(?:[/-][\p{L}\p{N}\p{M}_]+)*)(?=$|[^\p{L}\p{N}\p{M}_/#-])/gu;

function removeHashtags(
  text: string,
  onRemove: (tag: string) => void,
  candidateTags: readonly string[] = [],
): string {
  return text.replace(
    INLINE_HASHTAG_PATTERN,
    (match: string, boundary: string, tag: string, offset: number) => {
      const hashIndex = offset + boundary.length;
      const longestSourceTag = candidateTags.find((candidate) =>
        text.startsWith(candidate, hashIndex + 1),
      );
      if (longestSourceTag && longestSourceTag !== tag) return match;
      onRemove(tag);
      return boundary;
    },
  );
}

const INLINE_HASHTAG_START_BOUNDARY = /[\p{L}\p{N}\p{M}_#]/u;

/**
 * Publication tags use the broader Flomo/config grammar (for example dots or
 * emoji), so they cannot safely share the display-hashtag regex. Prefer the
 * longest exact structured/configured tag at each visible `#` to avoid
 * removing a configured parent from an ordinary child token.
 */
function removePublicationTokens(
  text: string,
  candidateTags: readonly string[],
  publicationTags: ReadonlySet<string>,
): string {
  let result = '';
  let cursor = 0;
  while (cursor < text.length) {
    const hashIndex = text.indexOf('#', cursor);
    if (hashIndex < 0) return result + text.slice(cursor);

    result += text.slice(cursor, hashIndex);
    const previous = Array.from(
      text.slice(Math.max(0, hashIndex - 2), hashIndex),
    ).at(-1);
    if (previous && INLINE_HASHTAG_START_BOUNDARY.test(previous)) {
      result += '#';
      cursor = hashIndex + 1;
      continue;
    }

    const matchingTag = candidateTags.find((tag) =>
      text.startsWith(tag, hashIndex + 1),
    );
    if (!matchingTag || !publicationTags.has(matchingTag)) {
      result += '#';
      cursor = hashIndex + 1;
      continue;
    }
    cursor = hashIndex + 1 + matchingTag.length;
  }
  return result;
}

function publicHref(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    if (
      url.hostname === 'flomoapp.com' ||
      url.hostname.endsWith('.flomoapp.com')
    ) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function sanitizePublicHtml(
  html: string,
  textFilter?: (text: string) => string,
): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'blockquote',
      'ul',
      'ol',
      'li',
      'pre',
      'code',
      'a',
    ],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (_tagName, attribs) => {
        const href = publicHref(attribs.href);
        return {
          tagName: 'a',
          attribs: {
            ...(href ? { href } : {}),
            target: '_blank',
            rel: 'noopener noreferrer nofollow',
          },
        };
      },
    },
    ...(textFilter ? { textFilter } : {}),
  });
}

/** Exact tag gate plus the only server-side HTML normalization boundary. */
export function normalizeFlomoMemo(
  source: IFlomoSourceMemo,
  publicationTags: readonly string[],
): FlomoNormalizedAction {
  if (
    source.deleted ||
    !hasExactFlomoPublicationTag(source.tags, publicationTags)
  ) {
    return { type: 'delete', sourceSlug: source.slug };
  }

  const publicationTagSet = new Set(
    publicationTags.map(normalizeFlomoTag).filter(Boolean),
  );
  const candidateTags = Array.from(
    new Set(
      [...source.tags, ...publicationTagSet]
        .map(normalizeFlomoTag)
        .filter(Boolean),
    ),
  ).sort((left, right) => right.length - left.length);
  const seenDisplayTags = new Set<string>();
  const displayTags: string[] = [];

  // The first pass establishes the safe visible-node boundary and decodes
  // entities. The second pass extracts only from those text nodes, so tags in
  // discarded markup or attributes can never become public display metadata.
  const sanitizedHtml = sanitizePublicHtml(source.contentHtml);
  const contentHtml = sanitizePublicHtml(sanitizedHtml, (text) =>
    removeHashtags(
      removePublicationTokens(text, candidateTags, publicationTagSet),
      (tag) => {
        if (publicationTagSet.has(tag) || seenDisplayTags.has(tag)) return;
        seenDisplayTags.add(tag);
        if (
          tag.length > FLOMO_MAX_DISPLAY_TAG_LENGTH ||
          displayTags.length >= FLOMO_MAX_DISPLAY_TAGS
        ) {
          return;
        }
        displayTags.push(tag);
      },
      candidateTags,
    ),
  ).trim();

  const previewText = sanitizeHtml(
    contentHtml.replace(/<\/(?:p|li|blockquote|pre)>|<br\s*\/?>/giu, ' '),
    { allowedTags: [], allowedAttributes: {} },
  )
    .replace(/\s+/gu, ' ')
    .trim();
  if (!previewText && displayTags.length === 0) {
    return { type: 'delete', sourceSlug: source.slug };
  }
  const publicContentHtml = previewText ? contentHtml : '';

  const representation = JSON.stringify({
    contentHtml: publicContentHtml,
    previewText,
    displayTags,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  });
  return {
    type: 'upsert',
    memo: {
      sourceSlug: source.slug,
      contentHtml: publicContentHtml,
      previewText,
      displayTags,
      sourceCreatedAt: source.createdAt,
      sourceUpdatedAt: source.updatedAt,
      contentHash: createHash('sha256').update(representation).digest('hex'),
    },
  };
}
