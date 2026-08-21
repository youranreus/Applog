<script setup lang="ts">
import { computed } from 'vue'
import type { CSSProperties } from 'vue'
import type {
  IWakaTimeAiStats,
  IWakaTimeBreakdownItem,
  IWakaTimeLandingStats,
} from '@applog/common'
import {
  formatCompactToken,
  formatEstimatedUsd,
  formatWakaTimeDateRange,
  getWakaTimeTagTint,
  getWakaTimeTokenShares,
  sortWakaTimeUsageItems,
  sumKnownTokens,
} from '../../wakatime-utils'

interface ITokenItem {
  key: 'input' | 'cachedInput' | 'output'
  label: string
  value: number | null
  formattedValue: string
  share: number | null
  formattedShare: string
  color: string
}

interface IUsageTag {
  name: string
  percentage: string
  style: CSSProperties
}

interface IUsageGroup {
  label: string
  tags: IUsageTag[]
}

const props = defineProps<{ stats: IWakaTimeLandingStats }>()

const tokenValues = computed(() => [
  props.stats.ai?.tokens.input ?? null,
  props.stats.ai?.tokens.cachedInput ?? null,
  props.stats.ai?.tokens.output ?? null,
])
const totalTokens = computed(() => sumKnownTokens(tokenValues.value))
const tokenShares = computed(() => getWakaTimeTokenShares(tokenValues.value))
const periodText = computed(() =>
  formatWakaTimeDateRange(props.stats.range.startDate, props.stats.range.endDate),
)
const costText = computed(() => {
  const value = formatEstimatedUsd(props.stats.ai?.estimatedCostUsd ?? null)
  return value === null ? '—' : `~${value}`
})

const tokenItems = computed<ITokenItem[]>(() => {
  const definitions = [
    { key: 'input', label: 'Input', color: '#1d1d1f' },
    { key: 'cachedInput', label: 'Cached Input', color: '#70757b' },
    { key: 'output', label: 'Output', color: '#b5bac0' },
  ] as const
  return definitions.map((definition, index) => {
    const value = tokenValues.value[index] ?? null
    const share = tokenShares.value[index] ?? null
    return {
      ...definition,
      value,
      formattedValue: formatCompactToken(value),
      share,
      formattedShare: share === null ? '—' : `${Math.round(share * 100)}%`,
    }
  })
})

const shareLabel = computed(() => {
  if (totalTokens.value === null) return 'Token 占比暂无数据'
  return `Token 占比：${tokenItems.value
    .map((item) => `${item.label} ${item.formattedShare}`)
    .join('，')}`
})

function makeTag(item: IWakaTimeBreakdownItem | IWakaTimeAiStats['models'][number]): IUsageTag {
  const tint = getWakaTimeTagTint(item.share)
  return {
    name: item.name,
    percentage: `${Math.round(item.share * 100)}%`,
    style: {
      backgroundColor: `color-mix(in srgb, var(--color-signal-blue) ${tint}%, var(--landing-surface-soft))`,
    },
  }
}

const usageGroups = computed<IUsageGroup[]>(() => [
  {
    label: '工作环境 / 工具',
    tags: sortWakaTimeUsageItems(props.stats.editors).map(makeTag),
  },
  {
    label: 'AI 模型',
    tags: sortWakaTimeUsageItems(props.stats.ai?.models ?? []).map(makeTag),
  },
])
</script>

