import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { CommentEntity } from '../src/entities';
import { CommentService } from '../src/module/comment/comment.service';

function makeService(comment: CommentEntity) {
  let saves = 0;
  let notifications = 0;
  const service = new CommentService(
    { get: (_key: string, fallback: unknown) => fallback } as never,
    {} as never,
    {
      notifyCommentStatus: async () => {
        notifications += 1;
      },
    } as never,
  );
  Object.assign(service, {
    logger: { log() {}, error() {} },
    commentRepo: {
      findOne: async () => comment,
      find: async () => [],
      save: async (value: CommentEntity) => {
        saves += 1;
        value.updatedAt = new Date(2000);
        return value;
      },
      createQueryBuilder: () => ({
        leftJoinAndSelect() {
          return this;
        },
        where() {
          return this;
        },
        orderBy() {
          return this;
        },
        getMany: async () => [],
      }),
    },
  });
  return { service, saves: () => saves, notifications: () => notifications };
}

describe('comment notification triggers', () => {
  it('does not save, clear capability, or notify for a status no-op', async () => {
    const comment = Object.assign(new CommentEntity(), {
      id: 1,
      status: 'approved',
      withdrawTokenHash: 'unchanged',
      content: 'x',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    const fixture = makeService(comment);
    await fixture.service.approve(1, { status: 'approved' });
    assert.equal(fixture.saves(), 0);
    assert.equal(fixture.notifications(), 0);
    assert.equal(comment.withdrawTokenHash, 'unchanged');
  });

  it('persists a real transition before notifying', async () => {
    const comment = Object.assign(new CommentEntity(), {
      id: 2,
      status: 'pending',
      withdrawTokenHash: 'hash',
      content: 'x',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    const fixture = makeService(comment);
    await fixture.service.approve(2, { status: 'rejected' });
    assert.equal(fixture.saves(), 1);
    assert.equal(fixture.notifications(), 1);
    assert.equal(comment.withdrawTokenHash, null);
  });
});
