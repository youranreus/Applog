import type { IVisitorCursorResponse, IVisitorCursorSync } from '@applog/common'
import { alovaInstance } from '@/utils/alova'

/**
 * 同步当前访客鼠标并获取同页其他访客。
 * @param payload - 当前访客位置
 * @returns Alova Method
 */
export const syncVisitorCursor = (payload: IVisitorCursorSync) => {
  return alovaInstance.Post<IVisitorCursorResponse[]>('/visitor-cursor/sync', payload)
}
