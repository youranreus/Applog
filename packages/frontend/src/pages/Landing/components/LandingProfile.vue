<script setup lang="ts">
import {
  Code2Icon,
  HouseIcon,
  TvMinimalPlayIcon,
} from '@lucide/vue';
import { RouterLink } from 'vue-router';
import type { ILandingSocialLink } from '../types';

defineProps<{
  title: string;
  subtitle: string | null;
  socialLinks: ILandingSocialLink[];
}>();
</script>

<template>
  <section class="landing-profile" aria-labelledby="landing-profile-title">
    <h1 id="landing-profile-title">{{ title }}</h1>
    <p v-if="subtitle" class="landing-profile__subtitle">{{ subtitle }}</p>

    <nav
      v-if="socialLinks.length > 0"
      class="landing-profile__socials"
      aria-label="作者社交主页"
    >
      <template v-for="link in socialLinks" :key="link.kind">
        <a
          v-if="link.external"
          :href="link.href"
          target="_blank"
          rel="noopener noreferrer"
          class="landing-profile__social-link"
          :aria-label="`${link.label}（在新窗口打开）`"
        >
          <HouseIcon v-if="link.kind === 'home'" aria-hidden="true" />
          <TvMinimalPlayIcon v-else-if="link.kind === 'bilibili'" aria-hidden="true" />
          <Code2Icon v-else aria-hidden="true" />
        </a>
        <RouterLink
          v-else
          :to="link.href"
          class="landing-profile__social-link"
          :aria-label="link.label"
        >
          <HouseIcon aria-hidden="true" />
        </RouterLink>
      </template>
    </nav>
  </section>
</template>

<style scoped>
.landing-profile {
  padding-top: clamp(2.25rem, 6vw, 3.75rem);
}

.landing-profile h1 {
  max-width: 25ch;
  color: var(--landing-text);
  font-family: var(--landing-font-heading);
  font-size: clamp(1.75rem, 1.5rem + 1.1vw, 2.5rem);
  font-weight: 600;
  line-height: 1.17;
  letter-spacing: clamp(0.01225rem, calc(0.0072rem + 0.0224vw), 0.0275rem);
  overflow-wrap: anywhere;
  text-wrap: balance;
}

.landing-profile__subtitle {
  max-width: 42ch;
  margin-top: 0.75rem;
  color: var(--landing-muted);
  font-size: 1.0625rem;
  font-weight: 400;
  line-height: 1.6;
  letter-spacing: -0.016em;
  overflow-wrap: anywhere;
  text-wrap: pretty;
}

.landing-profile__socials {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 1.5rem;
}

.landing-profile__social-link {
  display: inline-flex;
  width: 2.75rem;
  height: 2.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 980px;
  color: var(--landing-link);
  text-decoration: none;
  transition: background-color 160ms ease, color 160ms ease;
}

.landing-profile__social-link svg {
  width: 1.125rem;
  height: 1.125rem;
  stroke-width: 1.8;
}

.landing-profile__social-link:focus-visible {
  outline: 2px solid var(--landing-primary);
  outline-offset: 3px;
}

@media (hover: hover) {
  .landing-profile__social-link:hover {
    background: var(--landing-surface-soft);
  }
}
</style>
