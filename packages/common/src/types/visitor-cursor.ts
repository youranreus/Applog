export interface IVisitorCursorIdentity {
  visitorKey: string;
  displayId: string;
  color: string;
}

export interface IVisitorCursorPosition {
  x: number;
  y: number;
}

export interface IVisitorCursorSync
  extends IVisitorCursorIdentity,
    IVisitorCursorPosition {
  pagePath: string;
}

export interface IVisitorCursorResponse
  extends IVisitorCursorIdentity,
    IVisitorCursorPosition {
  updatedAt: string;
  expiresInMs: number;
}
