import { create } from 'zustand'

/**
 * 保存の成否と、送り直せる書き込みを持つ入れ物。
 *
 * **画面ごとに握らない。** キャンバスの編集は盤面・右パネル・一覧の
 * どこからでも起きるので、失敗を出す場所は1つにまとめる。
 */

export interface PendingWrite {
  /** 同じ対象の同じ操作を表す鍵。**新しいほうが古いほうを置き換える** */
  key: string
  run: () => Promise<unknown>
}

export interface SaveStatusState {
  /** いま書き込み中の数。0 より大きい間だけ「保存中」 */
  pending: number
  /** 送り直せずに残っている書き込み。鍵ごとに1つだけ */
  queued: PendingWrite[]
  /** 鍵を持たずに落ちた数。送り直せないので、数だけ覚えておく */
  lost: number
  /** 最後に諦めた時刻 */
  failedAt: number | null
  begin: () => void
  /** 通ったとき。**同じ鍵で取ってあるものがあれば、それも用済み**にする */
  succeed: (key?: string) => void
  fail: (write?: PendingWrite) => void
  /** 送り直すために取り出す（取り出した時点で一旦空にする） */
  takePending: () => PendingWrite[]
  /** 送れた */
  resolvePending: (key: string) => void
  /** 送れなかったので戻す。**その間に新しいものが来ていたら、そちらを残す** */
  requeue: (write: PendingWrite) => void
  /** 利用者が閉じたとき。取ってあるものも捨てる */
  dismiss: () => void
}

/** 札に出す「まだ直っていない失敗」の数 */
export const failedCount = (s: Pick<SaveStatusState, 'queued' | 'lost'>) => s.queued.length + s.lost

export const useSaveStatusStore = create<SaveStatusState>((set, get) => ({
  pending: 0,
  queued: [],
  lost: 0,
  failedAt: null,

  begin: () => set((s) => ({ pending: s.pending + 1 })),

  succeed: (key) =>
    set((s) => ({
      pending: Math.max(0, s.pending - 1),
      // 同じ対象へ後から書けたなら、取ってある古いものは送ってはいけない
      queued: key ? s.queued.filter((w) => w.key !== key) : s.queued,
    })),

  fail: (write) =>
    set((s) => ({
      pending: Math.max(0, s.pending - 1),
      queued: write ? [...s.queued.filter((w) => w.key !== write.key), write] : s.queued,
      lost: write ? s.lost : s.lost + 1,
      failedAt: Date.now(),
    })),

  takePending: () => {
    const queued = get().queued
    set({ queued: [] })
    return queued
  },

  resolvePending: () => set((s) => ({ lost: s.lost })), // 取り出し済みなので消すものは無い

  requeue: (write) =>
    set((s) => ({
      // 取り出したあとに新しい書き込みが積まれていたら、**そちらが新しい**
      queued: s.queued.some((w) => w.key === write.key) ? s.queued : [...s.queued, write],
    })),

  dismiss: () => set({ queued: [], lost: 0, failedAt: null }),
}))
