import { Inject, Injectable, Optional } from '@nestjs/common';
import { HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import {
  VISITOR_CURSOR_RESULT_LIMIT,
  VISITOR_CURSOR_TTL_MS,
} from '@applog/common';
import { SyncVisitorCursorDto, type IVisitorCursorResponseDto } from './dto';

interface IStoredVisitorCursor extends SyncVisitorCursorDto {
  updatedAt: number;
}

export const VISITOR_CURSOR_CLOCK = Symbol('VISITOR_CURSOR_CLOCK');

@Injectable()
export class VisitorCursorService {
  private readonly cursors = new Map<string, IStoredVisitorCursor>();

  constructor(
    @Inject(HLOGGER_TOKEN) private readonly logger: HLogger,
    @Optional()
    @Inject(VISITOR_CURSOR_CLOCK)
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * 更新当前访客位置，并返回同页其他访客。
   * @param input - 当前访客位置
   * @returns 同页其他访客的最新位置
   */
  sync(input: SyncVisitorCursorDto): IVisitorCursorResponseDto[] {
    const updatedAt = this.now();
    this.removeExpiredCursors(updatedAt);
    this.cursors.set(this.getCursorKey(input.pagePath, input.visitorKey), {
      ...input,
      updatedAt,
    });

    return [...this.cursors.values()]
      .filter(
        (cursor) =>
          cursor.pagePath === input.pagePath &&
          cursor.visitorKey !== input.visitorKey,
      )
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, VISITOR_CURSOR_RESULT_LIMIT)
      .map(({ visitorKey, displayId, color, x, y, updatedAt: timestamp }) => ({
        visitorKey,
        displayId,
        color,
        x,
        y,
        updatedAt: new Date(timestamp).toISOString(),
        expiresInMs: Math.max(
          0,
          VISITOR_CURSOR_TTL_MS - (updatedAt - timestamp),
        ),
      }));
  }

  private getCursorKey(pagePath: string, visitorKey: string): string {
    return `${pagePath}\u0000${visitorKey}`;
  }

  private removeExpiredCursors(now: number): void {
    const expiresBefore = now - VISITOR_CURSOR_TTL_MS;
    let removedCount = 0;
    for (const [key, cursor] of this.cursors) {
      if (cursor.updatedAt <= expiresBefore) {
        this.cursors.delete(key);
        removedCount += 1;
      }
    }
    if (removedCount > 0) {
      this.log(`已清理 ${removedCount} 个过期访客鼠标`);
    }
  }

  private log(message: string): void {
    this.logger.log(message, VisitorCursorService.name);
  }

  private warn(message: string): void {
    this.logger.warn(message, VisitorCursorService.name);
  }

  private error(message: string): void {
    this.logger.error(message, VisitorCursorService.name);
  }
}
