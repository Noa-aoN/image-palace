/**
 * 公開のページから、アプリの中へ進むときの行き先。
 *
 * まだログインしていない人を作成画面へ送っても、門で止められて `/login` に飛ぶ。
 * 読みに来た人が、押した先で追い返される形になる。そうなる前に登録へ送る。
 *
 * ログインの有無は端末の中にしか無く、**サーバー側では分からない**。
 * 分かるまでは登録側を出す（公開のページでは、初めての人のほうが多い）。
 */
export const SIGN_UP_PATH = '/signup'

export function startHref(
  href: string,
  { ready, isAuthenticated }: { ready: boolean; isAuthenticated: boolean }
): string {
  return ready && isAuthenticated ? href : SIGN_UP_PATH
}
