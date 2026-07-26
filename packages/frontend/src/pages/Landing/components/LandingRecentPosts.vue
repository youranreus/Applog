<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { ArrowRightIcon } from '@lucide/vue';
import { ROUTE_NAMES } from '@/constants/permission';
import type { ILandingPost } from '../types';

defineProps<{
  posts: ILandingPost[];
  loading: boolean;
  hasError: boolean;
}>();

const hiddenCoverIds = ref(new Set<number>());

function handleCoverError(postId: number): void {
  hiddenCoverIds.value = new Set(hiddenCoverIds.value).add(postId);
}
</script>

<template>
  <section class="landing-posts" aria-labelledby="landing-posts-title">
    <header class="landing-posts__header">
      <h2 id="landing-posts-title">最新文章</h2>
      <RouterLink :to="{ name: ROUTE_NAMES.POST_LIST }">
        全部文章
        <ArrowRightIcon aria-hidden="true" />
      </RouterLink>
    </header>

    <p v-if="loading" class="landing-posts__state" aria-live="polite">
      正在取回最近的文字…
    </p>
    <p v-else-if="hasError" class="landing-posts__state" role="status">
      最近的文章暂时没有加载出来，可以前往文章列表继续浏览。
    </p>
    <p v-else-if="posts.length === 0" class="landing-posts__state">
      这里还没有公开文章，新的文字正在路上。
    </p>

    <div v-else class="landing-posts__list">
      <RouterLink
        v-for="(post, index) in posts"
        :key="post.id"
        :to="{ name: ROUTE_NAMES.POST_DETAIL, params: { slug: post.slug } }"
        class="landing-post-card"
      >
        <img
          v-if="index === 0 && post.cover && !hiddenCoverIds.has(post.id)"
          :src="post.cover"
          alt=""
          loading="lazy"
          @error="handleCoverError(post.id)"
        />
        <div class="landing-post-card__body">
          <time v-if="post.publishedAt" :datetime="post.publishedAtIso">
            {{ post.publishedAt }}
          </time>
          <h3>{{ post.title }}</h3>
          <p v-if="post.summary">{{ post.summary }}</p>
          <span class="landing-post-card__arrow" aria-hidden="true">
            <ArrowRightIcon />
          </span>
        </div>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.landing-posts {
  padding-top: clamp(4.5rem, 10vw, 6.5rem);
}

.landing-posts__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.landing-posts__header h2 {
  color: var(--landing-text);
  font-family: var(--landing-font-heading);
  font-size: 1.3125rem;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.005em;
}

.landing-posts__header a {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.5rem;
  color: var(--landing-link);
  font-size: 0.875rem;
  text-decoration: none;
}

.landing-posts__header a svg {
  width: 1rem;
  height: 1rem;
}

.landing-posts__state {
  margin-top: 1rem;
  padding: 1.5rem;
  border-radius: 8px;
  background: var(--landing-surface);
  color: var(--landing-muted);
  font-size: 1.0625rem;
  line-height: 1.6;
}

.landing-posts__list {
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
}

.landing-post-card {
  display: grid;
  min-width: 0;
  overflow: hidden;
  border-radius: 8px;
  background: var(--landing-surface);
  color: inherit;
  text-decoration: none;
  transition: background-color 160ms ease, transform 180ms ease;
}

.landing-post-card > img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 8;
  object-fit: cover;
}

.landing-post-card__body {
  position: relative;
  min-width: 0;
  padding: 1.25rem 3.25rem 1.25rem 1.25rem;
}

.landing-post-card time {
  color: var(--landing-muted);
  font-size: 0.875rem;
  line-height: 1.4;
}

.landing-post-card h3 {
  margin-top: 0.5rem;
  color: var(--landing-text);
  font-family: var(--landing-font-heading);
  font-size: clamp(1.125rem, 1.03rem + 0.35vw, 1.3125rem);
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.012em;
  overflow-wrap: anywhere;
  text-wrap: pretty;
}

.landing-post-card p {
  display: -webkit-box;
  margin-top: 0.75rem;
  overflow: hidden;
  color: var(--landing-muted);
  font-size: 1.0625rem;
  line-height: 1.6;
  letter-spacing: -0.016em;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.landing-post-card__arrow {
  position: absolute;
  top: 50%;
  right: 1.25rem;
  display: inline-flex;
  color: var(--landing-muted);
  transform: translateY(-50%);
  transition: color 160ms ease, transform 180ms ease;
}

.landing-post-card__arrow svg {
  width: 1rem;
  height: 1rem;
}

.landing-post-card:focus-visible,
.landing-posts__header a:focus-visible {
  outline: 2px solid var(--landing-primary);
  outline-offset: 3px;
}

@media (hover: hover) {
  .landing-posts__header a:hover {
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }

  .landing-post-card:hover {
    background: var(--landing-surface-soft);
  }

  .landing-post-card:hover .landing-post-card__arrow {
    color: var(--landing-link);
    transform: translate(0.2rem, -50%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-post-card,
  .landing-post-card__arrow {
    transition: none;
  }
}
</style>
