/**
 * Restful API 统一响应结构
 * 所有后端接口都会返回此格式的响应
 * @template T - 响应数据的类型
 */
export interface IRestfulResponse<T> {
  /** 响应数据 */
  data: T;
  /** 响应状态码，0 表示成功 */
  code: number;
  /** 响应消息 */
  msg: string;
}

