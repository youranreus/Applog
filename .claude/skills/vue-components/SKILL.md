---
name: vue-component
description: 构建 Vue3 SFC 组件，采用分层架构，包含组件、样式、模板、脚本等文件。
license: none
---

## 构建Vue3 SFC组件

你需要按照如下要求构建一个 Vue3 SFC 组件

### 1) 组件文件结构
组件文件结构应该如下：
```
./MyComponent/
├── components/
│   └── // 子组件目录，可选
├── hooks/
│   └── useMyComponent.ts
├── constants.ts
├── utils.ts
├── types.ts
└── index.vue
```
components中应该递归地去编写子组件，每个子组件的文件结构与 MyComponent 相同。

### 2) 各个文件的内容与规范

#### 2.1) index.vue
index.vue 是组件的入口文件，应该包含

1. defineOptions 定义组件选项，必须包含name属性，值为组件的名称。
2. defineProps 定义组件的 props，需要以类型定义的方式定义，例如：defineProps<IProps>()
3. defineEmits 定义组件的 emits，需要以类型定义的方式定义，例如：defineEmits<IEmits>()
4. 类型定义应该都放在 types.ts 文件中，例如：IProps、IEmits 等。
5. 组件内编写顺序应该为：script setup -> template -> style scoped

对于组件的逻辑层，应该编写在 useMyComponent.ts 文件中。该文件的编写请使用 `vue-hooks` SKILL。

以下是完整示例
```vue
<script setup lang="ts">
import { ref } from 'vue'
import { IProps, IEmits } from './types'
import { useMyComponent } from './hooks/useMyComponent'

defineOptions({
  name: 'MyComponent',
})

const props = defineProps<IProps>()
const emits = defineEmits<IEmits>()

const { title } = useMyComponent(props, emits)
</script>

<template>
  <div class="my-component">
    <h1>{{ title }}</h1>
  </div>
</template>

<style scoped lang="scss">
.my-component {
  h1 {
    color: red;
  }
}
</style>
```


#### 2.2) types.ts
types.ts 文件应该包含组件的 props、emits 类型定义。例如：

```ts
export interface IProps {
  title: string
}

export interface IEmits {
  (e: 'click'): void
}
```

#### 2.3) hooks/useMyComponent.ts
hooks/useMyComponent.ts 文件应该包含组件的逻辑层代码。该文件的编写请使用 `vue-hooks` SKILL。

#### 2.4) constants.ts
constants.ts 文件应该包含组件的常量定义。例如：
```ts
export const DEFAULT_TITLE = 'My Component'
```

#### 2.5) utils.ts
utils.ts 文件应该包含组件的工具函数。例如：

请注意
1. **工具函数应该是纯函数，不应该包含任何副作用。**
2. **遵守DRY原则，优先查看项目中的 utils.ts 文件，查看是否有重复的工具函数。**

```ts
export function formatTitle(title: string) {
  return title.toUpperCase()
}
```

### 3) 其他事项

1. 对于样式，你需要判断项目是否使用scss、是否使用tailwind。在style标签中，根据项目情况优先使用 @apply tailwind 类名，其次使用 scss 类名。
