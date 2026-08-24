import { GALLERY_FOLDER_PATTERN, GALLERY_SUPPORTED_MIME_TYPES } from "../constants/gallery.js";
export function isGalleryFolder(value: string): boolean { return GALLERY_FOLDER_PATTERN.test(value); }
export function normalizeGalleryPath(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, "").split("/").filter(Boolean)
    .map((segment) => {
      const decoded = decodeURIComponent(segment);
      if (decoded === "." || decoded === ".." || /[\\/\u0000-\u001f\u007f]/.test(decoded)) {
        throw new Error("相册目录包含不安全的路径片段");
      }
      return encodeURIComponent(decoded);
    }).join("/");
}
export function normalizeCdnDomain(value: string): string {
  const normalized = value.trim().replace(/\/+$/g, "");
  if (!normalized) return "";
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
  if (!/^https:\/\/[^/?#\s@]+$/i.test(withProtocol)) {
    throw new Error("CDN 域名必须是无路径和查询参数的 HTTPS 地址");
  }
  return withProtocol;
}
export function buildGalleryObjectKey(galleryPath: string, folder: string, filename: string): string {
  if (!isGalleryFolder(folder)) throw new Error("相册目录格式不正确");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(filename)) throw new Error("资源文件名格式不正确");
  return [normalizeGalleryPath(galleryPath), folder, filename].filter(Boolean).join("/");
}
export function buildGalleryUrl(cdnDomain: string, objectKey: string): string {
  const domain = normalizeCdnDomain(cdnDomain);
  const path = objectKey.replace(/^\/+/, "").split("/").filter(Boolean)
    .map((segment) => encodeURIComponent(decodeURIComponent(segment))).join("/");
  return `${domain}/${path}`;
}
export function isGalleryMimeType(value: string): boolean {
  return (GALLERY_SUPPORTED_MIME_TYPES as readonly string[]).includes(value);
}
