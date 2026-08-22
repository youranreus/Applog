import {
  FLOMO_MAX_PUBLICATION_TAG_LENGTH,
  FLOMO_MAX_PUBLICATION_TAGS,
  FLOMO_TOKEN_MASK,
} from "../constants/flomo.js";

/** Normalize one exact Flomo tag without expanding parent/child relationships. */
export function normalizeFlomoTag(value: string): string {
  const trimmed = value.trim();
  return (trimmed.startsWith("#") ? trimmed.slice(1) : trimmed).trim();
}

/** Normalize, validate and exactly deduplicate the publication allowlist. */
export function normalizeFlomoPublicationTags(values: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = normalizeFlomoTag(raw);
    if (!value) continue;
    if (value.length > FLOMO_MAX_PUBLICATION_TAG_LENGTH) {
      throw new Error(`Flomo publication tag exceeds ${FLOMO_MAX_PUBLICATION_TAG_LENGTH} characters`);
    }
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  if (result.length > FLOMO_MAX_PUBLICATION_TAGS) {
    throw new Error(`Flomo publication tag count exceeds ${FLOMO_MAX_PUBLICATION_TAGS}`);
  }
  return result;
}

/** Strip the optional Web Authorization prefix before encryption/use. */
export function normalizeFlomoToken(value: string | undefined): string {
  return (value || "").trim().replace(/^Bearer(?:\s+|$)/i, "").trim();
}

/** Empty and masked submissions retain the encrypted credential already stored. */
export function shouldKeepExistingFlomoToken(value: string | undefined): boolean {
  const normalized = (value || "").trim();
  return normalized === FLOMO_TOKEN_MASK || normalizeFlomoToken(normalized) === "";
}

/** Exact any-match publication decision; parents never include descendants. */
export function hasExactFlomoPublicationTag(
  memoTags: readonly string[],
  publicationTags: readonly string[],
): boolean {
  const allowlist = new Set(publicationTags.map(normalizeFlomoTag));
  return memoTags.some((tag) => allowlist.has(normalizeFlomoTag(tag)));
}
