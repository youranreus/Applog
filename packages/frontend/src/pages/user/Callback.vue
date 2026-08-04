<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/useUserStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/**
 * 路由实例
 */
const route = useRoute()
const router = useRouter()

/**
 * 用户 Store
 */
const userStore = useUserStore()

/**
 * 错误信息
 */
const error = ref<string | null>(null)

/**
 * 处理后端已经验证完成的 OIDC 回调
 * 成功后跳转到首页，失败则显示错误信息
 */
async function handleCallback(): Promise<void> {
  try {
    if (route.query.error) throw new Error('登录失败，请重新开始登录')
    await userStore.handleOidcCallback()

    // 成功后跳转：如果有保存的 redirect 参数，跳转到原页面，否则跳转到首页
    const redirect = sessionStorage.getItem('login_redirect')
    if (redirect) {
      sessionStorage.removeItem('login_redirect')
      await router.push(decodeURIComponent(redirect))
    } else {
      await router.push('/')
    }
  } catch (err) {
    console.error('处理 OIDC 回调失败:', err)
    error.value = err instanceof Error ? err.message : '处理 SSO 回调失败'
  }
}

/**
 * 组件挂载时自动处理回调
 */
onMounted(() => {
  handleCallback()
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background">
    <div class="w-full max-w-md px-6 py-12">
      <Card>
        <CardContent>
          <h2 class="text-2xl font-bold mb-4">登录</h2>

          <p v-if="!error" class="text-sm text-muted-foreground">正在处理登录...</p>
          <template v-else>
            <p class="mb-4 text-destructive">{{ error }}</p>

            <Button class="w-full" @click="router.push('/user/login')"> 重新登录 </Button>
          </template>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
