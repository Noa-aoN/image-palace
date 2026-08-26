import { describe, expect, it } from 'vitest'
import {
  MAX_VISIBLE_FIELDS,
  buildLayoutRows,
  isFixedPosition,
  displayValue,
  moveRow,
  toggleVisible,
  visibleCount,
  type LayoutCandidate,
  type LayoutRow,
} from '@/lib/card-list-layout'

const candidates: LayoutCandidate[] = [
  { key: 'title', label: '見出し語', builtin: true },
  { key: 'image', label: 'イメージ', builtin: true },
  { key: 'meaning', label: '意味・説明', builtin: true },
  { key: 'reading', label: '読み方', builtin: false },
  { key: 'alias', label: '別名', builtin: false },
]

describe('buildLayoutRows', () => {
  it('保存されている順を先に、残りの候補を隠した状態で後ろへ足す', () => {
    const rows = buildLayoutRows(
      [
        { key: 'reading', visible: true },
        { key: 'image', visible: true },
      ],
      candidates
    )

    expect(rows.map((r) => r.key)).toEqual(['reading', 'image', 'title', 'meaning', 'alias'])
    expect(rows.filter((r) => r.visible).map((r) => r.key)).toEqual(['reading', 'image'])
  })

  // 項目そのものを消した人の並びに、消えた項目が残り続けないように
  it('候補から消えた項目は並びからも落とす', () => {
    const rows = buildLayoutRows([{ key: 'gone', visible: true }], candidates)

    expect(rows.map((r) => r.key)).not.toContain('gone')
  })

  it('何も保存していなければ、すべて隠した状態で候補が並ぶ', () => {
    expect(buildLayoutRows([], candidates).every((r) => !r.visible)).toBe(true)
  })
})

describe('toggleVisible', () => {
  const rows: LayoutRow[] = candidates.map((c, i) => ({ key: c.key, visible: i < 2 }))

  it('隠しているものを出す', () => {
    const { rows: next, rejected } = toggleVisible(rows, 'meaning')

    expect(next.find((r) => r.key === 'meaning')?.visible).toBe(true)
    expect(rejected).toBe(false)
  })

  it('出しているものを隠す', () => {
    const { rows: next } = toggleVisible(rows, 'title')

    expect(next.find((r) => r.key === 'title')?.visible).toBe(false)
  })

  // 上限に達しているとき、押した項目ではない何かが消えると理由が分からない
  it(`出す指定が${MAX_VISIBLE_FIELDS}件のときは、6件目を断る（入れ替えない）`, () => {
    const full: LayoutRow[] = [
      ...candidates.map((c) => ({ key: c.key, visible: true })),
      { key: 'extra', visible: false },
    ]

    const { rows: next, rejected } = toggleVisible(full, 'extra')

    expect(rejected).toBe(true)
    expect(visibleCount(next)).toBe(MAX_VISIBLE_FIELDS)
    expect(next.find((r) => r.key === 'extra')?.visible).toBe(false)
  })

  it('上限に達していても、隠す方向は通す', () => {
    const full: LayoutRow[] = candidates.map((c) => ({ key: c.key, visible: true }))

    const { rows: next, rejected } = toggleVisible(full, 'title')

    expect(rejected).toBe(false)
    expect(visibleCount(next)).toBe(MAX_VISIBLE_FIELDS - 1)
  })

  it('知らない項目は何もしない', () => {
    expect(toggleVisible(rows, 'unknown').rows).toEqual(rows)
  })
})

describe('moveRow', () => {
  const rows: LayoutRow[] = [
    { key: 'a', visible: true },
    { key: 'b', visible: true },
    { key: 'c', visible: false },
  ]

  it('前へ動かす', () => {
    expect(moveRow(rows, 2, 0).map((r) => r.key)).toEqual(['c', 'a', 'b'])
  })

  it('後ろへ動かす', () => {
    expect(moveRow(rows, 0, 2).map((r) => r.key)).toEqual(['b', 'c', 'a'])
  })

  it('範囲の外へは動かさない', () => {
    expect(moveRow(rows, 0, -1)).toEqual(rows)
    expect(moveRow(rows, 0, 3)).toEqual(rows)
    expect(moveRow(rows, 1, 1)).toEqual(rows)
  })
})

describe('displayValue', () => {
  it('値があればそのまま出す', () => {
    expect(displayValue('ばら')).toBe('ばら')
  })

  // 空欄にすると「設定が効いていない」ように見える
  it('値が無ければ - を出す', () => {
    expect(displayValue(null)).toBe('-')
    expect(displayValue(undefined)).toBe('-')
    expect(displayValue('')).toBe('-')
    expect(displayValue('   ')).toBe('-')
  })
})

/**
 * 種別の印は**見出し語の右**に出る。下へ積む項目ではないので、
 * 並べ替えの対象にも、出せる数の勘定にも入れない。
 */
describe('置き場所が決まっている項目', () => {
  const rows = (...keys: string[]): LayoutRow[] => keys.map((key) => ({ key, visible: true }))

  it('種別の印は、置き場所が決まっている', () => {
    expect(isFixedPosition('item_type')).toBe(true)
    expect(isFixedPosition('meaning')).toBe(false)
  })

  // あの上限は「カードが縦に伸びる」のを抑えるためのもの。
  // 縦を使わない印を数えると、数えるべきものが1つ減る
  it('出せる数に数えない', () => {
    expect(visibleCount(rows('title', 'image', 'item_type'))).toBe(2)
  })

  it('上限に達していても、印は出せる', () => {
    const full: LayoutRow[] = [
      ...rows('title', 'image', 'meaning', 'reading', 'origin'),
      { key: 'item_type', visible: false },
    ]
    expect(visibleCount(full)).toBe(MAX_VISIBLE_FIELDS)

    const { rows: next, rejected } = toggleVisible(full, 'item_type')
    expect(rejected).toBe(false)
    expect(next.find((r) => r.key === 'item_type')?.visible).toBe(true)
  })

  it('上限に達していれば、ふつうの項目は断る', () => {
    const full: LayoutRow[] = [
      ...rows('title', 'image', 'meaning', 'reading', 'origin'),
      { key: 'aliases', visible: false },
    ]
    expect(toggleVisible(full, 'aliases').rejected).toBe(true)
  })
})
