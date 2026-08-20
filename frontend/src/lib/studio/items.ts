import type { StudioItem } from '@/lib/api/studio'

/**
 * 公式宮殿の1枚が、いまどういう状態か。
 *
 * **公式宮殿にあるもの全部が公開物ではない。**
 * 並べただけでは「これは出ているのか」が分からないので、状態にして言う。
 */
export type ItemState =
  /** 出さないと決めた */
  | 'excluded'
  /** 出したくても出せない（絵・意味・種別が欠けている） */
  | 'blocked'
  /** すでに荷物に入って出ている */
  | 'shipped'
  /** 箱かキャンバスに入っているので、次の下書きに入る */
  | 'ready'
  /** 箱にもキャンバスにも入っていない */
  | 'loose'

export const ITEM_STATE_LABEL: Record<ItemState, string> = {
  excluded: '出さない',
  blocked: '出せない',
  shipped: '出している',
  ready: '出せる',
  loose: 'どこにも入っていない',
}

/**
 * 見た目の強さ。「出している」だけを目立たせ、欠けは注意の色にする。
 * 数が多いので、全部に色を付けると何も目立たない
 */
export const ITEM_STATE_TONE: Record<ItemState, 'active' | 'warn' | 'muted'> = {
  excluded: 'muted',
  blocked: 'warn',
  shipped: 'active',
  ready: 'muted',
  loose: 'muted',
}

/**
 * 状態を1つ決める。**順番が意味を持つ。**
 *
 * 外したかどうかを先に見るのは、外した1枚が「出している」に見えると
 * 押した操作が効いていないように読めるため。
 * 欠けはその次で、外していないのに出せないことを知らせる
 */
export function stateFor(item: StudioItem): ItemState {
  if (item.excluded) return 'excluded'
  if (item.blockers.length > 0) return 'blocked'
  if (item.packages.length > 0) return 'shipped'
  if (item.boxes.length > 0 || item.views.length > 0) return 'ready'
  return 'loose'
}

/**
 * 状態に添える一言。**次に何が起きるかを言う。**
 *
 * すでに出した荷物は動かない決まりなので、外しても消えない。
 * そこを黙っていると「外したのに配られている」と見える
 */
export function noteFor(item: StudioItem): string {
  switch (stateFor(item)) {
    case 'excluded':
      return item.packages.length > 0
        ? `次に起こす下書きから外れます（出した荷物 ${item.packages.join('・')} には残ります）`
        : '次に起こす下書きから外れます'
    case 'blocked':
      return item.blockers.join(' / ')
    case 'shipped':
      return `${item.packages.join('・')} に入っています`
    case 'ready':
      return '次の下書きに入ります'
    case 'loose':
      return '箱にもキャンバスにも入っていないので、選びようがありません'
  }
}

/** 絞り込み。**「出せない」だけを見たい**ことが多いので、栓を用意する */
export type ItemFilter = 'all' | ItemState

export function filterItems(items: StudioItem[], filter: ItemFilter, query: string): StudioItem[] {
  const needle = query.trim().toLowerCase()

  return items.filter((item) => {
    if (filter !== 'all' && stateFor(item) !== filter) return false
    if (!needle) return true

    return [item.title, ...item.boxes, ...item.views, ...item.packages].some((text) =>
      text.toLowerCase().includes(needle)
    )
  })
}

/** 上に出す内訳。**まず「出せない」が何枚あるか** */
export function countByState(items: StudioItem[]): Record<ItemState, number> {
  const counts: Record<ItemState, number> = {
    excluded: 0,
    blocked: 0,
    shipped: 0,
    ready: 0,
    loose: 0,
  }
  for (const item of items) counts[stateFor(item)] += 1
  return counts
}
