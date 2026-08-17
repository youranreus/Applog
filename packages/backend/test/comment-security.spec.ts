import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { CommentEntity, PageEntity, PostEntity } from '../src/entities';
import {
  gravatarUrl,
  hashWithdrawToken,
  matchesWithdrawToken,
} from '../src/module/comment/comment-security.utils';
import { mapTypechoCommentStatus } from '../src/module/system-config/typecho-comment.utils';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCommentDto, QueryCommentDto } from '../src/module/comment/dto';
import { MigrateDataDto } from '../src/module/system-config/dto';
import { CommentService } from '../src/module/comment/comment.service';
import { MigrationService } from '../src/module/system-config/migration.service';
import { TypechoAdapter } from '../src/module/system-config/adapters/typecho.adapter';
import type { IRawComment } from '../src/module/system-config/dto/migration.dto';

function createCommentService(
  commentRepo: Record<string, unknown>,
): CommentService {
  const service = new CommentService(
    { get: (_key: string, fallback: unknown) => fallback } as never,
    {} as never,
    {
      notifyNewComment: async () => undefined,
      notifyCommentStatus: async () => undefined,
      notifyCommentReply: async () => undefined,
    } as never,
  );
  Object.assign(service, {
    commentRepo,
    logger: { log: () => undefined, error: () => undefined },
  });
  return service;
}

async function createCommentByIdentity(
  user?: { id: number; role: number },
  parentId?: number,
) {
  let saved: CommentEntity | undefined;
  let replyNotifications = 0;
  const commentRepo = {
    count: async () => 0,
    create: (value: Partial<CommentEntity>) =>
      Object.assign(new CommentEntity(), value),
    save: async (value: CommentEntity) => {
      saved = Object.assign(value, {
        id: 100,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      });
      return saved;
    },
    findOne: async (options: {
      where?: { id?: number };
      relations?: string[];
    }) => {
      if (!options.relations) {
        return options.where?.id === parentId
          ? Object.assign(new CommentEntity(), {
              id: parentId,
              postId: 1,
              status: 'approved',
            })
          : undefined;
      }
      if (!saved) return undefined;
      if (user) {
        saved.author = {
          ssoId: user.id,
          name: '登录用户',
          email: 'user@example.com',
          avatar: '',
        } as never;
      }
      return saved;
    },
  };
  const service = createCommentService(commentRepo);
  Object.assign(service, {
    notificationService: {
      notifyNewComment: async () => undefined,
      notifyCommentStatus: async () => undefined,
      notifyCommentReply: async () => {
        replyNotifications += 1;
      },
    },
  });
  Object.assign(service, {
    postRepo: { findOne: async () => ({ id: 1, status: 'published' }) },
    configRepo: { findOne: async () => undefined },
  });
  const result = await service.create(
    {
      postId: 1,
      parentId,
      content: 'hello',
      guestName: '游客输入',
      guestEmail: 'guest@example.com',
    },
    user as never,
    { ip: '127.0.0.1', agent: 'test-agent' },
  );
  return { result, saved: saved!, replyNotifications };
}

