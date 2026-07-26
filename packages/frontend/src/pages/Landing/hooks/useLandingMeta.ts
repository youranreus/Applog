import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRequest } from 'alova/client';
import { getActiveVisitors } from '@/api/analytics';
import { getCurrentWeather } from '@/api/weather';
import { useSystemStore } from '@/stores/useSystemStore';
import { getSiteUptimeText } from '@/utils/site-uptime';

const ACTIVE_REFRESH_INTERVAL_MS = 30_000;

/**
 * Landing 站点 Meta 数据。
 * 天气与在线人数独立降级；运行时间复用页脚计算工具。
 * @returns 天气、在线人数与运行时间
 */
export function useLandingMeta() {
  const systemStore = useSystemStore();
  const now = ref(Date.now());

  const { data: weatherData } = useRequest(getCurrentWeather, {
    immediate: true,
  });
  const { data: activeData, send: refreshActiveVisitors } = useRequest(
    getActiveVisitors,
    { immediate: true },
  );

  let uptimeTimer: ReturnType<typeof setInterval> | null = null;
  let activeTimer: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    uptimeTimer = setInterval(() => {
      now.value = Date.now();
    }, 1000);
    activeTimer = setInterval(() => {
      void refreshActiveVisitors().catch(() => undefined);
    }, ACTIVE_REFRESH_INTERVAL_MS);
  });

  onUnmounted(() => {
    if (uptimeTimer) clearInterval(uptimeTimer);
    if (activeTimer) clearInterval(activeTimer);
  });

  const onlineVisitors = computed<number | null>(() => {
    return activeData.value?.visitors ?? null;
  });
  const uptimeText = computed<string | null>(() => {
    return getSiteUptimeText(
      systemStore.config?.siteFoundedDate,
      now.value,
    );
  });

  return {
    weather: computed(() => weatherData.value ?? null),
    onlineVisitors,
    uptimeText,
  };
}
