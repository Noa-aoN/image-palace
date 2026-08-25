import type { Item } from '@/types/item'

/**
 * 作り付けの札が、まだ何も持っていないか。
 *
 * 自由プロパティは `property-value.ts` の `isFilled` が見ているが、
 * **作り付けの札は型が1つではない**。種別は1件の参照、意味は配列、
 * 例文は意味の中の1欄、タグは別の配列と、空の形がそれぞれ違う。
 *
 * 札ごとに書き分けると、片方だけ直ったときに「灰色なのに中身がある」が起きる。
 * 判定はここに集めて、画面は結果を受け取るだけにする。
 *
 * 引いてきて分かるもの（関連カード・学習の記録・使っている場所）は、
 * **読み終えるまで空かどうかが決まらない**ので、ここでは扱わない。
 * それぞれの component が自分の状態から渡す（読み込み中に灰色を出さないため）。
 */
export type BuiltInBlockKey = 'item_type' | 'meanings' | 'examples' | 'tags'

export function isBuiltInBlockEmpty(
  key: BuiltInBlockKey,
  item: Pick<Item, 'item_type' | 'meanings' | 'tags'>
): boolean {
  switch (key) {
    case 'item_type':
      return item.item_type == null

    case 'meanings':
      return (item.meanings?.length ?? 0) === 0

    case 'examples':
      // 意味が無ければ例文も書けない。意味があっても、
      // **どれか1つに書いてあれば**その札は書かれたものとして扱う
      return !(item.meanings ?? []).some((m) => (m.example_sentence ?? '').trim() !== '')

    case 'tags':
      return (item.tags?.length ?? 0) === 0
  }
}

/** 作り付けの札の空き具合を、まとめて出す。画面は鍵で引くだけにする */
export function builtInBlockEmptiness(
  item: Pick<Item, 'item_type' | 'meanings' | 'tags'>
): Record<BuiltInBlockKey, boolean> {
  return {
    item_type: isBuiltInBlockEmpty('item_type', item),
    meanings: isBuiltInBlockEmpty('meanings', item),
    examples: isBuiltInBlockEmpty('examples', item),
    tags: isBuiltInBlockEmpty('tags', item),
  }
}
