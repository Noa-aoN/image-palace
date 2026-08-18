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
 * ## 3段構え
 *
 *   1. その場で1回やり直す … ほとんどの失敗は一瞬の切断で、少し待てば通る
 *   2. 駄目なら取っておく   … 通信が戻ったとき／利用者が押したときに送り直す
 *   3. 送り直せたら消す     … 札は「まだ残っている失敗」の数だけを出す
 *
 * ## 取っておくときの鍵（key）
 *
 * **同じものへの後の操作が、前の操作を打ち消す。**
 * カードを動かして失敗し、もう一度動かして失敗したとき、
 * 2つとも送ると**古い位置が後から上書きする**。鍵を同じにして、
 * 新しいほうだけを残す。
 *
 * 鍵を渡さない書き込みは取っておかない（送り直すと壊れるものがあるため）。
 * その場合も失敗は数え、札には出る。
 */

/** やり直しまでの待ち。短すぎると同じ理由で落ちる */
const RETRY_DELAY_MS = 900

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface PersistOptions {
  /**
   * 取っておくときの鍵。**同じ対象の同じ操作には同じ鍵**を付ける。
   * 渡さなければ取っておかない（数えて札に出すだけ）。
   */
  key?: string
  /**
   * 諦めたときに呼ぶ。**画面を元に戻す**ために使う。
   * 渡さなければ画面はそのまま（食い違いは残るが、知らせはする）。
   */
  onGiveUp?: () => void
  /** その場でやり直す回数。既定 1。連番が崩れると困る操作は 0 にする */
  retries?: number
}

/**
 * 書き込みを1つ残す。**失敗しても投げない**（呼び出し側は描画の途中にいる）。
 *
 * 成功したら結果、駄目なら null を返す。
 */
export async function persist<T>(
  run: () => Promise<T>,
  options: PersistOptions = {}
): Promise<T | null> {
  const { key, onGiveUp, retries = 1 } = options
  const store = useSaveStatusStore.getState()

  store.begin()
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await run()
      store.succeed(key)
      return result
    } catch (error) {
      // 4xx はやり直しても同じ結果になる（消えたものを消そうとした等）。
      // 待つだけ無駄なので、その場で諦める
      if (attempt >= retries || isPermanent(error)) break
      await sleep(RETRY_DELAY_MS)
    }
  }

  store.fail(key ? { key, run: run as () => Promise<unknown> } : undefined)
  onGiveUp?.()
  return null
}

/**
 * 取ってあるものを送り直す。送れた数を返す。
 *
 * **一度に全部投げない。** 落ちた直後は通信が細いことが多く、
 * まとめて投げると同じ理由でまとめて落ちる。順に送る。
 */
export async function flushPending(): Promise<number> {
  const store = useSaveStatusStore.getState()
  const queued = store.takePending()
  let sent = 0

  for (const entry of queued) {
    try {
      await entry.run()
      store.resolvePending(entry.key)
      sent++
    } catch {
      // 送れなかったものは取っておく。**新しい操作があればそちらが勝つ**
      store.requeue(entry)
    }
  }
  return sent
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
