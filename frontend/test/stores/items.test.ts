import { describe, it, expect, beforeEach } from 'vitest'
import { useItemsStore } from '@/stores/items'
import type { Item } from '@/types/item'

const item = (id: string, title = id) => ({ id, title }) as Item

describe('items store', () => {
  beforeEach(() => {
    useItemsStore.getState().resetItems()
  })

  it('作成すると一覧と棚の両方の先頭に入る', () => {
    const { setItems, setRecent, upsertItem } = useItemsStore.getState()
    setItems([item('a')])
    setRecent([item('a')])

    upsertItem(item('new'))

    const { items, recent } = useItemsStore.getState()
    expect(items.map((i) => i.id)).toEqual(['new', 'a'])
    expect(recent.map((i) => i.id)).toEqual(['new', 'a'])
  })

  it('既にあるものは重複させず置き換える', () => {
    const { setItems, setRecent, upsertItem } = useItemsStore.getState()
    setItems([item('a', '古い')])
    setRecent([item('a', '古い')])

    upsertItem(item('a', '新しい'))

    const { items, recent } = useItemsStore.getState()
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('新しい')
    expect(recent[0].title).toBe('新しい')
  })

  it('削除すると一覧と棚の両方から消える', () => {
    const { setItems, setRecent, removeItem } = useItemsStore.getState()
    setItems([item('a'), item('b')])
    setRecent([item('a'), item('b')])

    removeItem('a')

    const { items, recent } = useItemsStore.getState()
    expect(items.map((i) => i.id)).toEqual(['b'])
    expect(recent.map((i) => i.id)).toEqual(['b'])
  })

  it('まとめて削除しても両方から消える', () => {
    const { setItems, setRecent, removeItems } = useItemsStore.getState()
    setItems([item('a'), item('b'), item('c')])
    setRecent([item('a'), item('b')])

    removeItems(new Set(['a', 'c']))

    const { items, recent } = useItemsStore.getState()
    expect(items.map((i) => i.id)).toEqual(['b'])
    expect(recent.map((i) => i.id)).toEqual(['b'])
  })

  it('一覧と棚は別々に持つ（片方を入れ替えても他方は変わらない）', () => {
    const { setItems, setRecent } = useItemsStore.getState()
    setItems([item('a'), item('b'), item('c')])
    setRecent([item('a')])

    setRecent([item('x')])

    const { items, recent } = useItemsStore.getState()
    expect(items).toHaveLength(3)
    expect(recent.map((i) => i.id)).toEqual(['x'])
  })
})
