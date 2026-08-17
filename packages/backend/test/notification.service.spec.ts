import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { NotificationService } from '../src/module/notification/notification.service';
import type { HTemplateNotificationRequest } from '../src/module/notification/notification.types';
import { CommentEntity } from '../src/entities';

function makeService(options?: {
  enabled?: boolean;
  adminIds?: Array<number | null>;
}) {
  const sent: HTemplateNotificationRequest[] = [];
  const service = new NotificationService(
    {
      get: (key: string, fallback: string) =>
        key === 'FRONT_URL' ? 'https://blog.example/' : fallback,
    } as never,
    {
      getNotificationConfigRaw: async () => ({
        mailToken: 'secret',
        enabled: options?.enabled !== false,
      }),
      getBaseConfigRaw: async () => ({ title: 'My Blog' }),
    } as never,
    {
      send: async (_token: string, payload: HTemplateNotificationRequest) => {
        sent.push(payload);
      },
    } as never,
  );
  Object.assign(service, {
    logger: { log() {}, warn() {}, error() {} },
    userRepo: {
      find: async () => (options?.adminIds ?? [3]).map((ssoId) => ({ ssoId })),
      findOne: async () => null,
    },
    commentRepo: { findOne: async () => null },
    postRepo: {
      findOne: async () => ({ id: 1, title: 'Hello', slug: 'hello world' }),
    },
    pageRepo: { findOne: async () => null },
  });
  return { service, sent };
}

