/** True only for absolute http(s) URLs. Content from the API is never trusted as a link target otherwise. */
export function isHttpUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}
