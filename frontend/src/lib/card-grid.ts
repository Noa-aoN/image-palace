/**
 * カードを並べる格子の列数 → Tailwind クラスの対応表。
 *
 * 表示設定（useCardDisplay）と、読み込み中のスケルトン（ui/skeleton）の両方が使う。
 * 片方だけが知っていると、読み込み中と読み込み後で列数が変わって画面が飛ぶ。
 * hooks 側に置くと ui のプリミティブが hook に依存してしまうので、ここに置く。
 *
 * Tailwind はクラス名を文字列として静的に読むため、`grid-cols-${n}` と組み立てず
 * 対応表から選ぶ。狭い画面では列を減らすので、単純な等倍にはなっていない。
 */
export const CARD_GRID_CLASSES: Record<number, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6',
  7: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7',
  8: 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8',
  9: 'grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9',
  10: 'grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-10',
}

/** 表示設定を持たない一覧（ボックス・スペース・ビュー）が使う既定の列数 */
export const DEFAULT_GRID_COLUMNS = 5

/** 対応表に無い列数が来ても崩れないようにする */
export function cardGridClass(columns: number = DEFAULT_GRID_COLUMNS): string {
  return CARD_GRID_CLASSES[columns] ?? CARD_GRID_CLASSES[DEFAULT_GRID_COLUMNS]
}
