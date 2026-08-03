/**
 * サイドバーの項目が「今いる場所」かどうかを判定する。
 *
 * 「/views」と「/views?type=deck」はパスが同じなので、パスだけで見ると
 * デッキ一覧を開いていても親のキャンバス一覧が選択中に見えてしまう。
 * 絞り込みまで合わせて判定する。
 *
 * currentQuery が null のときは絞り込みがまだ読めていない（静的に描かれた1回目）。
 * この間は絞り込み付きの項目を選択中にしない。誤って光らせるより、遅れて光る方がよい。
 */
export function isNavItemActive(href: string, pathname: string, currentQuery: string | null): boolean {
  const [path, query] = href.split('?')
  const samePath = pathname === path || pathname.startsWith(path + '/')
  if (!samePath) return false
  if (currentQuery === null) return !query

  return query ? currentQuery === query : currentQuery === ''
}
