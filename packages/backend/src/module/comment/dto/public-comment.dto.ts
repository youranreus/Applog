export interface IPublicCommentAuthorDto {
  id?: number;
  name: string;
  avatar?: string;
  site?: string;
}

export interface IPublicCommentDto {
  id: number;
  content: string;
  postId?: number;
  pageId?: number;
  parentId?: number;
  status: 'approved' | 'pending';
  author: IPublicCommentAuthorDto;
  createdAt: Date;
  updatedAt: Date;
  replies?: IPublicCommentDto[];
}

export interface ICreateCommentResponseDto {
  comment: IPublicCommentDto;
  withdrawToken?: string;
}
