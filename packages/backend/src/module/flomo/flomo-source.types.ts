export type FlomoSourceErrorCategory =
  | 'unauthorized'
  | 'rate_limited'
  | 'timeout'
  | 'schema'
  | 'compatibility'
  | 'upstream';

export class FlomoSourceError extends Error {
  constructor(
    public readonly category: FlomoSourceErrorCategory,
    public readonly status?: number,
  ) {
    super(`Flomo source ${category}`);
    this.name = 'FlomoSourceError';
  }
}

export interface IFlomoSourceCursor {
  updatedAt: Date | null;
  slug: string;
}

export interface IFlomoSourceMemo {
  slug: string;
  contentHtml: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
}

export interface IFlomoSourceResult {
  memos: IFlomoSourceMemo[];
  cursor: IFlomoSourceCursor;
}

export interface FlomoSourceAdapter {
  fetchChanges(
    token: string,
    cursor: IFlomoSourceCursor,
  ): Promise<IFlomoSourceResult>;
}

export const FLOMO_SOURCE_ADAPTER = Symbol('FLOMO_SOURCE_ADAPTER');
