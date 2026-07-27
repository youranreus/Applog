export interface IMigrationDatabaseConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
  tablePrefix?: string
}

export interface ICommentMigrationPayload {
  source: 'typecho'
  dbConfig: IMigrationDatabaseConfig
  resources: ['comments']
}

export interface ICommentMigrationStats {
  postsImported: number
  pagesImported: number
  postsFailed: number
  pagesFailed: number
  commentsImported: number
  commentsExisting: number
  commentsSkippedByType: number
  commentsSkippedByTargetType: number
  commentsSkippedByStatus: number
  commentsMissingPost: number
  commentsMissingPage: number
  commentsMissingParent: number
  commentsFailed: number
  duration: string
}

export interface ICommentMigrationResult {
  success: boolean
  message: string
  data: ICommentMigrationStats
}