<template>
  <article class="usage-card">
    <p class="usage-card__period">最近 30 天 · {{ periodText }}</p>

    <div class="usage-card__hero">
      <div>
        <p class="usage-card__total">
          {{ formatCompactToken(totalTokens) }}<span v-if="totalTokens !== null"> tokens</span>
        </p>
      </div>
      <div class="usage-card__cost">
        <strong>{{ costText }}</strong>
      </div>
    </div>

    <div class="usage-card__distribution">
      <div class="usage-card__track" role="img" :aria-label="shareLabel">
        <i
          v-for="item in tokenItems"
          v-show="item.share !== null && item.share > 0"
          :key="item.key"
          class="usage-card__segment"
          :style="{ backgroundColor: item.color, flexGrow: item.share ?? 0 }"
          aria-hidden="true"
        />
      </div>
      <ul class="usage-card__legend" aria-label="Token 明细">
        <li v-for="item in tokenItems" :key="item.key">
          <i :style="{ backgroundColor: item.color }" aria-hidden="true" />
          <span>{{ item.label }}</span>
          <strong>{{ item.formattedValue }}</strong>
          <small>{{ item.formattedShare }}</small>
        </li>
      </ul>
    </div>

    <div class="usage-card__breakdowns">
      <section v-for="group in usageGroups" :key="group.label" class="usage-card__group">
        <h3>{{ group.label }}</h3>
        <ul v-if="group.tags.length" class="usage-card__tags">
          <li v-for="tag in group.tags" :key="tag.name" :style="tag.style">
            <span>{{ tag.name }}</span>
            <strong>{{ tag.percentage }}</strong>
          </li>
        </ul>
        <p v-else class="usage-card__empty">—</p>
      </section>
    </div>
  </article>
</template>

<style scoped>
.usage-card {
  box-sizing: border-box;
  min-width: 0;
  margin-top: 1.5rem;
  padding: clamp(1.1rem, 3vw, 1.5rem);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--landing-text) 11%, transparent);
  border-radius: 13px;
  background: color-mix(in srgb, var(--landing-surface-soft) 72%, white);
}
.usage-card__period {
  margin: 0;
  color: var(--landing-muted);
  font-size: 0.75rem;
  letter-spacing: 0.02em;
}
.usage-card__hero {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1.25rem;
  margin-top: 1.1rem;
}
.usage-card__total {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: clamp(1.75rem, 5vw, 2.35rem);
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.04em;
}
.usage-card__total span {
  margin-left: 0.4rem;
  color: var(--landing-muted);
  font-size: 0.72rem;
  font-weight: 400;
  letter-spacing: 0;
}
.usage-card__cost {
  display: flex;
  flex: none;
  align-items: end;
  flex-direction: column;
  gap: 0.2rem;
}
.usage-card__cost strong {
  font-size: clamp(1.15rem, 3vw, 1.5rem);
  line-height: 1;
  letter-spacing: -0.03em;
}
.usage-card__distribution {
  margin-top: 1.15rem;
  padding-top: 0.9rem;
}
.usage-card__track {
  display: flex;
  gap: 1px;
  width: 100%;
  height: 7px;
  overflow: hidden;
  border-radius: 2px;
  background: color-mix(in srgb, var(--landing-text) 8%, transparent);
}
.usage-card__segment {
  display: block;
  min-width: 1px;
}
.usage-card__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.42rem 0.9rem;
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
}
.usage-card__legend li {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
  max-width: 100%;
  font-size: 0.62rem;
}
.usage-card__legend i {
  width: 6px;
  height: 6px;
}
.usage-card__legend span {
  min-width: 0;
  overflow: hidden;
  color: var(--landing-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.usage-card__legend strong {
  font-weight: 600;
}
.usage-card__legend small {
  color: var(--landing-muted);
  font-size: inherit;
}
.usage-card__breakdowns {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: clamp(1.25rem, 4vw, 2.5rem);
  margin-top: 1.15rem;
  padding-top: 1.15rem;
}
.usage-card__group {
  min-width: 0;
}
.usage-card__group h3 {
  margin: 0 0 0.55rem;
  font-size: 0.74rem;
}
.usage-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.38rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.usage-card__tags li {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  padding: 0.32rem 0.5rem;
  border-radius: 980px;
  font-size: 0.64rem;
  line-height: 1.3;
}
.usage-card__tags span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.usage-card__tags strong {
  flex: none;
  font-size: inherit;
  font-weight: 600;
}
.usage-card__empty {
  margin: 0;
  color: var(--landing-muted);
  font-size: 0.68rem;
}
@media (max-width: 760px) {
  .usage-card__hero {
    align-items: start;
    flex-direction: column;
    gap: 0.9rem;
  }
  .usage-card__cost {
    align-items: start;
  }
  .usage-card__breakdowns {
    grid-template-columns: 1fr;
  }
  .usage-card__legend {
    gap: 0.5rem;
  }
}
</style>
