# Gallery integration research

## Repository evidence

- The product is a Vue 3 SPA with Tailwind CSS v4 and shadcn-vue, backed by NestJS/Fastify, TypeORM, and MySQL.
- Shared frontend/backend contracts live in `@applog/common`.
- `SystemConfigService` demonstrates masked secret readback, preserve-on-mask updates, and public/admin configuration boundaries.
- `SecretEncryptionService` provides versioned AES-256-GCM envelopes with allowlisted purposes; gallery OSS credentials need a new immutable purpose rather than plaintext generic configuration.
- The default navigation is centralized in `packages/frontend/src/constants/nav.ts` and resolved by `useLayoutStore`.
- The user confirmed that actual production is not Alibaba Function Compute. `s.yaml` is therefore not an authoritative runtime resource limit for this feature.

## MapCN Vue

- MapCN Vue is compatible with Vue 3, Tailwind CSS v4, and shadcn-vue.
- The base map integration requires `@geoql/v-maplibre`, `maplibre-gl`, and the MapLibre CSS. deck.gl packages are unnecessary for a single photo marker.
- The component registry is copy-owned by the consuming repository and the upstream project is MIT licensed.
- The map is an enhancement inside the photo detail panel. Missing GPS hides it; tile/style failure must degrade without breaking image preview.

Primary sources:

- https://mapcn-vue.geoql.in/docs/installation/
- https://mapcn-vue.geoql.in/docs/components/
- https://github.com/geoql/v-maplibre

## HEIC and EXIF

- `exifr` can parse JPEG, PNG, WebP/AVIF-family metadata and HEIC boxes, including EXIF and GPS, without decoding the full image.
- Browser-compatible display still requires a web-safe representation. HEIC decoding through Sharp requires a globally installed libvips built with libheif and an HEVC decoder; stock Sharp prebuilt binaries do not provide that HEVC path.
- The gallery should isolate this behind an image-processor boundary and include an executable HEIC capability check. The actual self-hosted runtime must satisfy that check before HEIC uploads are accepted.
- Preserve a HEIC source object and publish a generated JPEG display object. Public DTOs expose only the display URL; deletion cleans both keys.

Primary sources:

- https://github.com/MikeKovarik/exifr
- https://sharp.pixelplumbing.com/api-output/
- https://github.com/strukturag/libheif

## Alibaba OSS

- OSS supports object upload, list, delete, and multipart operations through its JavaScript SDK.
- OSS image processing can read HEIC EXIF and convert supported images, but the product must not depend on an FC runtime. OSS processing may remain an adapter implementation option, not the only HEIC contract.
- CDN URLs should be built from normalized configured segments. Access keys remain server-only; the browser sends uploads to the authenticated backend rather than receiving long-lived OSS credentials.

Primary sources:

- https://www.alibabacloud.com/help/en/oss/user-guide/query-the-exif-data-of-an-image-4
- https://www.alibabacloud.com/help/en/oss/user-guide/convert-image-formats-2
- https://www.npmjs.com/package/ali-oss

## Planning conclusions

- Use a dedicated gallery module and persistence model rather than extending the generic base-config JSON.
- Store the AccessKey secret in a versioned encrypted envelope and mask it on admin readback.
- Use a monotonically increasing configuration revision and a verified revision. Any relevant configuration change invalidates verification; enabling requires equality.
- Upload one file per HTTP request. The frontend batch queue enforces at most 20 selected files and bounded concurrency, avoiding a single 600 MB multipart request.
- Validate content by signature/MIME, not filename alone. Generate server-owned UUID object names and keep album folder slugs immutable.
- Persist only an allowlisted EXIF projection. Do not return raw maker notes or arbitrary metadata.
