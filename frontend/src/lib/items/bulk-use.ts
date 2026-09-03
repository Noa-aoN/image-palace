import { VIEW_TYPE_LABELS } from '@/lib/view-types'

/** 箱はキャンバスの種別ではないが、選んだカードの行き先としては同じ並びに置く */
export const BOX_KIND = 'box'

/**
 * 選んだカードから作るときの、名前の下書き。
 *
 * **先頭のカードの名前を借りる。** 「新しいデッキ」だと、いくつ作っても
 * 見分けが付かない。中に何が入っているかが名前から読めるほうがよい。
 *
 * 空欄でも作れるようにしたいので、ここは必ず何かを返す。
 */
export function defaultBulkName(kind: string, titles: string[]): string {
  const label = kind === BOX_KIND ? 'ボックス' : (VIEW_TYPE_LABELS[kind] ?? 'キャンバス')
  const head = titles[0]?.trim()
  if (!head) return `新しい${label}`

  return titles.length > 1 ? `${head} ほか${titles.length - 1}枚の${label}` : `${head}の${label}`
}
