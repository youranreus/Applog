<script setup lang="ts">
import { computed } from 'vue'
import type { ITokscaleLandingStats } from '@applog/common'
import {
  TOKSCALE_TOKEN_SEGMENTS,
  formatTokscaleDay,
  formatTokenCount,
  formatUsd,
  getTokscaleTokenShares,
} from '../../tokscale-utils'

const props = defineProps<{
  stats: ITokscaleLandingStats
  today: string
}>()

const tokenShares = computed(() => getTokscaleTokenShares(props.stats.tokens))
const tokenItems = computed(() =>
  TOKSCALE_TOKEN_SEGMENTS.map((segment, index) => {
    const value = props.stats.tokens[segment.key]
    const share = tokenShares.value[index] ?? 0
    return {
      ...segment,
      value,
      share,
      formattedValue: formatTokenCount(value),
      formattedShare: `${Math.round(share * 100)}%`,
    }
  }).filter((item) => item.value > 0),
)
const dayText = computed(() => formatTokscaleDay(props.stats.date, props.today))
const calendarDayText = computed(() => {
  const [, month, day] = props.stats.date.split('-').map(Number)
  return Number.isFinite(month) && Number.isFinite(day) ? `${month}月${day}日` : props.stats.date
})
const periodText = computed(() =>
  dayText.value === '今天' || dayText.value === '昨天'
    ? `${calendarDayText.value} · ${dayText.value}`
    : dayText.value,
)
const shareLabel = computed(() =>
  tokenItems.value.length
    ? `Token 占比：${tokenItems.value
        .map((item) => `${item.label} ${item.formattedShare}`)
        .join('，')}`
    : 'Token 占比暂无数据',
)
</script>

<template>
  <article class="usage-card">
    <p class="usage-card__period">{{ periodText }}</p>

    <div class="usage-card__hero">
      <p class="usage-card__total">{{ formatTokenCount(stats.totalTokens) }}<span> tokens</span></p>
      <strong class="usage-card__cost">{{ formatUsd(stats.totalCost) }}</strong>
    </div>

    <div class="usage-card__distribution">
      <div class="usage-card__track" role="img" :aria-label="shareLabel">
        <i
          v-for="item in tokenItems"
          :key="item.key"
          class="usage-card__segment"
          :style="{ backgroundColor: item.color, flexGrow: item.share }"
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

    <div class="usage-card__clients" aria-label="软件与模型用量">
      <section v-for="client in stats.clients" :key="client.id" class="usage-card__client">
        <header class="usage-card__client-header">
          <h3>{{ client.name }}</h3>
          <p>{{ formatTokenCount(client.tokens) }} · {{ formatUsd(client.cost) }}</p>
        </header>
        <ul v-if="client.models.length" class="usage-card__models">
          <li v-for="model in client.models" :key="`${client.id}:${model.model}`">
            <span :title="model.model">{{ model.model }}</span>
            <strong>{{ formatTokenCount(model.tokens) }}</strong>
            <em>{{ formatUsd(model.cost) }}</em>
          </li>
        </ul>
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
  min-width: 0;
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
  flex: none;
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
.usage-card__clients {
  display: grid;
  gap: 1rem;
  margin-top: 1.2rem;
  padding-top: 1rem;
}
.usage-card__client {
  min-width: 0;
}
.usage-card__client-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}
.usage-card__client-header h3,
.usage-card__client-header p {
  margin: 0;
  font-size: 0.76rem;
}
.usage-card__client-header h3 {
  min-width: 0;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.usage-card__client-header p {
  flex: none;
  color: var(--landing-muted);
  font-variant-numeric: tabular-nums;
}
.usage-card__models {
  display: grid;
  gap: 0.38rem;
  margin: 0.48rem 0 0;
  padding: 0;
  list-style: none;
}
.usage-card__models li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 0.75rem;
  align-items: baseline;
  min-width: 0;
  color: var(--landing-muted);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}
.usage-card__models span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.usage-card__models strong,
.usage-card__models em {
  color: var(--landing-text);
  font-style: normal;
  font-weight: 500;
  text-align: right;
}
@media (max-width: 760px) {
  .usage-card__hero {
    align-items: start;
    flex-direction: column;
    gap: 0.9rem;
  }
  .usage-card__client-header {
    align-items: start;
    flex-direction: column;
    gap: 0.2rem;
  }
  .usage-card__models li {
    gap: 0.5rem;
  }
  .usage-card__legend {
    gap: 0.5rem;
  }
}
</style>
