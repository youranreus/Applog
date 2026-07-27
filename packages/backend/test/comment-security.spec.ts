import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { CommentEntity } from '../src/entities';
import {
  gravatarUrl,
  hashWithdrawToken,
  matchesWithdrawToken,
} from '../src/module/comment/comment-security.utils';
import { mapTypechoCommentStatus } from '../src/module/system-config/typecho-comment.utils';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryCommentDto } from '../src/module/comment/dto';
import { MigrateDataDto } from '../src/module/system-config/dto';
import { CommentService } from '../src/module/comment/comment.service';
import { MigrationService } from '../src/module/system-config/migration.service';
import type { IRawComment } from '../src/module/system-config/dto/migration.dto';

function createCommentService(
  commentRepo: Record<string, unknown>,
): CommentService {
  const service = new CommentService(
    { get: (_key: string, fallback: unknown) => fallback } as never,
    {} as never,
  );
  Object.assign(service, {
    commentRepo,
    logger: { log: () => undefined, error: () => undefined },
  });
  return service;
}

async function createCommentByIdentity(user?: { id: number; role: number }) {
  let saved: CommentEntity | undefined;
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
    findOne: async (options: { relations?: string[] }) => {
      if (!options.relations || !saved) return undefined;
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
    postRepo: { findOne: async () => ({ id: 1, status: 'published' }) },
    configRepo: { findOne: async () => undefined },
  });
  const result = await service.create(
    {
      postId: 1,
      content: 'hello',
      guestName: '游客输入',
      guestEmail: 'guest@example.com',
    },
    user as never,
    { ip: '127.0.0.1', agent: 'test-agent' },
  );
  return { result, saved: saved! };
}

describe('comment security contract', () => {
  it('已登录用户评论直接 approved 且不创建撤回凭证', async () => {
    const { result, saved } = await createCommentByIdentity({
      id: 44,
      role: 1,
    });
    assert.equal(saved.status, 'approved');
    assert.equal(saved.authorId, 44);
    assert.equal(saved.withdrawTokenHash, undefined);
    assert.equal(saved.guestName, undefined);
    assert.equal(result.comment.status, 'approved');
    assert.equal('withdrawToken' in result, false);
  });

  it('游客评论保持 pending 并只返回一次明文撤回凭证', async () => {
    const { result, saved } = await createCommentByIdentity();
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

  it('公开查询必须指定文章且不接受状态字段', async () => {
    const missingPost = plainToInstance(QueryCommentDto, {
      page: 1,
      limit: 10,
    });
    assert.equal(
      (await validate(missingPost)).some((item) => item.property === 'postId'),
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
    const runner = {
      manager: {
        getRepository: (entity: typeof CommentEntity) =>
          entity === CommentEntity ? commentRepo : postRepo,
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
    const raw = (coid: number, parent: number): IRawComment => ({
      coid,
      cid: 100,
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
    });
    const importComments = (
      service as unknown as {
        importComments: (comments: IRawComment[]) => Promise<{
          commentsImported: number;
          commentsExisting: number;
        }>;
      }
    ).importComments.bind(service);

    const first = await importComments([raw(2, 1), raw(1, 0)]);
    assert.equal(first.commentsImported, 2);
    assert.equal(stored.find((item) => item.sourceId === '2')?.parentId, 1);

    const second = await importComments([raw(1, 0), raw(2, 1)]);
    assert.equal(second.commentsImported, 0);
    assert.equal(second.commentsExisting, 2);
    assert.equal(stored.length, 2);
  });

  it('comments-only 迁移不读写文章或页面', async () => {
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
          commentsSkippedByStatus: 0,
          commentsMissingPost: 0,
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
