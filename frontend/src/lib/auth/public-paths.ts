/**
 * ログイン無しで読めるページ。
 *
 * ここを一覧で持つのは、**セッションが切れたときの行き先を変える**ため。
 *
 * これまでは、どのページで 401 が起きてもログイン画面へ送っていた。
 * ログインが要る画面ではそれでよい（続けるにはログインするしかない）。
 * けれど使い方やコラムは、そもそもログイン無しで読めるページなので、
 * 読んでいる途中に飛ばされると「勝手にログアウトされた」ように見えるうえ、
 * 読みかけの記事から追い出されることになる。
 *
 * 公開ページでは、印だけ落としてその場に留まる。
 * ヘッダーは自然と未ログインの姿（ログイン／はじめる）に変わる。
 */
const PUBLIC_PREFIXES = [
  '/guide',
  '/blog',
  '/news',
  '/privacy',
  '/terms',
  '/tokushoho',
  '/cookie-settings',
  '/login',
  '/signup',
  // OAuth の戻り先。**末尾の / は付けない**
  // （前方一致は「その道そのもの」か「その下」で見るので、/auth// を探しにいってしまう）
  '/auth',
] as const

export function isPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  // 最初のページ。前方一致だと全部の道が当たるので、ここだけ完全一致で見る
  if (pathname === '/') return true

  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
