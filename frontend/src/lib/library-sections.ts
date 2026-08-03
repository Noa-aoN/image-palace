/**
 * ライブラリの棚（大項目）。
 *
 * バックエンドの Setting::LIBRARY_SECTIONS と一致させること。
 * 配列の順がそのまま既定の並び順になる。
 */
export const LIBRARY_SECTIONS = ['cards', 'canvas', 'spaces', 'boxes', 'materials'] as const

export type LibrarySection = (typeof LIBRARY_SECTIONS)[number]

export const LIBRARY_SECTION_LABELS: Record<LibrarySection, string> = {
  cards: 'カード',
  canvas: 'キャンバス',
  spaces: 'スペース',
  boxes: 'ボックス',
  materials: 'マテリアル',
}

/**
 * 保存された並びを、実際に描ける並びへ整える。
 *
 * 知らない名前は捨て、重複は畳み、載っていない棚は末尾へ回す。
 * こうしておけば、棚が増えても既存の設定のせいで画面から消えることがない。
 * （バックエンドでも同じ正規化をするが、古いキャッシュを描くときのために表側でも守る）
 */
export function normalizeLibraryOrder(order: readonly string[] | undefined | null): LibrarySection[] {
  const known = new Set<string>(LIBRARY_SECTIONS)
  const kept: LibrarySection[] = []
  for (const key of order ?? []) {
    if (known.has(key) && !kept.includes(key as LibrarySection)) kept.push(key as LibrarySection)
  }
  return [...kept, ...LIBRARY_SECTIONS.filter((key) => !kept.includes(key))]
}

/** 並びのうち index の項目を1つ前／後ろへ動かした新しい並びを返す */
export function moveLibrarySection(
  order: readonly LibrarySection[],
  index: number,
  direction: -1 | 1
): LibrarySection[] {
  const target = index + direction
  if (index < 0 || index >= order.length || target < 0 || target >= order.length) return [...order]

  const next = [...order]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
