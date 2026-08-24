export const GALLERY_SECRET_MASK = "********";
export const GALLERY_MAX_FILE_SIZE = 30 * 1024 * 1024;
export const GALLERY_MAX_BATCH_SIZE = 20;
export const GALLERY_FOLDER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export const GALLERY_SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;
export const GALLERY_PHOTO_STORAGE_STATES = [
  "ready", "deleting", "delete_failed",
] as const;
export type GalleryPhotoStorageState = (typeof GALLERY_PHOTO_STORAGE_STATES)[number];
