import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import axios from 'axios';
import {
  FLOMO_MAX_DISPLAY_TAG_LENGTH,
  FLOMO_MAX_DISPLAY_TAGS,
  FLOMO_TOKEN_MASK,
  hasExactFlomoPublicationTag,
  normalizeFlomoPublicationTags,
  normalizeFlomoToken,
  shouldKeepExistingFlomoToken,
} from '@applog/common';
import { normalizeFlomoMemo } from '../src/module/flomo/flomo-normalizer';
import {
  buildFlomoWebSignature,
  FlomoWebSourceAdapter,
} from '../src/module/flomo/flomo-web-source.adapter';

const CREATED_AT = new Date('2026-08-20T02:00:00.000Z');

function memo(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'memo-1',
    contentHtml: '<p>Hello #公开</p>',
    tags: ['公开'],
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    deleted: false,
    ...overrides,
  } as never;
}

describe('Flomo shared publication helpers', () => {
  it('normalizes one optional #, trims and deduplicates exact names', () => {
    assert.deepEqual(
      normalizeFlomoPublicationTags([' #公开 ', '公开', '#公开/日常']),
      ['公开', '公开/日常'],
    );
    assert.equal(hasExactFlomoPublicationTag(['公开/日常'], ['公开']), false);
    assert.equal(
      hasExactFlomoPublicationTag(['公开/日常'], ['公开/日常']),
      true,
    );
  });

  it('normalizes Bearer and retains empty/masked submissions', () => {
    assert.equal(normalizeFlomoToken(' Bearer secret '), 'secret');
    assert.equal(shouldKeepExistingFlomoToken(''), true);
    assert.equal(shouldKeepExistingFlomoToken('Bearer   '), true);
    assert.equal(shouldKeepExistingFlomoToken(FLOMO_TOKEN_MASK), true);
    assert.equal(shouldKeepExistingFlomoToken('secret'), false);
  });
});

