<script setup lang="ts">
import { computed } from 'vue'
import LandingMeta from './components/LandingMeta.vue'
import LandingProfile from './components/LandingProfile.vue'
import LandingRecentPosts from './components/LandingRecentPosts.vue'
import LandingSlogan from './components/LandingSlogan.vue'
import LandingDuolingoStats from './components/LandingDuolingoStats.vue'
import LandingGarminStats from './components/LandingGarminStats/index.vue'
import LandingYesterdayStatus from './components/LandingYesterdayStatus/index.vue'
import { LANDING_DEFAULTS } from './constants'
import { useLanding } from './hooks/useLanding'
import { useLandingMeta } from './hooks/useLandingMeta'
import { useLandingDuolingoStats } from './hooks/useLandingDuolingoStats'
import { useLandingGarminStats } from './hooks/useLandingGarminStats'
import { useLandingYesterdayStatus } from './hooks/useLandingYesterdayStatus'
import type { ILandingSocialLink } from './types'
import { normalizeLandingLink, resolveLandingText } from './utils'
import { useSystemStore } from '@/stores/useSystemStore'
import { useSeoHead } from '@/hooks/useSeoHead'
import { useWebSiteJsonLd } from '@/hooks/useJsonLd'

defineOptions({
  name: 'Landing',
})

const systemStore = useSystemStore()
const { recentPosts, postsLoading, hasPostError } = useLanding()
const { weather, onlineVisitors, uptimeText } = useLandingMeta()
const { stats: duolingoStats, loading: duolingoLoading } = useLandingDuolingoStats()
const { stats: garminStats, loading: garminLoading } = useLandingGarminStats()
const {
  status: yesterdayStatus,
  loading: yesterdayLoading,
  unavailable: yesterdayUnavailable,
} = useLandingYesterdayStatus()
const SITE_URL = import.meta.env.VITE_SITE_URL || ''

const siteTitle = computed(() => {
  return systemStore.config?.title?.trim() || 'AppLog'
})
const siteDescription = computed(() => {
  return systemStore.config?.description?.trim() || LANDING_DEFAULTS.bio
})
const profileTitle = computed(() => {
  return systemStore.config?.landingTitle?.trim() || siteTitle.value
})
const profileSubtitle = computed(() => {
  return resolveLandingText(systemStore.config?.landingBio, LANDING_DEFAULTS.bio)
})
const slogan = computed(() => {
  return resolveLandingText(systemStore.config?.landingSlogan, LANDING_DEFAULTS.slogan)
})
const socialLinks = computed<ILandingSocialLink[]>(() => {
  const links: Array<ILandingSocialLink | null> = []
  const homepage = normalizeLandingLink(systemStore.config?.personalHomepageUrl, {
    fallback: LANDING_DEFAULTS.personalHomepageUrl,
    allowInternal: true,
  })
  const bilibili = normalizeLandingLink(systemStore.config?.bilibiliUrl)
  const github = normalizeLandingLink(systemStore.config?.githubUrl, {
    fallback: LANDING_DEFAULTS.githubUrl,
  })

  if (homepage) links.push({ ...homepage, kind: 'home', label: '个人主页' })
  if (bilibili) links.push({ ...bilibili, kind: 'bilibili', label: 'Bilibili' })
  if (github) links.push({ ...github, kind: 'github', label: 'GitHub' })
  return links.filter((link): link is ILandingSocialLink => Boolean(link))
})

useSeoHead({
  description: () => siteDescription.value,
  canonicalPath: '/landing',
})

useWebSiteJsonLd({
  name: siteTitle.value,
  description: siteDescription.value,
  url: SITE_URL,
})
</script>

<template>
  <main class="landing-page">
    <div class="common-page-container common-page-container--flush landing-shell">
      <LandingMeta :weather="weather" :online-visitors="onlineVisitors" :uptime-text="uptimeText" />
      <LandingProfile
        :title="profileTitle"
        :subtitle="profileSubtitle"
        :social-links="socialLinks"
      />
      <LandingRecentPosts :posts="recentPosts" :loading="postsLoading" :has-error="hasPostError" />
      <LandingYesterdayStatus
        :status="yesterdayStatus"
        :loading="yesterdayLoading"
        :unavailable="yesterdayUnavailable"
      />
      <LandingGarminStats
        v-if="garminLoading || garminStats"
        :stats="garminStats"
        :loading="garminLoading"
      />
      <LandingDuolingoStats
        v-if="duolingoLoading || duolingoStats"
        :stats="duolingoStats"
        :loading="duolingoLoading"
      />
      <LandingSlogan v-if="slogan" :slogan="slogan" />
    </div>
  </main>
</template>

<style scoped>
.landing-page {
  --landing-canvas: var(--color-frost);
  --landing-surface: var(--color-card);
  --landing-surface-soft: var(--color-ice);
  --landing-text: var(--color-carbon);
  --landing-muted: var(--color-ash);
  --landing-primary: var(--color-apple-blue);
  --landing-link: var(--color-link-blue);
  --landing-font:
    'SF Pro Text', Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
    Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --landing-font-heading: 'SF Pro Display', var(--landing-font);

  width: 100%;
  min-height: 100vh;
  background: var(--landing-canvas);
  color: var(--landing-text);
  font-family: var(--landing-font);
}

.landing-shell {
  padding-top: clamp(6.5rem, 12vw, 7.5rem);
  padding-bottom: clamp(5rem, 12vw, 8rem);
}
</style>
