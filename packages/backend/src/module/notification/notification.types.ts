export type HRecipient =
  | { kind: 'user'; userId: number }
  | { kind: 'email'; email: string };

export type CommentNotificationTemplateKey =
  | 'applog-comment-status'
  | 'applog-new-comment'
  | 'applog-comment-reply';

export interface HTemplateNotificationRequest {
  recipients: HRecipient[];
  content: {
    kind: 'template';
    templateKey: CommentNotificationTemplateKey;
    variables: Record<string, string>;
  };
  idempotencyKey: string;
}

export interface HNotificationResponse {
  code: number;
  msg: string;
  data?: { notificationId?: string | number };
}