describe('comment security contract', () => {
  it('已登录用户评论直接 approved 且不创建撤回凭证', async () => {
    const { result, saved, replyNotifications } = await createCommentByIdentity(
      {
        id: 44,
        role: 1,
      },
    );
    assert.equal(saved.status, 'approved');
    assert.equal(saved.authorId, 44);
    assert.equal(saved.withdrawTokenHash, undefined);
    assert.equal(saved.guestName, undefined);
    assert.equal(result.comment.status, 'approved');
    assert.equal('withdrawToken' in result, false);
    assert.equal(replyNotifications, 0);
  });

  it('游客评论保持 pending 并只返回一次明文撤回凭证', async () => {
    const { result, saved, replyNotifications } =
      await createCommentByIdentity();
    assert.equal(saved.status, 'pending');
    assert.equal(saved.authorId, undefined);
    assert.equal(saved.guestName, '游客输入');
    assert.equal(result.comment.status, 'pending');
    assert.equal(typeof result.withdrawToken, 'string');
    assert.equal(
      Buffer.from(result.withdrawToken ?? '', 'base64url').byteLength,
      32,
    );
    assert.equal(
      matchesWithdrawToken(saved.withdrawTokenHash, result.withdrawToken ?? ''),
      true,
    );
    assert.notEqual(saved.withdrawTokenHash, result.withdrawToken);
    assert.equal(replyNotifications, 0);
  });

  it('已登录用户的公开嵌套回复创建后调用回复通知', async () => {
    const { saved, replyNotifications } = await createCommentByIdentity(
      { id: 44, role: 1 },
      9,
    );
    assert.equal(saved.parentId, 9);
    assert.equal(saved.status, 'approved');
    assert.equal(replyNotifications, 1);
  });

  it('只用 SHA-256 摘要核验撤回 token', () => {
    const token = 'a'.repeat(43);
    const hash = hashWithdrawToken(token);
    assert.equal(hash.length, 64);
    assert.notEqual(hash, token);
    assert.equal(matchesWithdrawToken(hash, token), true);
    assert.equal(matchesWithdrawToken(hash, `${token}x`), false);
    assert.equal(matchesWithdrawToken(undefined, token), false);
  });

  it('Gravatar 使用规范化邮箱生成 HTTPS URL', () => {
    assert.equal(
      gravatarUrl('  User@Example.COM '),
      'https://www.gravatar.com/avatar/b58996c504c5638798eb6b511e6f49af?d=identicon',
    );
    assert.equal(gravatarUrl('  '), undefined);
  });

  it('公开作者头像优先使用账号头像，否则回退 Gravatar', () => {
    const service = createCommentService({});
    const toPublic = (
      service as unknown as {
        toPublic: (comment: CommentEntity) => { author: { avatar?: string } };
      }
    ).toPublic.bind(service);
    const base = {
      id: 1,
      content: 'hello',
      postId: 1,
      status: 'approved' as const,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    const account = Object.assign(new CommentEntity(), base, {
      author: {
        ssoId: 2,
        name: '账号',
        email: 'account@example.com',
        avatar: 'https://cdn.example.com/avatar.png',
      },
    });
    assert.equal(toPublic(account).author.avatar, account.author.avatar);

    account.author.avatar = '';
    assert.match(
      toPublic(account).author.avatar ?? '',
      /^https:\/\/www\.gravatar\.com\/avatar\//,
    );
    const guest = Object.assign(new CommentEntity(), base, {
      author: undefined,
      guestName: '游客',
      guestEmail: 'guest@example.com',
    });
    assert.match(
      toPublic(guest).author.avatar ?? '',
      /^https:\/\/www\.gravatar\.com\/avatar\//,
    );
    assert.equal('email' in toPublic(guest).author, false);
  });

  it('CommentEntity 通用序列化不包含审核敏感字段', () => {
    const comment = Object.assign(new CommentEntity(), {
      id: 1,
      content: 'hello',
      postId: 2,
      status: 'approved',
      likeCount: 0,
      guestName: '访客',
      guestEmail: 'private@example.com',
      guestSite: 'https://example.com',
      ip: '127.0.0.1',
      agent: 'secret-agent',
      withdrawTokenHash: 'hash',
      source: 'typecho',
      sourceId: '3',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    const data = comment.getData() as unknown as Record<string, unknown>;
    for (const key of [
      'guestEmail',
      'ip',
      'agent',
      'withdrawTokenHash',
      'source',
      'sourceId',
    ]) {
      assert.equal(key in data, false);
    }
  });

  it('精确映射 Typecho 审核状态', () => {
    assert.equal(mapTypechoCommentStatus('approved'), 'approved');
    assert.equal(mapTypechoCommentStatus('waiting'), 'pending');
    assert.equal(mapTypechoCommentStatus('spam'), 'rejected');
    assert.equal(mapTypechoCommentStatus('unknown'), undefined);
  });

  it('公开创建与查询必须且只能指定文章或页面', async () => {
    const missingTarget = plainToInstance(QueryCommentDto, {
      page: 1,
      limit: 10,
    });
    assert.equal(
      (await validate(missingTarget)).some(
        (item) => item.property === 'commentTarget',
      ),
      true,
    );
    const valid = plainToInstance(QueryCommentDto, {
      postId: 1,
      page: 1,
      limit: 10,
      status: 'rejected',
    });
    assert.deepEqual(await validate(valid), []);
    assert.equal('status' in valid, true);
    assert.equal(
      Object.prototype.hasOwnProperty.call(QueryCommentDto.prototype, 'status'),
      false,
    );
    const pageQuery = plainToInstance(QueryCommentDto, { pageId: 1 });
    assert.deepEqual(await validate(pageQuery), []);
    const nullTarget = plainToInstance(QueryCommentDto, { postId: null });
    assert.equal(
      (await validate(nullTarget)).some(
        (item) => item.property === 'commentTarget',
      ),
      true,
    );
    const conflicting = plainToInstance(CreateCommentDto, {
      content: 'hello',
      postId: 1,
      pageId: 1,
    });
    assert.equal(
      (await validate(conflicting)).some(
        (item) => item.property === 'commentTarget',
      ),
      true,
    );
  });

  it('页面评论创建校验已发布目标并隔离同数字 ID 的父评论和限流', async () => {
    const parent = Object.assign(new CommentEntity(), {
      id: 8,
      postId: 3,
      status: 'approved' as const,
    });
    const countWhere: Array<Record<string, unknown>> = [];
    const service = createCommentService({
      findOne: async () => parent,
      count: async (options: { where: Record<string, unknown> }) => {
        countWhere.push(options.where);
        return 0;
      },
    });
    Object.assign(service, {
      pageRepo: { findOne: async () => ({ id: 3, status: 'published' }) },
      configRepo: { findOne: async () => undefined },
    });
    await assert.rejects(
      () =>
        service.create(
          {
            pageId: 3,
            parentId: parent.id,
            content: 'reply',
            guestName: '游客',
            guestEmail: 'guest@example.com',
          },
          undefined,
          { ip: '127.0.0.1' },
        ),
      (error: Error) => error.message === '父评论不属于该评论目标',
    );
    assert.equal(countWhere.length, 0);
  });

  for (const scenario of [
    {
      name: '文章',
      target: { postId: 3 },
      parent: { postId: 3, pageId: null },
    },
    {
      name: '独立页面',
      target: { pageId: 3 },
      parent: { postId: null, pageId: 3 },
    },
  ] as const) {
    it(`允许回复同一${scenario.name}下未使用目标列为 SQL NULL 的已公开评论`, async () => {
      const parent = Object.assign(new CommentEntity(), scenario.parent, {
        id: 8,
        status: 'approved' as const,
      });
      let saved: CommentEntity | undefined;
      const service = createCommentService({
        findOne: async (options: { relations?: string[] }) =>
          options.relations ? saved : parent,
        count: async () => 0,
        create: (value: Partial<CommentEntity>) =>
          Object.assign(new CommentEntity(), value),
        save: async (value: CommentEntity) => {
          saved = Object.assign(value, {
            id: 9,
            createdAt: new Date(0),
            updatedAt: new Date(0),
          });
          return saved;
        },
      });
      Object.assign(service, {
        postRepo: { findOne: async () => ({ id: 3, status: 'published' }) },
        pageRepo: { findOne: async () => ({ id: 3, status: 'published' }) },
        configRepo: { findOne: async () => undefined },
      });

      const result = await service.create(
        {
          ...scenario.target,
          parentId: parent.id,
          content: 'reply',
        },
        { id: 1, role: 1 } as never,
        { ip: '127.0.0.1' },
      );

      assert.equal(result.comment.parentId, parent.id);
    });
  }

  for (const scenario of [
    {
      name: '父评论属于另一篇文章',
      target: { postId: 3 },
      parent: { postId: 2, pageId: null },
    },
    {
      name: '父评论属于另一个独立页面',
      target: { pageId: 3 },
      parent: { postId: null, pageId: 2 },
    },
    {
      name: '同数字 ID 但目标类型不同',
      target: { pageId: 3 },
      parent: { postId: 3, pageId: null },
    },
    {
      name: '父评论异常地同时关联两种目标',
      target: { postId: 3 },
      parent: { postId: 3, pageId: 3 },
    },
  ] as const) {
    it(`拒绝回复：${scenario.name}`, async () => {
      const parent = Object.assign(new CommentEntity(), scenario.parent, {
        id: 8,
        status: 'approved' as const,
      });
      let persisted = false;
      const service = createCommentService({
        findOne: async () => parent,
        count: async () => 0,
        create: (value: Partial<CommentEntity>) =>
          Object.assign(new CommentEntity(), value),
        save: async (value: CommentEntity) => {
          persisted = true;
          return value;
        },
      });
      Object.assign(service, {
        postRepo: { findOne: async () => ({ id: 3, status: 'published' }) },
        pageRepo: { findOne: async () => ({ id: 3, status: 'published' }) },
        configRepo: { findOne: async () => undefined },
      });

      await assert.rejects(
        () =>
          service.create(
            {
              ...scenario.target,
              parentId: parent.id,
              content: 'reply',
            },
            { id: 1, role: 1 } as never,
            { ip: '127.0.0.1' },
          ),
        (error: Error) => error.message === '父评论不属于该评论目标',
      );
      assert.equal(persisted, false);
    });
  }

  it('页面根评论仅按 pageId 和 IP 限流并写入页面目标', async () => {
    let saved: CommentEntity | undefined;
    let countWhere: Record<string, unknown> | undefined;
    const commentRepo = {
      count: async (options: { where: Record<string, unknown> }) => {
        countWhere = options.where;
        return 0;
      },
      create: (value: Partial<CommentEntity>) =>
        Object.assign(new CommentEntity(), value),
      save: async (value: CommentEntity) => {
        saved = Object.assign(value, {
          id: 9,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        });
        return saved;
      },
      findOne: async (options: { relations?: string[] }) =>
        options.relations ? saved : undefined,
    };
    const service = createCommentService(commentRepo);
    Object.assign(service, {
      pageRepo: { findOne: async () => ({ id: 3, status: 'published' }) },
      configRepo: { findOne: async () => undefined },
    });
    const result = await service.create(
      {
        pageId: 3,
        content: 'page comment',
        guestName: '游客',
        guestEmail: 'guest@example.com',
      },
      undefined,
      { ip: '127.0.0.1' },
    );
    assert.equal(saved?.pageId, 3);
    assert.equal(saved?.postId, undefined);
    assert.equal(result.comment.pageId, 3);
    assert.equal(countWhere?.pageId, 3);
    assert.equal('postId' in (countWhere ?? {}), false);
  });

  it('迁移资源范围接受 comments-only', async () => {
    const dto = plainToInstance(MigrateDataDto, {
      source: 'typecho',
      dbConfig: {
        host: 'localhost',
        port: 3306,
        database: 'typecho',
        username: 'root',
        password: 'secret',
      },
      resources: ['comments'],
    });
    assert.deepEqual(await validate(dto), []);
  });

  it('Typecho 评论查询联结 contents 并读取真实目标类型', async () => {
    let sql = '';
    const adapter = new TypechoAdapter({
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    } as never);
    Object.assign(adapter, {
      config: { tablePrefix: 'typecho_' },
      connection: {
        isInitialized: true,
        query: async (value: string) => {
          sql = value;
          return [];
        },
      },
    });
    await adapter.fetchComments();
    assert.match(sql, /INNER JOIN `typecho_contents` contents/);
    assert.match(sql, /contents\.type AS targetType/);
    assert.match(sql, /comments\.cid = contents\.cid/);
  });

  it('清空页面时存在页面评论必须同时选择 comments', async () => {
    const service = new MigrationService({} as never);
    Object.assign(service, {
      commentRepo: { count: async () => 1 },
    });
    const clearExistingData = (
      service as unknown as {
        clearExistingData: (
          resources: Array<'posts' | 'pages' | 'comments'>,
        ) => Promise<void>;
      }
    ).clearExistingData.bind(service);
    await assert.rejects(
      () => clearExistingData(['pages']),
      (error: Error) =>
        error.message === '清空页面会级联删除评论，请同时选择 comments 资源',
    );
  });

  it('公开单条查询不能绕过非公开父级', async () => {
    const child = Object.assign(new CommentEntity(), {
      id: 2,
      content: 'child',
      postId: 1,
      parentId: 1,
      status: 'approved' as const,
      likeCount: 0,
      guestName: '子评论',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    const service = createCommentService({
      findOne: async (options: { where: { id: number; status?: string } }) =>
        options.where.id === child.id ? child : undefined,
    });

    await assert.rejects(() => service.findOne(child.id));
  });

  it('公开定位按 approved 根评论稳定排序计算页码', async () => {
    const root = Object.assign(new CommentEntity(), {
      id: 10,
      postId: 1,
      status: 'approved' as const,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    const child = Object.assign(new CommentEntity(), {
      id: 11,
      postId: 1,
      parentId: root.id,
      status: 'approved' as const,
    });
    const query = {
      where: () => query,
      andWhere: () => query,
      getCount: async () => 10,
    };
    const service = createCommentService({
      findOne: async (options: { where: { id: number } }) =>
        options.where.id === child.id ? child : root,
      createQueryBuilder: () => query,
    });
    assert.deepEqual(await service.findLocation(child.id, 10), {
      page: 2,
      rootCommentId: root.id,
    });
  });

  it('公开定位不会泄露挂在非公开父级下的评论', async () => {
    const child = Object.assign(new CommentEntity(), {
      id: 21,
      postId: 1,
      parentId: 20,
      status: 'approved' as const,
    });
    const service = createCommentService({
      findOne: async (options: { where: { id: number } }) =>
        options.where.id === child.id ? child : undefined,
    });
    await assert.rejects(
      () => service.findLocation(child.id, 10),
      (error: Error) => error.message === '评论不存在',
    );
  });

  it('审核后显式清空撤回凭证摘要', async () => {
    const comment = Object.assign(new CommentEntity(), {
      id: 3,
      content: 'pending',
      postId: 1,
      status: 'pending' as const,
      likeCount: 0,
      withdrawTokenHash: 'a'.repeat(64),
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    let saved: CommentEntity | undefined;
    const service = createCommentService({
      findOne: async () => comment,
      save: async (value: CommentEntity) => {
        saved = value;
        return value;
      },
    });
    service.getDeleteImpact = async () => ({
      id: comment.id,
      descendantCount: 0,
      totalCount: 1,
    });

    await service.approve(comment.id, { status: 'approved' });
    assert.equal(saved?.withdrawTokenHash, null);
  });

  it('待审核 capability 重复提交时只返回一份评论', async () => {
    const token = 'b'.repeat(43);
    const comment = Object.assign(new CommentEntity(), {
      id: 4,
      content: 'pending',
      postId: 1,
      status: 'pending' as const,
      likeCount: 0,
      guestName: '游客',
      withdrawTokenHash: hashWithdrawToken(token),
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    const query = {
      addSelect: () => query,
      leftJoinAndSelect: () => query,
      where: () => query,
      andWhere: () => query,
      getMany: async () => [comment],
    };
    const service = createCommentService({ createQueryBuilder: () => query });

    const resolved = await service.resolvePending([
      { commentId: comment.id, token },
      { commentId: comment.id, token },
    ]);
    assert.equal(resolved.length, 1);
  });

  it('Typecho 评论按拓扑导入并在重跑时命中幂等键', async () => {
    const stored: CommentEntity[] = [];
    const commentRepo = {
      find: async () => stored.filter((item) => item.source === 'typecho'),
      findOne: async (options: {
        where: { source: string; sourceId: string };
      }) =>
        stored.find(
          (item) =>
            item.source === options.where.source &&
            item.sourceId === options.where.sourceId,
        ),
      create: (value: Partial<CommentEntity>) =>
        Object.assign(new CommentEntity(), value),
      save: async (value: CommentEntity) => {
        const duplicate = stored.find(
          (item) =>
            item.source === value.source && item.sourceId === value.sourceId,
        );
        if (duplicate) throw new Error('duplicate source key');
        value.id = stored.length + 1;
        stored.push(value);
        return value;
      },
    };
    const postRepo = {
      find: async () => [
        { id: 10, extra: { migratedFrom: 'typecho', originalId: 100 } },
      ],
    };
    const pageRepo = {
      find: async () => [
        { id: 20, extra: { migratedFrom: 'typecho', originalId: 200 } },
      ],
    };
    const runner = {
      manager: {
        getRepository: (
          entity: typeof CommentEntity | typeof PostEntity | typeof PageEntity,
        ) => {
          if (entity === CommentEntity) return commentRepo;
          return entity === PostEntity ? postRepo : pageRepo;
        },
      },
      connect: async () => undefined,
      startTransaction: async () => undefined,
      commitTransaction: async () => undefined,
      rollbackTransaction: async () => undefined,
      release: async () => undefined,
    };
    const service = new MigrationService({
      createQueryRunner: () => runner,
    } as never);
    Object.assign(service, {
      logger: {
        log: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    });
    const raw = (
      coid: number,
      parent: number,
      targetType: 'post' | 'page' = 'post',
    ): IRawComment => ({
      coid,
      cid: targetType === 'post' ? 100 : 200,
      created: 1_700_000_000 + coid,
      author: `guest-${coid}`,
      authorId: 0,
      ownerId: 1,
      mail: `guest-${coid}@example.com`,
      url: '',
      ip: '127.0.0.1',
      agent: 'test',
      text: `comment-${coid}`,
      type: 'comment',
      status: 'approved',
      parent,
      targetType,
    });
    const importComments = (
      service as unknown as {
        importComments: (comments: IRawComment[]) => Promise<{
          commentsImported: number;
          commentsExisting: number;
        }>;
      }
    ).importComments.bind(service);

    const first = await importComments([
      raw(2, 1),
      raw(1, 0),
      raw(4, 3, 'page'),
      raw(3, 0, 'page'),
      raw(5, 1, 'page'),
    ]);
    assert.equal(first.commentsImported, 5);
    assert.equal(
      stored.find((item) => item.sourceId === '2')?.parentId,
      stored.find((item) => item.sourceId === '1')?.id,
    );
    assert.equal(stored.find((item) => item.sourceId === '3')?.pageId, 20);
    assert.equal(
      stored.find((item) => item.sourceId === '4')?.parentId,
      stored.find((item) => item.sourceId === '3')?.id,
    );
    assert.equal(
      stored.find((item) => item.sourceId === '5')?.parentId,
      undefined,
    );
    assert.equal(first.commentsMissingParent, 1);

    const skipped = await importComments([
      { ...raw(6, 0, 'page'), cid: 999 },
      { ...raw(7, 0), targetType: 'attachment' },
    ]);
    assert.equal(skipped.commentsMissingPage, 1);
    assert.equal(skipped.commentsSkippedByTargetType, 1);

    const second = await importComments([raw(1, 0), raw(2, 1)]);
    assert.equal(second.commentsImported, 0);
    assert.equal(second.commentsExisting, 2);
    assert.equal(stored.length, 5);
  });

  it('comments-only 迁移不抓取 Typecho 文章或页面', async () => {
    let postsFetched = 0;
    let pagesFetched = 0;
    let commentsImported = 0;
    const adapter = {
      connect: async () => undefined,
      validateConnection: async () => true,
      fetchPosts: async () => {
        postsFetched++;
        return [];
      },
      fetchPages: async () => {
        pagesFetched++;
        return [];
      },
      fetchComments: async () => [
        {
          coid: 1,
          cid: 100,
          created: 1,
          author: 'guest',
          authorId: 0,
          ownerId: 1,
          mail: '',
          url: '',
          ip: '',
          agent: '',
          text: 'comment',
          type: 'comment',
          status: 'approved',
          parent: 0,
          targetType: 'post',
        },
      ],
      disconnect: async () => undefined,
    };
    const service = new MigrationService({} as never);
    Object.assign(service, {
      logger: {
        log: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      getAdapter: () => adapter,
      importComments: async () => {
        commentsImported++;
        return {
          commentsImported: 1,
          commentsExisting: 0,
          commentsSkippedByType: 0,
          commentsSkippedByTargetType: 0,
          commentsSkippedByStatus: 0,
          commentsMissingPost: 0,
          commentsMissingPage: 0,
          commentsMissingParent: 0,
          commentsFailed: 0,
        };
      },
    });

    const result = await service.migrate(
      {
        source: 'typecho',
        dbConfig: {
          host: 'localhost',
          port: 3306,
          database: 'typecho',
          username: 'root',
          password: 'secret',
        },
        resources: ['comments'],
      },
      { id: 1 } as never,
    );

    assert.equal(postsFetched, 0);
    assert.equal(pagesFetched, 0);
    assert.equal(commentsImported, 1);
    assert.equal(result.data.postsImported, 0);
    assert.equal(result.data.pagesImported, 0);
  });
});
