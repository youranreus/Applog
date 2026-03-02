import type { IProps, IEmits } from '../types';
import {
  getColSpanClass,
  getRowSpanClass,
  getCardThemeClass,
  getCardBgStyle,
  getHrefType,
} from '../utils';

/**
 * Landing 页面逻辑：暴露栅格/卡片 class 计算函数供模板使用
 * @param _props - 组件 props（当前未使用，预留扩展）
 * @param _emits - 组件 emits（当前未使用，预留扩展）
 */
export function useLanding(_props: IProps, _emits: IEmits) {
  return {
    getColSpanClass,
    getRowSpanClass,
    getCardThemeClass,
    getCardBgStyle,
    getHrefType,
  };
}
