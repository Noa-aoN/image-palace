// パスワード再設定の着地で受け取る合鍵。
//
// **`#` の側から読む。** `?` ではない。
// フラグメントはサーバーへ送られないので、アクセスログにも Referer にも残らない。
// OAuth の着地（`/auth/callback`）と同じ考え方で、バックエンドの
// `Api::V1::Auth::PasswordsController` がここへ合わせて載せている。

export type ResetTokens = {
  accessToken: string
  client: string
  uid: string
}

/**
 * 着地の URL から合鍵を取り出す。
 *
 * @param hash `window.location.hash`（先頭の `#` は付いていても付いていなくてよい）
 * @returns 3つ揃っていれば合鍵。ひとつでも欠けたら null
 */
export function parseResetTokens(hash: string): ResetTokens | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))

  const accessToken = params.get('access-token')
  const client = params.get('client')
  const uid = params.get('uid')

  // 揃っていないものは受け取らない。半端な状態で再設定の画面を出しても、
  // 送信した瞬間に失敗するだけで、何が悪いのか分からない
  if (!accessToken || !client || !uid) return null

  return { accessToken, client, uid }
}
