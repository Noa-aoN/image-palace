import { useSaveStatusStore } from '@/stores/saveStatus'

/**
 * 「置いた」「消した」「つないだ」をサーバーへ残す。
 *
 * キャンバスとスペースの編集は、**画面を先に動かしてから**サーバーへ書く
 * （待たせると掴んだカードが指に付いてこない）。この形は速いが、
 * 書き込みが落ちたときに**画面と中身が食い違ったまま何も起きない**。
 *
 * 実際そうなっていた。24 箇所が `.catch(() => {})` で、
 * ドラッグして置いた位置も、消したカードも、引いた線も、
 * 失敗したら黙って捨てられていた。利用者はリロードして初めて気づく。
 *
 * ここが**その唯一の入口**。書き込みは全部これを通す。
 *
 * ## なぜ1回だけやり直すのか
 *
 * この種の失敗はほとんどが一瞬の切断（電車・エレベータ・タブ復帰の直後）で、
 * 少し待てば通る。何度もやり直すと、本当に駄目なときに気づくのが遅れるうえ、
 * 連打された操作の順番が崩れる。**1回試して駄目なら、正直に伝える。**
 */

/** やり直しまでの待ち。短すぎると同じ理由で落ちる */
const RETRY_DELAY_MS = 900

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface PersistOptions {
  /**
   * 諦めたときに呼ぶ。**画面を元に戻す**ために使う。
   * 渡さなければ画面はそのまま（食い違いは残るが、知らせはする）。
   */
  onGiveUp?: () => void
  /** やり直す回数。既定 1。連番が崩れると困る操作は 0 にする */
  retries?: number
}

/**
 * 書き込みを1つ残す。**失敗しても投げない**（呼び出し側は描画の途中にいる）。
 *
 * 成功したら結果、駄目なら null を返す。
 * 諦めたことは `useSaveStatusStore` に積まれ、画面の隅に出る。
 */
export async function persist<T>(
  run: () => Promise<T>,
  options: PersistOptions = {}
): Promise<T | null> {
  const { onGiveUp, retries = 1 } = options
  const store = useSaveStatusStore.getState()

  store.begin()
  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await run()
        store.succeed()
        return result
      } catch (error) {
        // 4xx はやり直しても同じ結果になる（消えたものを消そうとした等）。
        // 待つだけ無駄なので、その場で諦める
        if (attempt >= retries || isPermanent(error)) break
        await sleep(RETRY_DELAY_MS)
      }
    }
  } finally {
    // begin と対で必ず閉じる（途中で投げても保存中のまま残さない）
  }

  store.fail()
  onGiveUp?.()
  return null
}

/**
 * やり直しても変わらない失敗か。
 *
 * 通信が切れているとき（status を持たない）は**やり直す側**に倒す。
 * 429 は待てば通るので、これも一時的として扱う。
 */
function isPermanent(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (typeof status !== 'number') return false

  return status >= 400 && status < 500 && status !== 429 && status !== 408
}
