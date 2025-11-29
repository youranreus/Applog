import type { Config } from 'tailwindcss'

/**
 * Tailwind CSS 配置文件
 * 用于自定义 Tailwind 的默认样式，如字体大小、颜色、间距等
 */
const config: Config = {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
    './node_modules/konsta/vue/**/*.{js,ts,vue}',
  ],
  theme: {
    extend: {
      /**
       * 自定义字体大小
       * 可以覆盖或扩展 Tailwind 的默认字体大小
       */
      fontSize: {        
        // 也可以扩展新的字体大小类名
        // '2xs': ['10px', { lineHeight: '1.4' }],
        // '3xl': ['30px', { lineHeight: '1.2' }],
      },
      
      /**
       * 其他可自定义的样式...
       * 注意：在 Tailwind v4 中，颜色应该在 CSS 文件的 @theme 块中定义
       */
      // spacing: {
      //   // 自定义间距
      // },
      // borderRadius: {
      //   // 自定义圆角
      // },
    },
  },
  plugins: [],
}

export default config

