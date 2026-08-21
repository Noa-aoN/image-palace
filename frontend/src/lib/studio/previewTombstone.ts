/**
 * 終えた下見の行き先を、この端末に覚えておく。
 *
 * 下見を終えるとカードごと消えるので、開いていたタブを再読み込みすると
 * ただの「見つかりません」になる。**意図して終えたことが伝わらない。**
 *
 * サーバーに墓標を残すほどの話ではない（消えたものは消えたまま）。
 * 開いた側の端末だけが覚えていればよいので、ここに置く。
 */
const KEY = 'studio.preview.ended'
const KEEP = 20

type Ended = { boxId: string | null; viewId: string | null }

function read(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function write(ids: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids.slice(-KEEP)))
  } catch {
    // 保存できなくても、下見そのものは終わっている。黙って諦める
  }
}

/** 終えた下見の行き先を覚える。**古いものから捨てる**（際限なく貯めない） */
export function rememberEnded(ended: Ended): void {
  const ids = [ended.boxId, ended.viewId].filter((v): v is string => Boolean(v))
  if (ids.length === 0) return

  write([...read().filter((id) => !ids.includes(id)), ...ids])
}

/** その id は、終えた下見のものか */
export function wasEndedPreview(id: string | null | undefined): boolean {
  if (!id) return false
  return read().includes(id)
}

/** 覚えているものを、id の集まりとして返す（テスト・掃除のため） */
export function endedPreviewIds(): string[] {
  return read()
}

export function forgetEndedPreviews(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // 消せなくても困らない
  }
}
