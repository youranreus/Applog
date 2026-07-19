<script setup lang="ts"></script>

<template>
  <div class="comment-list-page admin-page-container">
    <header class="page-header">
      <h1 class="page-title">
        <span class="page-title__text">评论</span>
        <svg
          class="page-title__wave"
          viewBox="0 0 48 12"
          preserveAspectRatio="xMinYMid meet"
          aria-hidden="true"
        >
          <path
            d="M3 7 C 12 2.5, 18 2.5, 24 7 S 36 11.5, 45 7"
            fill="none"
            stroke="currentColor"
            stroke-width="2.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </h1>
    </header>

    <div class="comment-list">
      <div class="text-center text-gray-600 py-12">
        <p>评论列表功能开发中...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.comment-list-page {
  width: 100%;
}

.page-header {
  margin-bottom: 2.5rem;
}

.page-title {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  margin: 0;
  padding-bottom: 2px;
  overflow: visible;
  font-family: var(--font-heading, inherit);
  font-size: clamp(1.75rem, 1.4rem + 1.2vw, 2.25rem);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--color-carbon, #1d1d1f);
  text-wrap: balance;
}

.page-title__text {
  display: block;
}

.page-title__wave {
  display: block;
  width: 2.1em;
  height: 12px;
  margin-top: 2px;
  overflow: visible;
  color: var(--color-signal-blue, #2997ff);
  opacity: 0.65;
  pointer-events: none;
}

.comment-list {
  margin-top: 0;
}
</style>
