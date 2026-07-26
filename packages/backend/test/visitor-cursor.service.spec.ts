import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { VisitorCursorService } from '../src/module/visitor-cursor/visitor-cursor.service';

const silentLogger = {
  log: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

describe('VisitorCursorService', () => {
  it('只返回同一页面的其他访客', () => {
    let now = 1_000;
    const service = new VisitorCursorService(silentLogger as never, () => now);

    service.sync({
      visitorKey: '11111111-1111-4111-8111-111111111111',
      displayId: 'A001',
      color: '#A23B72',
      pagePath: '/posts',
      x: 0.2,
      y: 0.3,
    });
    now += 1;
    service.sync({
      visitorKey: '22222222-2222-4222-8222-222222222222',
      displayId: 'B002',
      color: '#2F6B5F',
      pagePath: '/landing',
      x: 0.4,
      y: 0.5,
    });
    now += 1;

    const cursors = service.sync({
      visitorKey: '33333333-3333-4333-8333-333333333333',
      displayId: 'C003',
      color: '#8A4F2D',
      pagePath: '/posts',
      x: 0.6,
      y: 0.7,
    });

    assert.deepEqual(cursors, [
      {
        visitorKey: '11111111-1111-4111-8111-111111111111',
        displayId: 'A001',
        color: '#A23B72',
        x: 0.2,
        y: 0.3,
        updatedAt: new Date(1_000).toISOString(),
        expiresInMs: 14_998,
      },
    ]);
  });

  it('15 秒未更新的访客不再返回', () => {
    let now = 5_000;
    const service = new VisitorCursorService(silentLogger as never, () => now);

    service.sync({
      visitorKey: '11111111-1111-4111-8111-111111111111',
      displayId: 'A001',
      color: '#A23B72',
      pagePath: '/posts',
      x: 0.2,
      y: 0.3,
    });
    now += 15_001;

    const cursors = service.sync({
      visitorKey: '22222222-2222-4222-8222-222222222222',
      displayId: 'B002',
      color: '#2F6B5F',
      pagePath: '/posts',
      x: 0.4,
      y: 0.5,
    });

    assert.deepEqual(cursors, []);
  });

  it('同一访客重复同步时覆盖为最新状态', () => {
    let now = 10_000;
    const service = new VisitorCursorService(silentLogger as never, () => now);
    const returningVisitor = {
      visitorKey: '11111111-1111-4111-8111-111111111111',
      displayId: 'A001',
      color: '#A23B72',
      pagePath: '/posts',
      x: 0.2,
      y: 0.3,
    };

    service.sync(returningVisitor);
    now += 1_000;
    service.sync({ ...returningVisitor, x: 0.8, y: 0.9 });
    now += 1_000;
    const cursors = service.sync({
      visitorKey: '22222222-2222-4222-8222-222222222222',
      displayId: 'B002',
      color: '#2F6B5F',
      pagePath: '/posts',
      x: 0.4,
      y: 0.5,
    });

    assert.deepEqual(cursors, [
      {
        visitorKey: returningVisitor.visitorKey,
        displayId: returningVisitor.displayId,
        color: returningVisitor.color,
        x: 0.8,
        y: 0.9,
        updatedAt: new Date(11_000).toISOString(),
        expiresInMs: 14_000,
      },
    ]);
  });

  it('只返回最近活跃的 20 位其他访客', () => {
    let now = 20_000;
    const service = new VisitorCursorService(silentLogger as never, () => now);

    for (let index = 1; index <= 21; index += 1) {
      service.sync({
        visitorKey: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        displayId: index.toString(16).padStart(4, '0').toUpperCase(),
        color: '#A23B72',
        pagePath: '/posts',
        x: 0.2,
        y: 0.3,
      });
      now += 100;
    }

    const cursors = service.sync({
      visitorKey: '99999999-9999-4999-8999-999999999999',
      displayId: 'FFFF',
      color: '#2F6B5F',
      pagePath: '/posts',
      x: 0.4,
      y: 0.5,
    });

    assert.equal(cursors.length, 20);
    assert.equal(cursors[0].displayId, '0015');
    assert.equal(cursors[19].displayId, '0002');
  });
});
