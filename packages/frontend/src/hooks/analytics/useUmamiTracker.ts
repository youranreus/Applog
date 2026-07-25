/**
 * Umami Tracker 注入：auth 就绪后拉公开引导，非 admin 时注入 script
 */
import { watch } from 'vue';
import { storeToRefs } from 'pinia';
import { getAnalyticsTrackerConfig } from '@/api/analytics';
import { useUserStore } from '@/stores/useUserStore';
import { USER_ROLES } from '@/constants/permission';

/** 已注入的 script 标记属性 */
const UMAMI_SCRIPT_ATTR = 'data-applog-umami';

/**
 * 移除页面上由本应用注入的 Umami script
 */
function removeUmamiScript(): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.querySelectorAll(`script[${UMAMI_SCRIPT_ATTR}]`).forEach((node) => {
    node.remove();
  });
}

/**
 * 注入 Umami tracker script（幂等）
 * @param scriptUrl - 脚本地址
 * @param websiteId - Website UUID
 */
function injectUmamiScript(scriptUrl: string, websiteId: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  const existing = document.querySelector(`script[${UMAMI_SCRIPT_ATTR}]`);
  if (existing) {
    return;
  }

  const script = document.createElement('script');
  script.defer = true;
  script.src = scriptUrl;
  script.setAttribute('data-website-id', websiteId);
  script.setAttribute(UMAMI_SCRIPT_ATTR, '1');
  document.head.appendChild(script);
}

/**
 * 在认证初始化完成后按角色与公开配置注入 / 移除 Umami tracker
 * @param authReadyPromise - initializeAuth 完成的 Promise
 *
 * 逻辑说明：
 * 1. 等待 auth 就绪，避免 admin 短暂误注入
 * 2. 监听用户 role：admin → 移除 script；非 admin → 拉 tracker-config 后注入
 * 3. 配置缺失或请求失败时静默跳过，不影响站点
 */
export function setupUmamiTracker(authReadyPromise: Promise<void>): void {
  const userStore = useUserStore();
  const { user } = storeToRefs(userStore);

  /**
   * 根据当前用户与公开配置同步 tracker
   */
  async function syncTracker(): Promise<void> {
    try {
      const isAdmin = user.value?.role === USER_ROLES.ADMIN;
      if (isAdmin) {
        removeUmamiScript();
        // 额外写入 localStorage 标记，避免残留 script 继续采集
        try {
          window.localStorage.setItem('umami.disabled', '1');
        } catch {
          // ignore
        }
        return;
      }

      try {
        window.localStorage.removeItem('umami.disabled');
      } catch {
        // ignore
      }

      const config = await getAnalyticsTrackerConfig();
      if (!config.enabled || !config.scriptUrl || !config.websiteId) {
        removeUmamiScript();
        return;
      }

      injectUmamiScript(config.scriptUrl, config.websiteId);
    } catch {
      // Tracker 失败不影响站点可用性
      removeUmamiScript();
    }
  }

  void (async () => {
    await authReadyPromise;
    await syncTracker();
    watch(
      () => user.value?.role,
      () => {
        void syncTracker();
      },
    );
  })();
}
