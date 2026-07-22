/**
 * 详情页浏览上报辅助：在已发布内容加载成功后静默上报一次
 * 业务向 hook，置于 hooks/analytics/，供文章/页面详情共用
 */
import { watch, type Ref, type ComputedRef } from 'vue';
import { reportAnalyticsView } from '@/api/analytics';
import { getOrCreateVisitorId } from '@/utils/visitor-id';
import type { AnalyticsContentType } from '@/types/analytics';

/**
 * 可上报的内容最小形状
 */
interface IReportableContent {
  id: number;
  status: string;
}

/**
 * 在详情数据变为已发布后上报浏览（失败静默，不影响阅读）
 * @param contentRef - 详情响应式引用
 * @param contentType - post | page
 *
 * 逻辑说明：
 * 1. 监听详情变化；仅 status === published 时上报
 * 2. 同一 contentType+id 成功上报后本生命周期内不重复
 * 3. 上报失败清除标记，便于后续重试
 * 4. 切换到另一篇内容时重新上报
 */
export function useAnalyticsViewReport(
  contentRef:
    | Ref<IReportableContent | null | undefined>
    | ComputedRef<IReportableContent | null | undefined>,
  contentType: AnalyticsContentType,
): void {
  let lastReportedKey: string | null = null;

  watch(
    contentRef,
    (content) => {
      if (!content || content.status !== 'published' || !content.id) {
        return;
      }

      const key = `${contentType}:${content.id}`;
      if (lastReportedKey === key) {
        return;
      }
      // 先占位防并发重复；失败时回滚以便重试
      lastReportedKey = key;

      const visitorId = getOrCreateVisitorId();
      void reportAnalyticsView({
        visitorId,
        contentType,
        contentId: content.id,
      }).catch(() => {
        if (lastReportedKey === key) {
          lastReportedKey = null;
        }
      });
    },
    { immediate: true },
  );
}
