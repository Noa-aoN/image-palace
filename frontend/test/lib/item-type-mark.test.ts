import { describe, it, expect } from 'vitest'
import { itemTypeMark } from '@/lib/items/item-type-mark'
import type { ItemType } from '@/types/item'

const type = (name: string, label: string): ItemType => ({ id: name, name, label })

describe('種別の印', () => {
  it('決めてある種別は、決めた一文字を出す', () => {
    expect(itemTypeMark(type('term', '単語'))?.char).toBe('単')
    expect(itemTypeMark(type('person', '人物'))?.char).toBe('人')
    expect(itemTypeMark(type('event', '出来事'))?.char).toBe('出')
    expect(itemTypeMark(type('task', 'タスク'))?.char).toBe('タ')
  })

  it('呼び名も一緒に返す（指を乗せたら読めるように）', () => {
    expect(itemTypeMark(type('place', '場所'))?.label).toBe('場所')
  })

  // 出ないより、何かが出ているほうが読める
  it('知らない種別は、呼び名の一文字目を借りる', () => {
    const mark = itemTypeMark(type('recipe', '料理'))
    expect(mark?.char).toBe('料')
    expect(mark?.color).toBe('var(--palace)')
  })

  it('種別が付いていなければ、印を出さない', () => {
    expect(itemTypeMark(null)).toBeNull()
    expect(itemTypeMark(undefined)).toBeNull()
  })

  it('呼び名が空なら、印を出さない', () => {
    expect(itemTypeMark(type('', ''))).toBeNull()
  })

  // 一覧で並んだときに、印だけで見分けられないと意味が無い
  it('決めてある印は、どれも別の文字', () => {
    const names = [ 'term', 'concept', 'entity', 'person', 'place', 'event', 'organization', 'work', 'record', 'task' ]
    const chars = names.map((n) => itemTypeMark(type(n, n))?.char)
    expect(new Set(chars).size).toBe(names.length)
  })
})
