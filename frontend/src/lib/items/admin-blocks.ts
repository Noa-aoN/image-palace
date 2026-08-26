import type { ItemPropertyEntry } from '@/lib/api/properties'

/**
 * 管理のための札。**覚える中身ではない。**
 *
 * 何回確かめたか・どこに置いてあるか・出典は何か。どれも要るものだが、
 * 意味や語源と同じ面に並んでいると、**覚えたいものと管理用の数字が混ざる**。
 * カードを開いた人が最初に読むべきものが、その分だけ後ろへ押される。
 *
 * だから既定では本文に置かず、「情報」から見られるようにする。
 * 必要な人は「追加できる項目」から出せる（消すのではなく、置き場所を変える）。
 */

/** 作り付けのうち、管理のためのもの */
export const ADMIN_BUILT_IN_KEYS = [ 'reviews', 'usages' ] as const

/** 自由プロパティのうち、役割が「管理要素」のもの。札の鍵は `prop:` が付く */
export function adminPropertyKeys(entries: ItemPropertyEntry[] | undefined): string[] {
  return (entries ?? [])
    .filter((entry) => entry.category === 'admin')
    .map((entry) => `prop:${entry.key}`)
}

/** そのカードで、管理のための札にあたるもの全部 */
export function adminBlockKeys(entries: ItemPropertyEntry[] | undefined): Set<string> {
  return new Set<string>([ ...ADMIN_BUILT_IN_KEYS, ...adminPropertyKeys(entries) ])
}

/**
 * 既定で「持たない」に回す札。
 *
 * **一度でも並べたカードには手を出さない。** 並べ替えるとその順が `order` に残るので、
 * そこに載っている札は「その人が置いた」ものとして扱う。
 * 既定を後から変えたときに、整えた並びが黙って崩れるのを避ける。
 *
 * @param adminKeys  管理のための札（`adminBlockKeys`）
 * @param order      そのカードで保存されている並び。未設定なら「まだ並べていない」
 */
export function defaultOmittedBlockKeys(adminKeys: Set<string>, order: string[] | undefined): Set<string> {
  const arranged = new Set(order ?? [])
  return new Set([ ...adminKeys ].filter((key) => !arranged.has(key)))
}

/** 「情報」に出す、管理要素の自由プロパティ。値の有無は問わない（出せることが分かるように） */
export function adminEntries(entries: ItemPropertyEntry[] | undefined): ItemPropertyEntry[] {
  return (entries ?? []).filter((entry) => entry.category === 'admin')
}