describe('Flomo public normalizer', () => {
  it('uses exact any-tag matching and withdraws tombstones/misses', () => {
    assert.equal(
      normalizeFlomoMemo(memo({ tags: ['公开/日常'] }), ['公开']).type,
      'delete',
    );
    assert.equal(
      normalizeFlomoMemo(memo({ deleted: true }), ['公开']).type,
      'delete',
    );
    assert.equal(
      normalizeFlomoMemo(memo({ tags: ['私有', '公开'] }), ['公开']).type,
      'upsert',
    );
  });

  it('accepts minimal deletion tombstones at the adapter boundary', async () => {
    const originalGet = axios.get;
    axios.get = (async () => ({
      data: {
        code: 0,
        data: [
          {
            slug: 'deleted-1',
            created_at: '2026-08-20 10:00:00',
            updated_at: '2026-08-20 10:00:00',
            deleted_at: '2026-08-20 10:00:01',
          },
        ],
      },
    })) as typeof axios.get;
    try {
      const adapter = new FlomoWebSourceAdapter();
      Object.assign(adapter, { logger: { warn: () => undefined } });
      const result = await adapter.fetchChanges('secret', {
        updatedAt: null,
        slug: '',
      });
      assert.equal(result.memos[0]?.deleted, true);
      assert.deepEqual(result.memos[0]?.tags, []);
    } finally {
      axios.get = originalGet;
    }
  });

  it('removes executable/media markup, private links and publication tokens', () => {
    const result = normalizeFlomoMemo(
      memo({
        contentHtml:
          '<p onclick="steal()">Hello #公开<script>alert(1)</script><img src="https://private/x.png"><a href="javascript:alert(2)">bad</a><a href="https://v.flomoapp.com/mine/?memo_id=1">private</a><a href="https://example.com/a">safe</a></p><svg><textarea><img src=x onerror="steal()"></textarea></svg>',
      }),
      ['公开'],
    );
    assert.equal(result.type, 'upsert');
    if (result.type !== 'upsert') return;
    const html = result.memo.contentHtml;
    assert.equal(
      /script|onclick|onerror|<img|svg|textarea|javascript:|flomoapp\.com|#公开/u.test(
        html,
      ),
      false,
    );
    assert.match(html, /href="https:\/\/example\.com\/a"/u);
    assert.match(html, /rel="noopener noreferrer nofollow"/u);
    assert.equal(result.memo.previewText, 'Hello badprivatesafe');
  });

  it('removes publication tokens that are entity-encoded before sanitization', () => {
    const result = normalizeFlomoMemo(
      memo({ contentHtml: '<p>Hello &#35;公开</p>' }),
      ['公开'],
    );
    assert.equal(result.type, 'upsert');
    if (result.type !== 'upsert') return;
    assert.equal(result.memo.contentHtml, '<p>Hello </p>');
    assert.equal(result.memo.previewText, 'Hello');
    assert.deepEqual(result.memo.displayTags, []);
  });

  it('removes exact broad-grammar publication tokens without consuming children', () => {
    const result = normalizeFlomoMemo(
      memo({
        contentHtml: '<p>&#35;发布🚀 #foo.bar #foo。#日常.记录 #日常</p>',
        tags: ['发布🚀', 'foo', 'foo.bar', '日常', '日常.记录'],
      }),
      ['#发布🚀', 'foo', '日常.记录'],
    );
    assert.equal(result.type, 'upsert');
    if (result.type !== 'upsert') return;
    assert.equal(result.memo.contentHtml.includes('#发布🚀'), false);
    assert.equal(result.memo.contentHtml.includes('#foo。'), false);
    assert.equal(result.memo.contentHtml.includes('#日常.记录'), false);
    assert.match(result.memo.contentHtml, /#foo\.bar/u);
    assert.deepEqual(result.memo.displayTags, ['日常']);
  });

  it('extracts only visible text and preserves sanitizer entity encoding', () => {
    const result = normalizeFlomoMemo(
      memo({
        contentHtml:
          '<p>A &amp; B &lt;safe&gt; #visible</p><a href="https://example.com/#attribute" title="#title">Link</a>',
      }),
      ['公开'],
    );
    assert.equal(result.type, 'upsert');
    if (result.type !== 'upsert') return;
    assert.deepEqual(result.memo.displayTags, ['visible']);
    assert.match(result.memo.contentHtml, /A &amp; B &lt;safe&gt;/u);
    assert.match(
      result.memo.contentHtml,
      /href="https:\/\/example\.com\/#attribute"/u,
    );
    assert.equal(result.memo.contentHtml.includes('#title'), false);
  });

  it('extracts Unicode display tags from visible text in source order', () => {
    const result = normalizeFlomoMemo(
      memo({
        contentHtml:
          '<p>#公开 开始 #随想，重复 #随想。Unicode #咖啡/手冲，<strong>#Café</strong>，实体 &#35;实体，内嵌x#不算。</p><script>#恶意</script>',
      }),
      ['公开'],
    );
    assert.equal(result.type, 'upsert');
    if (result.type !== 'upsert') return;
    assert.deepEqual(result.memo.displayTags, [
      '随想',
      '咖啡/手冲',
      'Café',
      '实体',
    ]);
    assert.equal(
      /#公开|#随想|#咖啡\/手冲|#Café|#恶意/u.test(result.memo.contentHtml),
      false,
    );
    assert.match(result.memo.contentHtml, /x#不算/u);
    assert.equal(result.memo.previewText.includes('#随想'), false);
  });

  it('keeps tag-only notes but drops publication-only notes', () => {
    const tagOnly = normalizeFlomoMemo(
      memo({ contentHtml: '<p>#随想 #随想</p>' }),
      ['公开'],
    );
    assert.equal(tagOnly.type, 'upsert');
    if (tagOnly.type === 'upsert') {
      assert.equal(tagOnly.memo.contentHtml, '');
      assert.equal(tagOnly.memo.previewText, '');
      assert.deepEqual(tagOnly.memo.displayTags, ['随想']);
    }
    assert.equal(
      normalizeFlomoMemo(memo({ contentHtml: '<p>#公开</p>' }), ['公开']).type,
      'delete',
    );
  });

  it('bounds persisted display tags after removing every inline token', () => {
    const accepted = Array.from(
      { length: FLOMO_MAX_DISPLAY_TAGS + 2 },
      (_, index) => `tag${index}`,
    );
    const oversized = `x${'界'.repeat(FLOMO_MAX_DISPLAY_TAG_LENGTH)}`;
    const result = normalizeFlomoMemo(
      memo({
        contentHtml: `<p>${accepted.map((tag) => `#${tag}`).join(' ')} #${oversized}</p>`,
      }),
      ['公开'],
    );
    assert.equal(result.type, 'upsert');
    if (result.type !== 'upsert') return;
    assert.equal(result.memo.displayTags.length, FLOMO_MAX_DISPLAY_TAGS);
    assert.deepEqual(
      result.memo.displayTags,
      accepted.slice(0, FLOMO_MAX_DISPLAY_TAGS),
    );
    assert.equal(result.memo.contentHtml, '');
    assert.equal(result.memo.previewText, '');
    const samePersistedRepresentation = normalizeFlomoMemo(
      memo({
        contentHtml: `<p>${accepted
          .slice(0, FLOMO_MAX_DISPLAY_TAGS)
          .map((tag) => `#${tag}`)
          .join(' ')} #not-persisted</p>`,
      }),
      ['公开'],
    );
    assert.equal(samePersistedRepresentation.type, 'upsert');
    if (samePersistedRepresentation.type === 'upsert') {
      assert.equal(
        samePersistedRepresentation.memo.contentHash,
        result.memo.contentHash,
      );
    }
  });

  it('drops attachment-only/empty content and hashes display tags', () => {
    assert.equal(
      normalizeFlomoMemo(
        memo({ contentHtml: '<img src="https://private/image">' }),
        ['公开'],
      ).type,
      'delete',
    );
    const first = normalizeFlomoMemo(memo(), ['公开']);
    const second = normalizeFlomoMemo(memo(), ['公开']);
    assert.equal(first.type, 'upsert');
    assert.equal(second.type, 'upsert');
    if (first.type === 'upsert' && second.type === 'upsert') {
      assert.equal(first.memo.contentHash, second.memo.contentHash);
    }
    const alpha = normalizeFlomoMemo(
      memo({ contentHtml: '<p>Hello #alpha</p>' }),
      ['公开'],
    );
    const beta = normalizeFlomoMemo(
      memo({ contentHtml: '<p>Hello #beta</p>' }),
      ['公开'],
    );
    assert.equal(alpha.type, 'upsert');
    assert.equal(beta.type, 'upsert');
    if (alpha.type === 'upsert' && beta.type === 'upsert') {
      assert.equal(alpha.memo.contentHtml, beta.memo.contentHtml);
      assert.notEqual(alpha.memo.contentHash, beta.memo.contentHash);
    }
  });
});

