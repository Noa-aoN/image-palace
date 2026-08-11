import { describe, expect, it } from 'vitest'
import { groupEntities, sortEntities, DEFAULT_ENTITY_DISPLAY } from '@/hooks/useEntityListDisplay'

type Row = { id: string; name: string; count: number }

const rows: Row[] = [
  { id: '1', name: 'たんご', count: 3 },
  { id: '2', name: 'あいうえお', count: 10 },
  { id: '3', name: 'さくら', count: 1 },
]

const read = { name: (r: Row) => r.name, count: (r: Row) => r.count }

describe('sortEntities', () => {
  it('新しい順は、渡された並びをそのまま返す（サーバーが新しい順で返すため）', () => {
    expect(sortEntities(rows, 'recent', read)).toBe(rows)
  })

  it('名前順は、日本語の読みで並べる', () => {
    expect(sortEntities(rows, 'name', read).map((r) => r.name)).toEqual(['あいうえお', 'さくら', 'たんご'])
  })

  it('中身が多い順', () => {
    expect(sortEntities(rows, 'size', read).map((r) => r.id)).toEqual(['2', '1', '3'])
  })

  it('元の配列を書き換えない（一覧の並びが呼ぶたびに変わらない）', () => {
    const before = rows.map((r) => r.id)
    sortEntities(rows, 'name', read)

    expect(rows.map((r) => r.id)).toEqual(before)
  })
})

type Typed = { id: string; type: string }

const label = (type: string) => ({ deck: 'デッキ', freeboard: 'フリーボード' })[type] ?? type

describe('groupEntities', () => {
  const typed: Typed[] = [
    { id: '1', type: 'freeboard' },
    { id: '2', type: 'deck' },
    { id: '3', type: 'freeboard' },
  ]
  const read = { type: (r: Typed) => r.type, label }

  it('決めた順に棚を並べる（一覧に出てきた順ではない）', () => {
    const groups = groupEntities(typed, ['deck', 'freeboard'], read)

    expect(groups.map((g) => g.type)).toEqual(['deck', 'freeboard'])
    expect(groups.map((g) => g.label)).toEqual(['デッキ', 'フリーボード'])
  })

  it('中身が0の種別は棚ごと出さない（あるはずのものが無いように見える）', () => {
    const groups = groupEntities(typed, ['deck', 'freeboard', 'timeline'], read)

    expect(groups.map((g) => g.type)).not.toContain('timeline')
  })

  it('知らない種別は後ろに回す（落とさない）', () => {
    const groups = groupEntities([...typed, { id: '4', type: 'unknown' }], ['deck', 'freeboard'], read)

    expect(groups.at(-1)?.type).toEqual('unknown')
  })

  it('棚の中の並びは、渡された順のまま', () => {
    const groups = groupEntities(typed, ['freeboard'], read)

    expect(groups[0].rows.map((r) => r.id)).toEqual(['1', '3'])
  })
})

// 既定は端末に何も覚えていない人が最初に見る並び。
// 変えるときは「まとめて並べたほうが探しやすいか」を考えてから変える
describe('既定の見せ方', () => {
  it('種別ごとに分ける', () => {
    expect(DEFAULT_ENTITY_DISPLAY.grouping).toBe('type')
  })

  it('新しい順・5列・付帯情報あり', () => {
    expect(DEFAULT_ENTITY_DISPLAY.sort).toBe('recent')
    expect(DEFAULT_ENTITY_DISPLAY.columns).toBe(5)
    expect(DEFAULT_ENTITY_DISPLAY.showMeta).toBe(true)
  })
})
