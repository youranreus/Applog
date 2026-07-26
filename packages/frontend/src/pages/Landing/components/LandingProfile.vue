<script setup lang="ts">
import {
  Code2Icon,
  HouseIcon,
  TvMinimalPlayIcon,
} from '@lucide/vue';
import { RouterLink } from 'vue-router';
import type { ILandingSocialLink } from '../types';

defineProps<{
  siteTitle: string;
  bio: string | null;
  socialLinks: ILandingSocialLink[];
}>();
</script>

<template>
  <section class="landing-profile" aria-labelledby="landing-profile-title">
    <p v-if="bio" class="landing-profile__label">{{ siteTitle }}</p>
    <h1 id="landing-profile-title">{{ bio || siteTitle }}</h1>

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

.landing-profile__label {
  color: var(--landing-muted);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.45;
  letter-spacing: -0.016em;
}

.landing-profile h1 {
  max-width: 25ch;
  margin-top: 0.75rem;
  color: var(--landing-text);
  font-family: var(--landing-font-heading);
  font-size: clamp(1.75rem, 1.5rem + 1.1vw, 2.5rem);
  font-weight: 600;
  line-height: 1.17;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
  text-wrap: balance;
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
