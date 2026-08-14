// アトリエで「何ができるのか」を選ぶ前に見せるための作例。
//
// **絵が無いあいだも、器は動く。** 素材（画像・GIF）は後から入れる前提なので、
// 手元に素材が無い種別は、できあがりの形をかたどった図で代わりにする。
// 文字だけの一覧より、選ぶ前に結果を想像できる。

export type AtelierKind = 'material' | 'item' | 'view' | 'space' | 'box'

export const ATELIER_KINDS: AtelierKind[] = ['material', 'item', 'view', 'space', 'box']

/**
 * 種別ごとの作例。**ここに増やすだけで、画面が作例を出すようになる。**
 * パスは `public/` からの絶対パス。2枚以上入れると、順ぐりに切り替わる。
 */
export const ATELIER_EXAMPLES: Record<AtelierKind, string[]> = {
  material: [],
  item: [],
  view: [],
  space: [],
  box: [],
}

/** 切り替えの間隔。読み終わる前に変わると落ち着かないので、やや長めに取る */
export const EXAMPLE_INTERVAL_MS = 3200

export type AtelierPreview =
  | { mode: 'assets'; sources: string[] }
  | { mode: 'schematic' }

/**
 * その種別を、絵で見せるか・図で見せるか。
 * 素材が1枚も無ければ図に落とす（空の枠を出すより、形が分かるほうがよい）。
 */
export function previewFor(kind: AtelierKind): AtelierPreview {
  const sources = ATELIER_EXAMPLES[kind] ?? []

  return sources.length > 0 ? { mode: 'assets', sources } : { mode: 'schematic' }
}

/** 何枚目を出すか。素材が増えても減っても、範囲から出ない */
export function exampleIndexAt(step: number, count: number): number {
  if (count <= 0) return 0

  return ((step % count) + count) % count
}
