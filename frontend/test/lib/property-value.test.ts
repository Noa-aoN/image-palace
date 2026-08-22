import { describe, it, expect } from 'vitest'
import { isEmpty, isFilled, splitByFilled } from '@/lib/items/property-value'
import type { ItemPropertyEntry } from '@/lib/api/properties'

// 実物と同じ形で渡す（型が合わないと、実際には通らない組み合わせを試してしまう）
type Entry = Pick<ItemPropertyEntry, 'value_type' | 'value'>
const e = (value_type: ItemPropertyEntry['value_type'], value: ItemPropertyEntry['value']): Entry =>
  ({ value_type, value })

// **型ごとに「空」の形が違う。**
// 数えるところと並べるところで別々に書いていたので、1か所に出した
describe('項目に値が入っているか', () => {
  describe('文字', () => {
    it('書いてあれば入っている', () => {
      expect(isFilled(e('text', 'ディーエヌエス'))).toBe(true)
    })

    it('空文字は入っていない', () => {
      expect(isFilled(e('text', ''))).toBe(false)
    })

    // 空白だけを「書いた」と数えない
    it('空白だけは入っていない', () => {
      expect(isFilled(e('text', '   '))).toBe(false)
    })

    it('null は入っていない', () => {
      expect(isFilled(e('text', null))).toBe(false)
    })
  })

  describe('一覧', () => {
    it('1つでもあれば入っている', () => {
      expect(isFilled(e('list', ['IT']))).toBe(true)
    })

    it('空の一覧は入っていない', () => {
      expect(isFilled(e('list', []))).toBe(false)
    })
  })

  // **触っていないのと、見て「違う」と決めたのは別のこと。**
  // false を「空」と数えると、印を付けた意味が消える
  describe('チェック', () => {
    it('入は入っている', () => {
      expect(isFilled(e('boolean', true))).toBe(true)
    })

    it('切も入っている（見て決めたもの）', () => {
      expect(isFilled(e('boolean', false))).toBe(true)
    })

    it('触っていなければ入っていない', () => {
      expect(isFilled(e('boolean', null))).toBe(false)
    })
  })

  describe('自由欄', () => {
    it('見出しだけでも入っている', () => {
      expect(isFilled(e('free_text', { heading: 'メモ', body: '' }))).toBe(true)
    })

    it('中身だけでも入っている', () => {
      expect(isFilled(e('free_text', { heading: '', body: '気づき' }))).toBe(true)
    })

    it('どちらも空なら入っていない', () => {
      expect(isFilled(e('free_text', { heading: '', body: '' }))).toBe(false)
    })
  })

  describe('自由イメージ', () => {
    it('絵があれば入っている', () => {
      expect(isFilled(e('free_image', { url: 'https://x/y.png' }))).toBe(true)
    })

    it('指示だけでも入っている（これから作る）', () => {
      expect(isFilled(e('free_image', { prompt: '嵐の海' }))).toBe(true)
    })

    it('空なら入っていない', () => {
      expect(isFilled(e('free_image', {}))).toBe(false)
    })
  })

  describe('言語ごとの読み方', () => {
    it('1つでも書いてあれば入っている', () => {
      expect(isFilled(e('reading', [{ language: 'ja', text: 'かな' }]))).toBe(true)
    })

    it('空の並びは入っていない', () => {
      expect(isFilled(e('reading', []))).toBe(false)
    })
  })

  // **文字で入ってくる**（JSON の文字列）。中を見ないと、
  // 引いた結果が空でも「書いてある」と数えてしまう
  describe('Wikipedia', () => {
    it('引いてあれば入っている', () => {
      expect(
        isFilled(e('wikipedia', JSON.stringify({ wikipedia_title: 'DNS', wikipedia_extract: '…' })))
      ).toBe(true)
    })

    it('引いた結果が空なら入っていない', () => {
      expect(isFilled(e('wikipedia', JSON.stringify({})))).toBe(false)
      expect(
        isFilled(e('wikipedia', JSON.stringify({ wikipedia_title: '', wikipedia_extract: '' })))
      ).toBe(false)
    })

    it('JSON でない文字も、書いてあるものとして扱う', () => {
      expect(isFilled(e('wikipedia', 'DNS'))).toBe(true)
    })

    it('空文字は入っていない', () => {
      expect(isFilled(e('wikipedia', ''))).toBe(false)
    })
  })

  it('isEmpty は isFilled の裏', () => {
    expect(isEmpty(e('text', ''))).toBe(true)
    expect(isEmpty(e('text', 'あ'))).toBe(false)
  })
})

// **未設定を本文に全部並べない。**
// 定義が20あれば、書いていない18件が「未設定」と並んで縦に伸びる
describe('設定済みと、まだ書いていないものに分ける', () => {
  it('分かれる', () => {
    const { filled, empty } = splitByFilled([
      e('text', 'あり'),
      e('text', ''),
      e('list', []),
      e('boolean', false),
    ])

    expect(filled).toHaveLength(2)
    expect(empty).toHaveLength(2)
  })

  it('並びは変えない（定義した順のまま）', () => {
    const rows = [e('text', 'a'), e('text', ''), e('text', 'b')]

    expect(splitByFilled(rows).filled).toEqual([rows[0], rows[2]])
  })

  it('空を渡しても落ちない', () => {
    expect(splitByFilled([])).toEqual({ filled: [], empty: [] })
  })
})
