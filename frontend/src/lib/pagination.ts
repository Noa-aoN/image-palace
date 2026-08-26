/**
 * ページ送りに出す番号の並び。
 *
 * **「前へ / 次へ」だけでは、遠くへ行けない。** 40ページある一覧で
 * 最後を見たい人は、次へを39回押すことになる。番号があれば1回で着く。
 *
 * かといって全部の番号を並べると、ページが増えるほど帯が伸びて折り返す。
 * **いまいる場所の周りと、両端だけ**を出し、間は「…」で省く。
 */

/** 番号の代わりに置く、省略の印 */
export const PAGE_GAP = 'gap' as const

export type PageSlot = number | typeof PAGE_GAP

/**
 * @param current いまのページ（1 始まり）
 * @param total   全ページ数
 * @param around  いまいる場所の左右に出す数。既定は1（前後1つずつ）
 *
 * **幅を一定に保つ。** 端にいるときだけ番号が少なくなると、
 * ページを送るたびに帯の幅が変わって、押した先のボタンが動く。
 * 端では反対側を1つ多く出して、出る数をそろえる。
 */
export function pageWindow(current: number, total: number, around = 1): PageSlot[] {
  if (total <= 0) return []

  const page = Math.min(Math.max(current, 1), total)
  // 出す枠の数：先頭 ＋ 省略 ＋ いまの周り ＋ 省略 ＋ 末尾。
  // **どこにいてもこの数を保つ**（端では省略が番号に変わるだけ）
  const slots = around * 2 + 5
  if (total <= slots) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  // **「…」で1ページだけ省かない。** 省いた先が1つなら、その番号を出すほうが早い。
  // 左の省略が要るのは、2 から数えて2つ以上が隠れるとき（＝周りの左端が4以上）
  const nearStart = page - around <= 3
  const nearEnd = page + around >= total - 2

  if (nearStart) {
    const head = Array.from({ length: slots - 2 }, (_, index) => index + 1)
    return [ ...head, PAGE_GAP, total ]
  }

  if (nearEnd) {
    const from = total - (slots - 3)
    const tail = Array.from({ length: slots - 2 }, (_, index) => from + index)
    return [ 1, PAGE_GAP, ...tail ]
  }

  const middle = Array.from({ length: around * 2 + 1 }, (_, index) => page - around + index)
  return [ 1, PAGE_GAP, ...middle, PAGE_GAP, total ]
}

/** 押せる行き先か。いまいるページと、範囲の外は押させない */
export function canGoTo(target: number, current: number, total: number): boolean {
  return target >= 1 && target <= total && target !== current
}
