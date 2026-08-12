import { describe, it, expect } from 'vitest'
import {
  groupByOrder,
  groupAchievements,
  REWARD_KIND_ORDER,
  REWARD_KIND_LABELS,
} from '@/lib/admin-rewards-grouping'

type Row = { kind: string; name: string }
const rows: Row[] = [
  { kind: 'medal', name: '最初の一枚' },
  { kind: 'title', name: '旅人' },
  { kind: 'honor', name: '表彰状' },
  { kind: 'medal', name: '百枚' },
]

describe('種別ごとに束ねる', () => {
  it('決めた順に並べる（件数順にしない）', () => {
    const groups = groupByOrder(rows, (r) => r.kind, REWARD_KIND_ORDER, REWARD_KIND_LABELS)

    expect(groups.map((g) => g.key)).toEqual(['title', 'medal', 'honor'])
  })

  it('日本語の見出しを付ける', () => {
    const groups = groupByOrder(rows, (r) => r.kind, REWARD_KIND_ORDER, REWARD_KIND_LABELS)

    expect(groups.map((g) => g.label)).toEqual(['称号', '勲章', '表彰'])
  })

  // 見出しだけが並ぶと、何も無いのか読み込めていないのか分からない
  it('空の群は出さない', () => {
    const groups = groupByOrder(rows, (r) => r.kind, REWARD_KIND_ORDER, REWARD_KIND_LABELS)

    expect(groups.map((g) => g.key)).not.toContain('treasure')
  })

  it('群の中は渡された順のまま', () => {
    const groups = groupByOrder(rows, (r) => r.kind, REWARD_KIND_ORDER, REWARD_KIND_LABELS)
    const medals = groups.find((g) => g.key === 'medal')

    expect(medals?.rows.map((r) => r.name)).toEqual(['最初の一枚', '百枚'])
  })

  // 登録簿に新しい種別が増えても、ここを直すまでのあいだ行が消えないように
  it('知らない種別は末尾に回す（落とさない）', () => {
    const withNew = [...rows, { kind: 'relic', name: '未知の種別' }]
    const groups = groupByOrder(withNew, (r) => r.kind, REWARD_KIND_ORDER, REWARD_KIND_LABELS)

    expect(groups.at(-1)?.key).toBe('relic')
    expect(groups.at(-1)?.rows).toHaveLength(1)
  })

  it('空の一覧では群も空', () => {
    expect(groupByOrder([], (r: Row) => r.kind, REWARD_KIND_ORDER, REWARD_KIND_LABELS)).toEqual([])
  })
})

describe('実績を分類ごとに束ねる', () => {
  const achievements = [
    { category: '作る', name: 'a' },
    { category: null, name: 'b' },
    { category: '続ける', name: 'c' },
    { category: '作る', name: 'd' },
  ]

  it('分類ごとにまとめる', () => {
    const groups = groupAchievements(achievements)

    expect(groups.find((g) => g.key === '作る')?.rows).toHaveLength(2)
  })

  // 未設定を落とすと画面から消える。集めて必ず出す
  it('分類の無いものは「その他」に集めて、最後に置く', () => {
    const groups = groupAchievements(achievements)

    expect(groups.at(-1)?.key).toBe('その他')
    expect(groups.at(-1)?.rows.map((r) => r.name)).toEqual(['b'])
  })
})
