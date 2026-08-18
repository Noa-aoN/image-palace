import { create } from 'zustand'

/**
 * 保存の成否を数えるだけの入れ物。
 *
 * **画面ごとに握らない。** キャンバスの編集は盤面・右パネル・一覧の
 * どこからでも起きるので、失敗を出す場所は1つにまとめる。
 *
 * 持つのは数と時刻だけで、何が失敗したかは持たない。
 * 「どのカードの、どの操作が」まで出すと、消えた操作の説明に文字数が要る割に、
 * 利用者にできることは同じ（もう一度やる）。
 */
export interface SaveStatusState {
  /** いま書き込み中の数。0 より大きい間だけ「保存中」 */
  pending: number
  /** やり直しても駄目だった数。0 に戻すまで出し続ける */
  failed: number
  /** 最後に諦めた時刻。**同じ失敗を出し直したことが分かる**ようにする */
  failedAt: number | null
  begin: () => void
  succeed: () => void
  fail: () => void
  /** 利用者が閉じたとき。次の失敗でまた出る */
  dismiss: () => void
}

export const useSaveStatusStore = create<SaveStatusState>((set) => ({
  pending: 0,
  failed: 0,
  failedAt: null,

  begin: () => set((s) => ({ pending: s.pending + 1 })),

  // 1つでも通ったら「保存できていない」とは言えない…とはしない。
  // **失敗の数は成功で消さない。** 消えた操作は成功した別の操作では戻らない
  succeed: () => set((s) => ({ pending: Math.max(0, s.pending - 1) })),

  fail: () =>
    set((s) => ({
      pending: Math.max(0, s.pending - 1),
      failed: s.failed + 1,
      failedAt: Date.now(),
    })),

  dismiss: () => set({ failed: 0, failedAt: null }),
}))
