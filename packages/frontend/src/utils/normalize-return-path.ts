/** Keep post-login navigation on this application origin. */
export function normalizeReturnPath(value?: string): string {
  return value?.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : '/'
}
