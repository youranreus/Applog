import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useLayoutStore } from '@/stores/useLayoutStore';
import type { IProps, IEmits } from '../types';
import { SHOW_BACK_ROUTES } from '@/constants/nav';

/**
 * UserHeader 组件逻辑层
 * 提供导航列表与返回行为
 * @param props - 组件 props
 * @param _emits - 组件 emits（当前未使用）
 * @returns navPages 与 handleBack，供模板使用
 */
export function useUserHeader(_props: IProps, _emits: IEmits) {
  const layoutStore = useLayoutStore();
  const router = useRouter();

  const navPages = computed(() => layoutStore.navPages);

  /**
   * 执行浏览器后退
   */
  function handleBack(): void {
    router.back();
  }

  const showBack = computed(() => {
    return SHOW_BACK_ROUTES.includes(router.currentRoute.value.name as string);
  });

  return {
    navPages,
    showBack,
    handleBack,
  };
}
