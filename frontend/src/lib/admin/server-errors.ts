/**
 * サーバーが断った理由を取り出す。
 *
 * 運営画面の保存は `{ errors: string[] }` か `{ error: string }` で断られる。
 * ここを見ずに「保存できませんでした」だけを出すと、**直し方が分からない**。
 * 「この報酬設定は許可されていません」まで届いて初めて、次の操作を選べる。
 *
 * 同じ取り出しが4つの運営パネルに写し取られていたので、1箇所にまとめる。
 */
type ServerErrorShape = {
  response?: { data?: { error?: string; errors?: string[] } }
}

/** 断られた理由の一覧。取り出せなければ空 */
export function serverErrorMessages(error: unknown): string[] {
  const data = (error as ServerErrorShape)?.response?.data
  if (!data) return []

  if (Array.isArray(data.errors)) {
    const messages = data.errors.filter((m): m is string => typeof m === 'string' && m.length > 0)
    if (messages.length) return messages
  }
  return typeof data.error === 'string' && data.error.length > 0 ? [data.error] : []
}

/**
 * 画面に出す1行。理由があればそれを、無ければ渡した言い方を返す。
 *
 * 理由が複数あるときは繋げて出す（1つだけ見せると、直したのにまた断られる）。
 */
export function serverErrorMessage(error: unknown, fallback: string): string {
  const messages = serverErrorMessages(error)
  return messages.length ? messages.join(' / ') : fallback
}