describe('NotificationService', () => {
  it('sorts, deduplicates and batches administrator recipients', async () => {
    const ids = [
      22,
      1,
      22,
      null,
      ...Array.from({ length: 20 }, (_, i) => i + 2),
    ];
    const { service, sent } = makeService({ adminIds: ids });
    await service.notifyNewComment(
      Object.assign(new CommentEntity(), {
        id: 9,
        postId: 1,
        guestName: 'Guest',
        content: '<b>Hello</b>   world',
      }),
    );
    assert.equal(sent.length, 2);
    assert.equal(sent[0].recipients.length, 20);
    assert.deepEqual(sent[0].recipients[0], { kind: 'user', userId: 1 });
    assert.equal(sent[0].idempotencyKey, 'applog-new-comment-9-b0');
    assert.equal(sent[1].idempotencyKey, 'applog-new-comment-9-b1');
    assert.deepEqual(sent[0].content.variables, {
      siteName: 'My Blog',
      targetTitle: 'Hello',
      targetType: '文章',
      commenterName: 'Guest',
      commentExcerpt: 'Hello world',
      adminUrl: 'https://blog.example/user/comment',
    });
  });

  it('uses guest email only as recipient and omits hidden anchor when rejected', async () => {
    const { service, sent } = makeService();
    await service.notifyCommentStatus(
      Object.assign(new CommentEntity(), {
        id: 10,
        postId: 1,
        guestName: 'Guest',
        guestEmail: 'guest@example.com',
        content: 'hello',
        status: 'rejected',
        updatedAt: new Date(1234),
      }),
    );
    assert.deepEqual(sent[0].recipients, [
      { kind: 'email', email: 'guest@example.com' },
    ]);
    assert.equal(
      sent[0].content.variables.viewUrl,
      'https://blog.example/archives/hello%20world.html',
    );
    assert.equal(
      sent[0].idempotencyKey,
      'applog-comment-status-10-rejected-1234-b0',
    );
    assert.equal('email' in sent[0].content.variables, false);
  });

  it('skips all outbound requests while disabled', async () => {
    const { service, sent } = makeService({ enabled: false });
    await service.notifyNewComment(
      Object.assign(new CommentEntity(), { id: 1, postId: 1, content: 'x' }),
    );
    assert.equal(sent.length, 0);
  });

  it('does not fall back to email for an authenticated author without ssoId', async () => {
    const { service, sent } = makeService();
    Object.assign(service, {
      userRepo: {
        find: async () => [],
        findOne: async () => ({
          id: 8,
          name: 'Private User',
          email: 'private@example.com',
          ssoId: null,
        }),
      },
    });

    await service.notifyCommentStatus(
      Object.assign(new CommentEntity(), {
        id: 11,
        authorId: 8,
        postId: 1,
        content: 'hello',
        status: 'approved',
        updatedAt: new Date(1234),
      }),
    );

    assert.equal(sent.length, 0);
  });

  it('continues with later administrator batches after one batch fails', async () => {
    const { service } = makeService({
      adminIds: Array.from({ length: 21 }, (_, index) => index + 1),
    });
    const attemptedKeys: string[] = [];
    Object.assign(service, {
      client: {
        send: async (_token: string, payload: HTemplateNotificationRequest) => {
          attemptedKeys.push(payload.idempotencyKey);
          if (attemptedKeys.length === 1) throw new Error('upstream failed');
        },
      },
    });

    await service.notifyNewComment(
      Object.assign(new CommentEntity(), {
        id: 12,
        postId: 1,
        content: 'hello',
      }),
    );

    assert.deepEqual(attemptedKeys, [
      'applog-new-comment-12-b0',
      'applog-new-comment-12-b1',
    ]);
  });

  it('notifies only the direct guest parent with private, stable variables', async () => {
    const { service, sent } = makeService();
    Object.assign(service, {
      commentRepo: {
        findOne: async () =>
          Object.assign(new CommentEntity(), {
            id: 4,
            parentId: 2,
            guestName: 'Parent',
            guestEmail: ' parent@example.com ',
            content: '<b>Parent</b>   comment',
          }),
      },
    });
    await service.notifyCommentReply(
      Object.assign(new CommentEntity(), {
        id: 13,
        parentId: 4,
        postId: 1,
        status: 'approved',
        guestName: 'Replier',
        guestEmail: 'reply@example.com',
        content: '<i>Reply</i> text',
      }),
    );
    assert.deepEqual(sent[0].recipients, [
      { kind: 'email', email: 'parent@example.com' },
    ]);
    assert.equal(sent[0].content.templateKey, 'applog-comment-reply');
    assert.equal(sent[0].idempotencyKey, 'applog-comment-reply-13-b0');
    assert.deepEqual(sent[0].content.variables, {
      parentCommenterName: 'Parent',
      replierName: 'Replier',
      targetTitle: 'Hello',
      targetType: '文章',
      parentCommentExcerpt: 'Parent comment',
      replyExcerpt: 'Reply text',
      viewUrl: 'https://blog.example/archives/hello%20world.html#comment-13',
    });
  });

  it('uses parent ssoId and does not fall back to account email', async () => {
    const { service, sent } = makeService();
    const parent = Object.assign(new CommentEntity(), {
      id: 4,
      authorId: 7,
      author: { id: 7, name: 'Parent', email: 'hidden@example.com', ssoId: 70 },
      content: 'parent',
    });
    Object.assign(service, { commentRepo: { findOne: async () => parent } });
    const reply = Object.assign(new CommentEntity(), {
      id: 14,
      parentId: 4,
      postId: 1,
      status: 'approved',
      guestName: 'Guest',
      guestEmail: 'guest@example.com',
      content: 'reply',
    });
    await service.notifyCommentReply(reply);
    assert.deepEqual(sent[0].recipients, [{ kind: 'user', userId: 70 }]);
    parent.author.ssoId = null;
    await service.notifyCommentReply(Object.assign(reply, { id: 15 }));
    assert.equal(sent.length, 1);
  });

  it('suppresses all defined provable self-reply identities', async () => {
    const cases = [
      [
        { authorId: 7, author: { id: 7, name: 'P', ssoId: 70 } },
        { authorId: 7, author: { id: 7, name: 'R' } },
      ],
      [
        { guestEmail: ' Same@Example.com ', guestName: 'P' },
        { guestEmail: 'same@example.COM', guestName: 'R' },
      ],
      [
        { guestEmail: 'same@example.com', guestName: 'P' },
        {
          authorId: 9,
          author: { id: 9, name: 'R', email: ' SAME@example.com ' },
        },
      ],
    ] as const;
    for (const [index, [parentIdentity, replyIdentity]] of cases.entries()) {
      const { service, sent } = makeService();
      Object.assign(service, {
        commentRepo: {
          findOne: async () =>
            Object.assign(new CommentEntity(), {
              id: 4,
              content: 'parent',
              ...parentIdentity,
            }),
        },
      });
      await service.notifyCommentReply(
        Object.assign(new CommentEntity(), {
          id: 20 + index,
          parentId: 4,
          postId: 1,
          status: 'approved',
          content: 'reply',
          ...replyIdentity,
        }),
      );
      assert.equal(sent.length, 0);
    }
  });

  it('skips top-level, pending, and rejected comments', async () => {
    const { service, sent } = makeService();
    await service.notifyCommentReply(
      Object.assign(new CommentEntity(), { id: 30, status: 'approved' }),
    );
    await service.notifyCommentReply(
      Object.assign(new CommentEntity(), {
        id: 31,
        parentId: 4,
        status: 'pending',
      }),
    );
    await service.notifyCommentReply(
      Object.assign(new CommentEntity(), {
        id: 32,
        parentId: 4,
        status: 'rejected',
      }),
    );
    assert.equal(sent.length, 0);
  });
});
