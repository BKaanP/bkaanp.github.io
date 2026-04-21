const STORAGE_KEY = 'rag-anthropic-api-key'
 
export function getApiKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}
 
export function setApiKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key.trim())
  } catch {
    // localStorage disabled (private mode, etc.) — silently no-op.
  }
}
 
export function clearApiKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // no-op
  }
}
 
/**
 * Anthropic API keys start with "sk-ant-" followed by a long string.
 * Returns true if the key has the expected shape; does not verify validity.
 */
export function looksLikeAnthropicKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key.trim())
}
 