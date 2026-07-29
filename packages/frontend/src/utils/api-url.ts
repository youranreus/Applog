const ABSOLUTE_RESOURCE_PATTERN = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(
  /\/+$/,
  '',
)

/** Resolve a backend-owned media path against the same base used by API calls. */
export function resolveApiAssetUrl(value: string, apiBaseUrl = API_BASE_URL): string {
  const assetUrl = value.trim()
  if (!assetUrl || ABSOLUTE_RESOURCE_PATTERN.test(assetUrl)) return assetUrl

  const baseUrl = apiBaseUrl.trim().replace(/\/+$/, '')
  if (!baseUrl) return assetUrl
  return `${baseUrl}/${assetUrl.replace(/^\/+/, '')}`
}
