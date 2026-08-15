/**
 * URL が名指ししている項目の鍵を返す（`/account#basic` の `basic`）。
 *
 * 知らない名前は返さない。別の用途で付いた `#` を、項目の名指しと
 * 取り違えないため。
 */
export function sectionFromHash(hash: string, keys: readonly string[]): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw) return null

  let key: string
  try {
    key = decodeURIComponent(raw)
  } catch {
    // 壊れた符号（%E0%A4%A のような尻切れ）で落とさない
    return null
  }

  return keys.includes(key) ? key : null
}
