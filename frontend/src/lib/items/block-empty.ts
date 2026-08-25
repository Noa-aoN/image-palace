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

/** どれも空と決めない、という答え。**読めていないときはこれを返す** */
const NOTHING_KNOWN: Record<BuiltInBlockKey, boolean> = {
  item_type: false,
  meanings: false,
  examples: false,
  tags: false,
}

/**
 * 作り付けの札の空き具合を、まとめて出す。画面は鍵で引くだけにする。
 *
 * @param known そのカードを**最後まで読めているか**。
 *
 * カードを開いた直後に手元にあるのは一覧の要約（見出し語・状態・絵だけ）で、
 * 意味もタグも種別も入っていない。それを見て「空」と答えると、
 * **読めていないだけの札が灰色になり、読み終えた瞬間に白へ戻る。**
 *
 * 「まだ読めていない」と「無い」は別のこと。読めていないなら、何も決めない。
 */
export function builtInBlockEmptiness(
  item: Pick<Item, 'item_type' | 'meanings' | 'tags'>,
  known = true
): Record<BuiltInBlockKey, boolean> {
  if (!known) return NOTHING_KNOWN

  return {
    item_type: isBuiltInBlockEmpty('item_type', item),
    meanings: isBuiltInBlockEmpty('meanings', item),
    examples: isBuiltInBlockEmpty('examples', item),
    tags: isBuiltInBlockEmpty('tags', item),
  }
}
