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
})
