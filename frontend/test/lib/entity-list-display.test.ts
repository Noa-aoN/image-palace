import { describe, expect, it } from 'vitest'
import { sortEntities } from '@/hooks/useEntityListDisplay'

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
