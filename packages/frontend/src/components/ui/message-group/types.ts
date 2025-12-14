/**
 * 单条消息数据结构
 */
export interface IMessage {
  /** 消息唯一标识 */
  id: string
  /** 消息内容（Markdown 格式） */
  content: string
}

/**
 * 消息组组件 Props
 */
export interface IMessageGroupProps {
  /** 头像 URL（可选） */
  avatar?: string
  /** 消息列表 */
  messages: IMessage[]
  /** 状态文本（可选） */
  status?: string
}
