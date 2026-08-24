<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { IGalleryAdminConfig } from '@applog/common';
import { GALLERY_SECRET_MASK } from '@applog/common';
import { getGalleryConfig, setGalleryConfig, testGalleryConfig } from '@/api/gallery';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';

const layout = useLayoutStore();
const loading = ref(true); const saving = ref(false); const testing = ref(false);
const error = ref('');
const form = ref<IGalleryAdminConfig>({ endpoint: '', bucket: '', accessKeyId: '', accessKeySecret: '', cdnDomain: '', galleryPath: 'gallery', enabled: false, configRevision: 1, verifiedRevision: null, verifiedAt: null, configured: false, verified: false });
const canEnable = computed(() => form.value.configured && form.value.verified);
const secretPlaceholder = computed(() => form.value.accessKeySecret === GALLERY_SECRET_MASK ? '已安全保存（留空或保持掩码不修改）' : 'AccessKey Secret');

function apply(value: IGalleryAdminConfig): void { form.value = { ...value }; }
function message(errorValue: unknown): string { return errorValue instanceof Error ? errorValue.message : '操作失败，请稍后重试'; }
async function load(): Promise<void> { loading.value = true; error.value = ''; try { apply(await getGalleryConfig()); } catch (e) { error.value = message(e); } finally { loading.value = false; } }
function payload() { return { endpoint: form.value.endpoint, bucket: form.value.bucket, accessKeyId: form.value.accessKeyId,
  accessKeySecret: form.value.accessKeySecret, cdnDomain: form.value.cdnDomain, galleryPath: form.value.galleryPath, enabled: form.value.enabled }; }
async function save(): Promise<void> {
  saving.value = true; error.value = '';
  try { apply(await setGalleryConfig(payload())); layout.notify({ title: '相册配置已保存', content: form.value.verified ? '连接验证仍然有效' : '配置变化后需要重新测试连接', type: 'success' }); await layout.refresh(); }
  catch (e) { error.value = message(e); layout.notify({ title: '保存失败', content: error.value, type: 'error' }); }
  finally { saving.value = false; }
}
async function test(): Promise<void> {
  testing.value = true; error.value = '';
  try { apply(await testGalleryConfig()); layout.notify({ title: '连接测试通过', content: '已验证目录列举、写入、CDN 访问和删除权限', type: 'success' }); }
  catch (e) { error.value = message(e); layout.notify({ title: '连接测试失败', content: error.value, type: 'error' }); }
  finally { testing.value = false; }
}
async function toggle(value: boolean): Promise<void> {
  if (value && !canEnable.value) { layout.notify({ title: '暂时无法启用', content: '请先保存完整配置并通过连接测试', type: 'info' }); return; }
  form.value.enabled = value; await save();
}
onMounted(load);
</script>

<template>
  <FieldGroup class="gap-4 border-t border-border pt-8">
    <div>
      <h3 class="text-sm font-semibold text-foreground">相册 / 阿里云 OSS</h3>
      <p class="mt-1 text-xs text-muted-foreground">凭证只在服务端加密保存；照片由 CDN 域名公开分发。</p>
    </div>
    <p v-if="loading" class="text-sm text-muted-foreground">正在加载相册配置…</p>
    <template v-else>
      <Field><FieldLabel>Endpoint</FieldLabel><Input v-model="form.endpoint" placeholder="https://oss-cn-hangzhou.aliyuncs.com" /></Field>
      <Field><FieldLabel>Bucket</FieldLabel><Input v-model="form.bucket" placeholder="my-photo-bucket" /></Field>
      <Field><FieldLabel>AccessKey ID</FieldLabel><Input v-model="form.accessKeyId" autocomplete="off" /></Field>
      <Field><FieldLabel>AccessKey Secret</FieldLabel><Input v-model="form.accessKeySecret" type="password" autocomplete="new-password" :placeholder="secretPlaceholder" /><FieldDescription>读回为脱敏值；保持不变不会覆盖现有 Secret。</FieldDescription></Field>
      <Field><FieldLabel>CDN 域名</FieldLabel><Input v-model="form.cdnDomain" type="url" placeholder="https://images.example.com" /></Field>
      <Field><FieldLabel>相册根目录</FieldLabel><Input v-model="form.galleryPath" placeholder="gallery" /><FieldDescription>最终访问路径：CDN 域名 / 根目录 / 相册目录 / 文件名</FieldDescription></Field>
      <div class="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        <span v-if="form.verified" class="text-emerald-600">连接已验证 · {{ form.verifiedAt ? new Date(form.verifiedAt).toLocaleString() : '' }}</span>
        <span v-else>尚未验证或配置已变化（revision {{ form.configRevision }}）</span>
      </div>
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      <div class="flex flex-wrap justify-end gap-2"><Button variant="outline" :disabled="saving || testing" @click="save">{{ saving ? '保存中…' : '1. 保存配置' }}</Button><Button variant="outline" :disabled="saving || testing || !form.configured" @click="test">{{ testing ? '测试中…' : '2. 测试连接' }}</Button></div>
      <Field orientation="horizontal"><div class="flex-1"><FieldLabel>启用公开相册</FieldLabel><FieldDescription>只有当前 revision 测试通过后才可开启。</FieldDescription></div><Switch :model-value="form.enabled" :disabled="saving || !canEnable" @update:model-value="toggle" /></Field>
    </template>
  </FieldGroup>
</template>
