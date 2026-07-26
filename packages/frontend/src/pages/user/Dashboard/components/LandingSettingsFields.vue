<script setup lang="ts">
import { Input } from '@/components/ui/input';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';

const landingTitle = defineModel<string>('landingTitle', { default: '' });
const landingBio = defineModel<string>('landingBio', { default: '' });
const landingSlogan = defineModel<string>('landingSlogan', { default: '' });
const weatherCity = defineModel<string>('weatherCity', { default: '' });
const personalHomepageUrl = defineModel<string>('personalHomepageUrl', {
  default: '/about.html',
});
const bilibiliUrl = defineModel<string>('bilibiliUrl', { default: '' });
const githubUrl = defineModel<string>('githubUrl', { default: '' });
</script>

<template>
  <FieldGroup class="gap-4">
    <div>
      <h3 class="text-sm font-semibold text-foreground">个人首页</h3>
      <p class="mt-1 text-xs text-muted-foreground">
        配置窄栏首页的标题、副标题、天气城市与社交入口
      </p>
    </div>

    <Field>
      <FieldLabel>标题</FieldLabel>
      <Input
        v-model="landingTitle"
        type="text"
        maxlength="80"
        placeholder="留空时使用站点标题"
      />
      <FieldDescription>个人首页的主标题</FieldDescription>
    </Field>

    <Field>
      <FieldLabel>副标题</FieldLabel>
      <Input
        v-model="landingBio"
        type="text"
        maxlength="160"
        placeholder="简单介绍你和这个站点；留空后隐藏"
      />
      <FieldDescription>建议控制在 40–80 个汉字</FieldDescription>
    </Field>

    <Field>
      <FieldLabel>Slogan</FieldLabel>
      <Input
        v-model="landingSlogan"
        type="text"
        maxlength="120"
        placeholder="用一句话收束首页"
      />
    </Field>

    <Field>
      <FieldLabel>天气城市</FieldLabel>
      <Input
        v-model="weatherCity"
        type="text"
        maxlength="100"
        placeholder="如 深圳"
      />
      <FieldDescription>
        服务端会查询该城市的实时天气；无法获取时首页自动隐藏
      </FieldDescription>
    </Field>

    <Field>
      <FieldLabel>个人主页链接</FieldLabel>
      <Input
        v-model="personalHomepageUrl"
        type="text"
        placeholder="/about.html 或 https://example.com"
      />
      <FieldDescription>
        支持站内路径与 http(s) 链接；清空后隐藏
      </FieldDescription>
    </Field>

    <Field>
      <FieldLabel>Bilibili 链接</FieldLabel>
      <Input
        v-model="bilibiliUrl"
        type="url"
        placeholder="https://space.bilibili.com/..."
      />
    </Field>

    <Field>
      <FieldLabel>GitHub 链接</FieldLabel>
      <Input
        v-model="githubUrl"
        type="url"
        placeholder="https://github.com/..."
      />
    </Field>
  </FieldGroup>
</template>
