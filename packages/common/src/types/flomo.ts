export type FlomoSyncStatus =
  | "never_synced"
  | "syncing"
  | "healthy"
  | "degraded"
  | "reauth_required";

export interface IFlomoConfig {
  token: string;
  publicationTags: string[];
  enabled: boolean;
}

export interface IFlomoAdminStatus {
  status: FlomoSyncStatus;
  lastAttemptedAt: string | null;
  lastSuccessfulAt: string | null;
  publicMemoCount: number;
  errorCategory: string | null;
}

export interface IFlomoAdminConfig extends IFlomoConfig {
  sync: IFlomoAdminStatus;
}

/** Public allowlist. Source identifiers, structured tags and attachments cannot be represented. */
export interface IFlomoPublicMemo {
  id: string;
  previewText: string;
  contentHtml: string;
  displayTags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IFlomoPublicMemoPage {
  items: IFlomoPublicMemo[];
  nextCursor: string | null;
}

export interface IFlomoSyncTriggerResult {
  accepted: boolean;
  alreadyRunning: boolean;
}
