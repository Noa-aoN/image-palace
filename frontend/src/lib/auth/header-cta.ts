/**
 * ヘッダーに「はじめる」を出すか。
 *
 * 検索や共有から公開の読みもの（使い方・コラム・お知らせ）へ直に降りてきた人には、
 * **ヘッダーが唯一の入口**になる。空けておくと、読み終えたあと行き場が無い。
 *
 * 出さない場所が3つある。
 *   1. ログインが分かる前 … ログイン済みの人にも一瞬「はじめる」が見える
 *   2. 門（login / signup / auth） … その画面自体が登録とログインの場
 *   3. 最初のページ … 自前の導線を持っている
 */
export function showSignUpCta({
  hasHydrated,
  isAuthenticated,
  pathname,
}: {
  hasHydrated: boolean
  isAuthenticated: boolean
  pathname: string | null
}): boolean {
  if (!hasHydrated || isAuthenticated || !pathname) return false
  if (pathname === '/') return false

  return !['/login', '/signup', '/auth/'].some((gate) => pathname.startsWith(gate))
}
