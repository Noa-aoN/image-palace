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

/**
 * 一覧が返すのは要約（id・見出し語・状態・絵だけ）で、項目も意味も並び順も入っていない。
 *
 * **要約で差し替えると、詳細を開いたまま一覧が更新されただけで
 * 項目が消え、並びが既定へ戻り、地の色まで変わる。**
 */
describe('要約は、既に持っている詳細を消さない', () => {
  beforeEach(() => {
    useItemsStore.getState().resetItems()
  })

  const detailed = (id: string) =>
    ({
      id,
      title: id,
      meanings: [ { id: 'm1', definition: '名前を引く仕組み' } ],
      properties: [ { key: 'origin', label: '語源' } ],
    }) as unknown as Item

  const summary = (id: string, title = id) => ({ id, title, generation_status: 'completed' }) as Item

  it('upsert が要約でも、項目と意味は残る', () => {
    const { setItems, upsertItem } = useItemsStore.getState()
    setItems([ detailed('a') ])

    upsertItem(summary('a', '書き換えた見出し'))

    const stored = useItemsStore.getState().items[0]
    expect(stored.title).toBe('書き換えた見出し')
    expect(stored.meanings).toHaveLength(1)
    expect(stored.properties).toHaveLength(1)
  })

  it('一覧の読み直しでも、項目と意味は残る', () => {
    const { setItems } = useItemsStore.getState()
    setItems([ detailed('a') ])

    setItems([ summary('a'), summary('b') ])

    const { items } = useItemsStore.getState()
    expect(items.map((i) => i.id)).toEqual([ 'a', 'b' ])
    expect(items[0].properties).toHaveLength(1)
    expect(items[1].properties).toBeUndefined()
  })

  // 顔ぶれと並びは新しいほうで決める（消えたカードは消えたまま）
  it('一覧から外れたカードは残さない', () => {
    const { setItems } = useItemsStore.getState()
    setItems([ detailed('a'), detailed('b') ])

    setItems([ summary('b') ])

    expect(useItemsStore.getState().items.map((i) => i.id)).toEqual([ 'b' ])
  })

  // 消したいときは、消した側が鍵ごと返してくる
  it('空の配列で返ってきたら、そのとおり空になる', () => {
    const { setItems, upsertItem } = useItemsStore.getState()
    setItems([ detailed('a') ])

    upsertItem({ id: 'a', title: 'a', properties: [] } as unknown as Item)

    expect(useItemsStore.getState().items[0].properties).toEqual([])
  })

  it('棚も同じように扱う', () => {
    const { setRecent } = useItemsStore.getState()
    setRecent([ detailed('a') ])

    setRecent([ summary('a') ])

    expect(useItemsStore.getState().recent[0].meanings).toHaveLength(1)
  })
})
