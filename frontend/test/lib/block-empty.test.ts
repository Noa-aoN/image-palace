import { describe, it, expect } from 'vitest'
import { isBuiltInBlockEmpty, builtInBlockEmptiness } from '@/lib/items/block-empty'
import type { Item, ItemMeaning, ItemTag, ItemType } from '@/types/item'

// 実物と同じ形で渡す（型が合わないと、実際には通らない組み合わせを試してしまう）
type Subject = Pick<Item, 'item_type' | 'meanings' | 'tags'>

const type = (label: string): ItemType => ({ id: 't1', name: label, label })

const meaning = (definition: string, example_sentence?: string | null): ItemMeaning => ({
  id: `m-${definition}`,
  definition,
  example_sentence: example_sentence ?? null,
  detail_level: 'normal',
  language_code: 'ja',
  position: 1,
})

const tag = (name: string): ItemTag => ({ id: `tag-${name}`, name })

const card = (over: Partial<Subject> = {}): Subject => ({
  item_type: null,
  meanings: [],
  tags: [],
  ...over,
})

describe('作り付けの札が空か', () => {
  describe('種別', () => {
    it('選んでいなければ空', () => {
      expect(isBuiltInBlockEmpty('item_type', card())).toBe(true)
    })

    it('選んであれば空でない', () => {
      expect(isBuiltInBlockEmpty('item_type', card({ item_type: type('単語') }))).toBe(false)
    })
  })

  describe('意味・説明', () => {
    it('1件も無ければ空', () => {
      expect(isBuiltInBlockEmpty('meanings', card())).toBe(true)
    })

    it('1件でもあれば空でない', () => {
      expect(isBuiltInBlockEmpty('meanings', card({ meanings: [ meaning('名前を引く仕組み') ] }))).toBe(false)
    })

    // 項目そのものが返ってこない画面（一覧から開いた直後など）でも落ちない
    it('meanings が無くても空として扱う', () => {
      expect(isBuiltInBlockEmpty('meanings', { item_type: null, tags: [] })).toBe(true)
    })
  })

  describe('例', () => {
    it('意味が無ければ空', () => {
      expect(isBuiltInBlockEmpty('examples', card())).toBe(true)
    })

    // 意味があっても、例文の欄が空なら「まだ書いていない」
    it('意味だけあって例文が無ければ空', () => {
      expect(isBuiltInBlockEmpty('examples', card({ meanings: [ meaning('名前を引く仕組み') ] }))).toBe(true)
    })

    it('空白だけの例文は書いたと数えない', () => {
      expect(isBuiltInBlockEmpty('examples', card({ meanings: [ meaning('意味', '   ') ] }))).toBe(true)
    })

    // 意味を3つ持つカードで、2つ目にだけ例文がある、は普通に起きる
    it('どれか1つに書いてあれば空でない', () => {
      const meanings = [ meaning('神'), meaning('宇宙計画', 'Apollo 11 landed on the Moon.'), meaning('企業名') ]
      expect(isBuiltInBlockEmpty('examples', card({ meanings }))).toBe(false)
    })
  })

  describe('タグ', () => {
    it('1つも無ければ空', () => {
      expect(isBuiltInBlockEmpty('tags', card())).toBe(true)
    })

    it('1つでもあれば空でない', () => {
      expect(isBuiltInBlockEmpty('tags', card({ tags: [ tag('IT') ] }))).toBe(false)
    })
  })
})

describe('まとめて出す', () => {
  it('何も書いていないカードは、どの札も空', () => {
    expect(builtInBlockEmptiness(card())).toEqual({
      item_type: true,
      meanings: true,
      examples: true,
      tags: true,
    })
  })

  it('書いた札だけが空でなくなる', () => {
    const subject = card({ item_type: type('単語'), meanings: [ meaning('名前を引く仕組み') ] })
    expect(builtInBlockEmptiness(subject)).toEqual({
      item_type: false,
      meanings: false,
      // 意味はあるが例文はまだ
      examples: true,
      tags: true,
    })
  })
})

/**
 * カードを開いた直後に手元にあるのは一覧の要約で、意味もタグも種別も入っていない。
 *
 * **それを見て「空」と答えると、読めていないだけの札が灰色になり、
 * 読み終えた瞬間に白へ戻る。**「まだ読めていない」と「無い」は別のこと。
 */
describe('読めていないときは、空と決めない', () => {
  it('中身が無くても、読めていなければ空にしない', () => {
    expect(builtInBlockEmptiness(card(), false)).toEqual({
      item_type: false,
      meanings: false,
      examples: false,
      tags: false,
    })
  })

  it('読めたら、いつもどおり空を出す', () => {
    expect(builtInBlockEmptiness(card(), true)).toEqual({
      item_type: true,
      meanings: true,
      examples: true,
      tags: true,
    })
  })

  // 既定は「読めている」。ほかの呼び出しの振る舞いを変えない
  it('省略したら読めているものとして扱う', () => {
    expect(builtInBlockEmptiness(card())).toEqual(builtInBlockEmptiness(card(), true))
  })
})
