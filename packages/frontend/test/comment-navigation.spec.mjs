import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)
const { mergeOwnedPendingComments, parseCommentHash } = await jiti.import(
  '../src/pages/post/utils/comment-tree.ts',
)
const { getAdminCommentLocation } = await jiti.import(
  '../src/pages/user/CommentList/utils/comment-location.ts',
)
const { getCommentSubmissionOutcome } = await jiti.import(
  '../src/pages/post/utils/comment-submission.ts',
)
const { buildCommentMigrationPayload } = await jiti.import(
  '../src/api/system-config/commentMigrationPayload.ts',
)
const {
  pendingCommentStorageKey,
  readPendingCapabilities,
  writePendingCapabilities,
} = await jiti.import(
  '../src/pages/post/utils/pending-comment-storage.ts',
)

const comment = (id, parentId, status = 'approved', createdAt = id) => ({
  id,
  content: `comment-${id}`,
  postId: 1,
  parentId,
  status,
  author: { name: `author-${id}` },
  createdAt: new Date(createdAt * 1_000).toISOString(),
  updatedAt: new Date(createdAt * 1_000).toISOString(),
  replies: [],
})

describe('comment navigation and pending tree', () => {
  it('routes approved submissions to public reload without creating a capability', () => {
    const result = { comment: comment(30, undefined, 'approved', 30) }
    assert.deepEqual(getCommentSubmissionOutcome(result, true), {
      kind: 'approved',
      resetToFirstPage: true,
    })
    assert.equal('capability' in getCommentSubmissionOutcome(result, true), false)
    assert.deepEqual(getCommentSubmissionOutcome(result, false), {
      kind: 'approved',
      resetToFirstPage: false,
    })
  })

  it('keeps guest pending submissions in the capability flow', () => {
    const result = {
      comment: comment(31, undefined, 'pending', 31),
      withdrawToken: 'guest-token',
    }
    assert.deepEqual(getCommentSubmissionOutcome(result, true), {
      kind: 'pending',
      capability: { commentId: 31, token: 'guest-token' },
    })
  })

  it('merges validated pending roots and replies at their tree positions without duplicates', () => {
    const approvedRoot = comment(10, undefined, 'approved', 10)
    approvedRoot.replies = [comment(11, 10, 'approved', 11)]
    const pendingRoot = comment(20, undefined, 'pending', 20)
    const pendingReply = comment(21, 11, 'pending', 21)

    const merged = mergeOwnedPendingComments(
      [approvedRoot],
      [pendingRoot, pendingReply, { ...pendingReply }],
      true,
    )

    assert.deepEqual(
      merged.map((item) => item.id),
      [20, 10],
    )
    assert.deepEqual(
      merged[1].replies[0].replies.map((item) => item.id),
      [21],
    )
  })

  it('does not place pending roots on later approved-root pages', () => {
    const merged = mergeOwnedPendingComments(
      [comment(10, undefined)],
      [comment(20, undefined, 'pending'), comment(21, 10, 'pending')],
      false,
    )
    assert.deepEqual(
      merged.map((item) => item.id),
      [10],
    )
    assert.deepEqual(
      merged[0].replies.map((item) => item.id),
      [21],
    )
  })

  it('parses only positive safe comment anchors', () => {
    assert.equal(parseCommentHash('#comment-42'), 42)
    for (const value of ['', '#comment-0', '#comment--1', '#comment-1x', '#other-1']) {
      assert.equal(parseCommentHash(value), undefined)
    }
  })

  it('adds anchors only for approved admin rows', () => {
    const post = { id: 1, title: 'Post', slug: 'post' }
    assert.equal(
      getAdminCommentLocation({ id: 5, status: 'approved', post }),
      '/archives/post.html#comment-5',
    )
    assert.equal(getAdminCommentLocation({ id: 6, status: 'pending', post }), '/archives/post.html')
    assert.equal(
      getAdminCommentLocation({ id: 7, status: 'rejected', post }),
      '/archives/post.html',
    )
    const page = { id: 1, title: 'About', slug: 'about' }
    assert.equal(
      getAdminCommentLocation({ id: 8, status: 'approved', page }),
      '/about.html#comment-8',
    )
    assert.equal(getAdminCommentLocation({ id: 9, status: 'pending', page }), '/about.html')
  })

  it('keeps the article capability key and isolates same-id pages', () => {
    assert.equal(pendingCommentStorageKey({ type: 'post', id: 12 }), 'applog:pending-comments:12')
    assert.equal(pendingCommentStorageKey(12), 'applog:pending-comments:12')
    assert.equal(
      pendingCommentStorageKey({ type: 'page', id: 12 }),
      'applog:pending-comments:page:12',
    )
  })

  it('validates, deduplicates, caps, and isolates persisted capabilities', () => {
    const values = new Map()
    const originalStorage = globalThis.sessionStorage
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
      },
    })
    try {
      const postTarget = { type: 'post', id: 12 }
      const pageTarget = { type: 'page', id: 12 }
      writePendingCapabilities(postTarget, [
        { commentId: 1, token: 'o'.repeat(32) },
        { commentId: 1, token: 'n'.repeat(32) },
        { commentId: -1, token: 'i'.repeat(32) },
        ...Array.from({ length: 21 }, (_, index) => ({
          commentId: index + 2,
          token: String(index + 2).padEnd(32, 'x'),
        })),
      ])
      writePendingCapabilities(pageTarget, [{ commentId: 99, token: 'p'.repeat(32) }])

      const postItems = readPendingCapabilities(postTarget)
      assert.equal(postItems.length, 20)
      assert.equal(postItems.some((item) => item.commentId === 1), false)
      assert.deepEqual(readPendingCapabilities(pageTarget), [
        { commentId: 99, token: 'p'.repeat(32) },
      ])

      values.set(pendingCommentStorageKey(postTarget), '{broken')
      assert.deepEqual(readPendingCapabilities(postTarget), [])
      assert.equal(values.has(pendingCommentStorageKey(postTarget)), false)

      Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: {
          getItem: () => {
            throw new Error('storage unavailable')
          },
          setItem: () => {
            throw new Error('storage unavailable')
          },
          removeItem: () => {
            throw new Error('storage unavailable')
          },
        },
      })
      assert.deepEqual(readPendingCapabilities(pageTarget), [])
      assert.doesNotThrow(() =>
        writePendingCapabilities(pageTarget, [{ commentId: 100, token: 's'.repeat(32) }]),
      )
    } finally {
      if (originalStorage === undefined) delete globalThis.sessionStorage
      else {
        Object.defineProperty(globalThis, 'sessionStorage', {
          configurable: true,
          value: originalStorage,
        })
      }
    }
  })

  it('keeps admin identity metadata in dedicated columns and actions in an icon menu', async () => {
    const table = await readFile(
      new URL('../src/pages/user/CommentList/components/CommentTable.vue', import.meta.url),
      'utf8',
    )

    const headers = [...table.matchAll(/<th(?:\s[^>]*)?>([\s\S]*?)<\/th>/g)].map((match) =>
      match[1].trim(),
    )
    assert.deepEqual(headers, ['时间', '评论', '目标', '评论者', '邮箱', '状态', 'IP', '操作'])
    assert.match(table, /v-if="item\.guestSite"[\s\S]*:href="item\.guestSite"/)
    assert.match(table, /item\.guestEmail \|\| '—'/)
    assert.match(table, /item\.ip \|\| '—'/)
    assert.equal(table.includes('item.agent'), false)
    assert.match(table, /pending: '待审核'/)
    assert.match(table, /approved: '已通过'/)
    assert.match(table, /rejected: '已拒绝'/)
    assert.match(table, /:data-status="item\.status"/)
    for (const status of ['pending', 'approved', 'rejected']) {
      assert.match(table, new RegExp(`data-status='${status}'\\]::before`))
    }
    assert.match(table, /MoreHorizontalIcon/)
    assert.match(table, /@mouseenter="openActions\(item\.id\)"/)
    for (const action of ['通过', '拒绝', '删除']) assert.match(table, new RegExp(`<span>${action}</span>`))
  })

  it('keeps reply context exact and exposes ids on hover and keyboard focus', async () => {
    const [section, form, item, hook] = await Promise.all([
      readFile(
        new URL('../src/pages/post/components/comments/PostCommentSection.vue', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../src/pages/post/components/comments/CommentForm.vue', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../src/pages/post/components/comments/CommentItem.vue', import.meta.url),
        'utf8',
      ),
      readFile(new URL('../src/pages/post/hooks/usePostComments.ts', import.meta.url), 'utf8'),
    ])
    assert.equal(section.includes(['安静地', '聊聊这篇文章。'].join('')), false)
    assert.match(form, /正在回复 \{\{ replyTarget\.author\.name \}\} #\{\{ replyTarget\.id \}\}/)
    assert.match(item, /:aria-label="`回复评论 #\$\{comment\.id\}`"/)
    assert.match(item, /\.reply-action:hover \.reply-id/)
    assert.match(item, /\.reply-action:focus-visible \.reply-id/)
    assert.match(item, /\.reply-id \{[\s\S]*opacity: 0;/)
    assert.match(hook, /await load\(false, false, false\)/)
  })

  it('composes the same explicit-target comment section on posts and pages', async () => {
    const [section, postDetail, pageDetail, hook] = await Promise.all([
      readFile(
        new URL('../src/pages/post/components/comments/CommentSection.vue', import.meta.url),
        'utf8',
      ),
      readFile(new URL('../src/pages/post/PostDetail.vue', import.meta.url), 'utf8'),
      readFile(new URL('../src/pages/page/PageDetail.vue', import.meta.url), 'utf8'),
      readFile(new URL('../src/pages/post/hooks/usePostComments.ts', import.meta.url), 'utf8'),
    ])
    assert.match(section, /useComments\(\(\) => props\.target\)/)
    assert.match(postDetail, /:target="\{ type: 'post', id: post\.id \}"/)
    assert.match(pageDetail, /:target="\{ type: 'page', id: page\.id \}"/)
    assert.match(hook, /currentTarget\.type === 'post'/)
    assert.match(hook, /item\.pageId === currentTarget\.id/)
    assert.match(hook, /targetVersion\+\+/)
  })

  it('builds a fixed comments-only migration scope without a clear option', () => {
    const dbConfig = {
      host: 'db.example.com',
      port: 3306,
      database: 'typecho',
      username: 'reader',
      password: 'secret',
      tablePrefix: 'typecho_',
    }
    const payload = buildCommentMigrationPayload(dbConfig)

    assert.deepEqual(payload, {
      source: 'typecho',
      dbConfig,
      resources: ['comments'],
    })
    assert.equal('clearExisting' in payload, false)
    assert.equal('fieldMapping' in payload, false)
  })

  it('keeps identity fields above the embedded comment submit action', async () => {
    const [form, editor, list, header] = await Promise.all([
      readFile(
        new URL('../src/pages/post/components/comments/CommentForm.vue', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../src/pages/post/components/comments/CommentEditor.vue', import.meta.url),
        'utf8',
      ),
      readFile(new URL('../src/pages/user/CommentList.vue', import.meta.url), 'utf8'),
      readFile(
        new URL('../src/pages/user/components/AdminListHeader.vue', import.meta.url),
        'utf8',
      ),
    ])

    assert.ok(form.indexOf('class="guest-fields"') < form.indexOf('<CommentEditor'))
    assert.ok(form.indexOf('placeholder="昵称"') < form.indexOf('placeholder="邮箱（不会公开）"'))
    assert.ok(
      form.indexOf('placeholder="邮箱（不会公开）"') <
        form.indexOf('placeholder="个人站点（可选）"'),
    )
    assert.match(editor, /class="absolute right-2\.5 bottom-2\.5"/)
    assert.match(editor, /focus-within:ring-2/)
    assert.match(editor, /@invalid="nativeInvalid = true"/)
    assert.match(editor, /activeInvalid &&[\s\S]*border-destructive[\s\S]*ring-3/)
    assert.match(editor, /focus-within:border-destructive focus-within:ring-destructive\/20/)
    assert.match(editor, /disabled && 'bg-input\/50 dark:bg-input\/80'/)
    assert.match(editor, /disabled:cursor-not-allowed disabled:opacity-50/)
    assert.match(editor, /resize-none/)
    assert.doesNotMatch(editor, /resize-y|pr-28/)
    assert.match(editor, /px-2\.5 pt-2 pb-14/)
    assert.match(
      form,
      /@media \(max-width: 640px\)[\s\S]*\.guest-fields[\s\S]*grid-template-columns: 1fr/,
    )
    assert.match(list, /<template #before-action>/)
    assert.match(list, /variant="outline"[\s\S]*size="lg"[\s\S]*class="px-4"/)
    assert.match(list, />\s*迁移\s*</)
    assert.match(header, /<slot name="before-action" \/>/)
  })
})
