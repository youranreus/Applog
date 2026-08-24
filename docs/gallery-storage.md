# Gallery storage operations

相册使用后端代理上传，浏览器永远不会收到 OSS AccessKey。`APP_SECRET_ENCRYPTION_KEY` 必须是 32 字节 Base64，AccessKey Secret 使用 `gallery.oss-credential` purpose 进行 AES-256-GCM 加密。

## OSS 最小权限

将 RAM 权限限制到配置的 Bucket 与相册根目录，并允许：列举根目录、写入对象、读取对象元数据、删除对象。CDN 必须能回源该目录，且测试探针 `{galleryPath}/.applog-probe` 能经 CDN 使用 HEAD 访问。连接测试在结束时删除探针；下一次测试也会先尝试清理同名对象。

资源布局：

- 展示图：`{galleryPath}/{albumFolder}/{uuid}.{jpg|png|webp}`
- HEIC 原图：`{galleryPath}/.originals/{albumFolder}/{uuid}.heic`

关闭相册是首选回滚方式：导航和公开数据 API 会立即关闭，数据库记录及 OSS 对象均保留。

## HEIC 运行要求

HEIC 上传优先使用 Sharp/libvips 原生解码；部署环境没有 HEVC 插件时自动使用
`heic-convert` 的 WASM 解码链生成 JPEG。WASM 降级会占用更多 CPU 和内存，但不影响
JPEG、PNG、WebP。部署后运行真实文件检查：

```bash
pnpm --filter @applog/backend run gallery:doctor
```

该命令默认下载并实际解码 libheif 官方示例；离线环境可设置
`GALLERY_HEIC_FIXTURE=/path/to/fixture.heic` 使用本地真实 HEIC。示例来源：
<https://github.com/strukturag/libheif/raw/gh-pages/example.heic>。

若两条解码链都失败，JPEG、PNG、WebP 仍可使用，HEIC 上传会返回明确错误。删除
HEIC 照片时会同时删除 `.originals` 原图与 JPEG 展示图。
