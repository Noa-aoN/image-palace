/**
 * ページ間で持ち回す一時キャッシュ。
 *
 * 一覧ページは遷移のたびに取得し直しており、一度見たページへ戻っても
 * 空 → スケルトン → データ、を毎回繰り返していた。
 * 直前に描いていた内容を覚えておき、再訪時はまずそれを描いてから
 * 裏で取り直す（stale-while-revalidate）ことで、待ち時間を体感から消す。
 *
 * 保持はメモリのみ。再読み込みや別タブには持ち越さない。
 * 「少し古いかもしれない内容を一瞬見せる」のは許容するが、
 * 「閉じたはずの内容が次の起動で復活する」のは避けたいため。
 *
 * 古さの上限を設けているのは、長く開いたままのタブで再訪したときに
 * 明らかに古い内容を見せないため。上限を過ぎたものは無いものとして扱う。
 */
const MAX_AGE_MS = 5 * 60 * 1000

type Entry = { value: unknown; storedAt: number }

const store = new Map<string, Entry>()

/** 現在時刻。テストから差し替えられるようにしておく */
let now = () => Date.now()

export function setPageCacheClock(fn: () => number) {
  now = fn
}

export function readPageCache<T>(key: string): T | undefined {
  const entry = store.get(key)
  if (!entry) return undefined

  if (now() - entry.storedAt > MAX_AGE_MS) {
    store.delete(key)
    return undefined
  }
  return entry.value as T
}

export function writePageCache<T>(key: string, value: T): void {
  store.set(key, { value, storedAt: now() })
}

export function clearPageCache(key?: string): void {
  if (key === undefined) store.clear()
  else store.delete(key)
}
