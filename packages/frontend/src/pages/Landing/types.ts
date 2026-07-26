/** Landing 最近文章视图模型 */
export interface ILandingPost {
  id: number;
  slug: string;
  title: string;
  summary?: string;
  cover?: string;
  publishedAt: string;
  publishedAtIso?: string;
}

/** Landing 社交入口类型 */
export type LandingSocialKind = 'home' | 'bilibili' | 'github';

/** Landing 可展示链接 */
export interface ILandingLink {
  href: string;
  external: boolean;
}

/** Landing 社交入口 */
export interface ILandingSocialLink extends ILandingLink {
  kind: LandingSocialKind;
  label: string;
}