describe('Flomo Web adapter', () => {
  it('matches a pinned signature fixture', () => {
    assert.equal(
      buildFlomoWebSignature({
        limit: 200,
        latest_updated_at: '',
        latest_slug: '',
        tz: '8:0',
        timestamp: 1_700_000_000,
        api_key: 'flomo_web',
        app_version: '4.0',
        platform: 'web',
        webp: 1,
      }),
      'c070c5ce14c3c255e1c9710654818756',
    );
  });

  it('passes the full same-timestamp composite cursor between pages', async () => {
    const originalGet = axios.get;
    const calls: Array<Record<string, unknown>> = [];
    const rawMemo = (index: number) => ({
      slug: `slug-${String(index).padStart(3, '0')}`,
      content: '<p>memo</p>',
      tags: ['公开'],
      created_at: '2026-08-20 10:00:00',
      updated_at: '2026-08-20 10:00:00',
      deleted_at: null,
      files: [{ url: 'https://private.example/file' }],
    });
    axios.get = (async (
      _url: string,
      options: { params: Record<string, unknown> },
    ) => {
      calls.push(options.params);
      return {
        data: {
          code: 0,
          data:
            calls.length === 1
              ? Array.from({ length: 200 }, (_, index) => rawMemo(index))
              : [rawMemo(200)],
        },
      };
    }) as typeof axios.get;
    try {
      const adapter = new FlomoWebSourceAdapter();
      Object.assign(adapter, { logger: { warn: () => undefined } });
      const result = await adapter.fetchChanges('secret', {
        updatedAt: null,
        slug: '',
      });
      assert.equal(calls.length, 2);
      assert.equal(calls[1]?.latest_slug, 'slug-199');
      assert.equal(calls[1]?.latest_updated_at, 1_787_191_200);
      assert.equal(result.memos.length, 201);
      assert.equal(result.cursor.slug, 'slug-200');
      assert.equal(JSON.stringify(result).includes('private.example'), false);
    } finally {
      axios.get = originalGet;
    }
  });

  it('classifies auth/rate-limit failures without logging credentials or raw bodies', async () => {
    const originalGet = axios.get;
    try {
      for (const fixture of [
        { status: 401, expected: 'unauthorized', attempts: 1 },
        { status: 429, expected: 'rate_limited', attempts: 2 },
      ]) {
        let attempts = 0;
        const logs: string[] = [];
        axios.get = (async () => {
          attempts += 1;
          throw {
            response: {
              status: fixture.status,
              headers: { 'retry-after': '0' },
              data: { token: 'secret-token', content: 'private memo' },
            },
          };
        }) as typeof axios.get;
        const adapter = new FlomoWebSourceAdapter();
        Object.assign(adapter, {
          logger: { warn: (message: string) => logs.push(message) },
        });
        await assert.rejects(
          adapter.fetchChanges('secret-token', { updatedAt: null, slug: '' }),
          (error: { category?: string }) => error.category === fixture.expected,
        );
        assert.equal(attempts, fixture.attempts);
        assert.equal(/secret-token|private memo/u.test(logs.join('\n')), false);
      }
    } finally {
      axios.get = originalGet;
    }
  });

  it('classifies 403/5xx/timeout/schema without retrying auth or schema errors', async () => {
    const originalGet = axios.get;
    try {
      for (const fixture of [
        {
          expected: 'unauthorized',
          attempts: 1,
          throwError: { response: { status: 403, headers: {} } },
        },
        {
          expected: 'upstream',
          attempts: 2,
          throwError: {
            response: { status: 503, headers: { 'retry-after': '0' } },
          },
        },
        {
          expected: 'timeout',
          attempts: 2,
          throwError: { code: 'ECONNABORTED', message: 'timeout' },
        },
        {
          expected: 'schema',
          attempts: 1,
          data: { code: 0, data: { unexpected: true } },
        },
      ] as Array<{
        expected: string;
        attempts: number;
        throwError?: unknown;
        data?: unknown;
      }>) {
        let attempts = 0;
        const logs: string[] = [];
        axios.get = (async () => {
          attempts += 1;
          if ('data' in fixture) return { data: fixture.data };
          throw fixture.throwError;
        }) as typeof axios.get;
        const adapter = new FlomoWebSourceAdapter();
        Object.assign(adapter, {
          logger: { warn: (message: string) => logs.push(message) },
        });
        await assert.rejects(
          adapter.fetchChanges('secret-token', { updatedAt: null, slug: '' }),
          (error: { category?: string }) => error.category === fixture.expected,
        );
        assert.equal(attempts, fixture.attempts);
        assert.equal(
          /secret-token|Authorization/u.test(logs.join('\n')),
          false,
        );
      }
    } finally {
      axios.get = originalGet;
    }
  });
});
