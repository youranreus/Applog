import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SyncVisitorCursorDto } from '../src/module/visitor-cursor/dto';

describe('SyncVisitorCursorDto', () => {
  it('接受符合合同的访客鼠标', async () => {
    const dto = plainToInstance(SyncVisitorCursorDto, {
      visitorKey: '11111111-1111-4111-8111-111111111111',
      displayId: 'A01F',
      color: '#A23B72',
      pagePath: '/archives/hello.html',
      x: 0.25,
      y: 0.75,
    });

    assert.deepEqual(await validate(dto), []);
  });

  it('拒绝非法身份、路径和越界坐标', async () => {
    const dto = plainToInstance(SyncVisitorCursorDto, {
      visitorKey: 'not-a-uuid',
      displayId: 'visitor',
      color: 'transparent',
      pagePath: 'https://example.com/posts?secret=1',
      x: -0.1,
      y: 1.1,
    });

    const properties = (await validate(dto))
      .map((error) => error.property)
      .sort();

    assert.deepEqual(properties, [
      'color',
      'displayId',
      'pagePath',
      'visitorKey',
      'x',
      'y',
    ]);
  });
});
