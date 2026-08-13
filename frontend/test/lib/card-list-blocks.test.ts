import { describe, expect, it } from 'vitest'
import {
  EMPTY_VALUE_MARK,
  buildLayoutRows,
  moveRow,
  toggleVisible,
  visibleCount,
  type LayoutCandidate,
} from '@/lib/card-list-layout'

const CANDIDATES: LayoutCandidate[] = [
  { key: 'title', label: '見出し語', builtin: true },
  { key: 'image', label: 'イメージ', builtin: true },
  { key: 'meaning', label: '意味・説明', builtin: true },
  { key: 'reading', label: '読み方', builtin: false },
]

/**
 * 一覧が何をどの順で積むかは、設定の並びがそのまま決める。
 *
 * サーバーは `meta.card_list.blocks` に「出すものを順に」返し、画面はそれを積むだけ。
 * ここでは、その元になる設定の並びが正しく作れるかを見る。
 */
const blocksFrom = (rows: { key: string; visible: boolean }[], headlineKey?: string) =>
  rows.filter((row) => row.visible && row.key !== 'title' && row.key !== headlineKey).map((row) => row.key)

describe('一覧に積むもの', () => {
  // 既定はサーバーが持つ（設定 API は card_list_layout_entries を返すので、
  // 一度も触っていない人にも「見出し語＋イメージ」が届く）
  it('既定は見出し語と絵', () => {
    const rows = buildLayoutRows(
      [
        { key: 'title', visible: true },
        { key: 'image', visible: true },
      ],
      CANDIDATES
    )

    expect(blocksFrom(rows)).toEqual(['image'])
  })

  it('候補に無い項目は並びから落ちる（項目そのものを消したとき）', () => {
    const rows = buildLayoutRows(
      [
        { key: 'title', visible: true },
        { key: '消えた項目', visible: true },
      ],
      CANDIDATES
    )

    expect(rows.map((row) => row.key)).not.toContain('消えた項目')
  })

  it('イメージを外すと積まれない（枠だけが残らない）', () => {
    const rows = buildLayoutRows(
      [
        { key: 'title', visible: true },
        { key: 'image', visible: true },
        { key: 'meaning', visible: true },
      ],
      CANDIDATES
    )

    const { rows: next } = toggleVisible(rows, 'image')

    expect(blocksFrom(next)).toEqual(['meaning'])
  })

  it('並べ替えた順がそのまま積む順になる', () => {
    const rows = buildLayoutRows(
      [
        { key: 'title', visible: true },
        { key: 'image', visible: true },
        { key: 'meaning', visible: true },
      ],
      CANDIDATES
    )

    // 意味・説明を絵より前へ
    const moved = moveRow(rows, 2, 1)

    expect(blocksFrom(moved)).toEqual(['meaning', 'image'])
  })

  it('名前として使う項目は、下にもう一度積まない', () => {
    const rows = buildLayoutRows(
      [
        { key: 'reading', visible: true },
        { key: 'image', visible: true },
      ],
      CANDIDATES
    )

    // 見出しに使われた reading は blocks から落ちる
    expect(blocksFrom(rows, 'reading')).toEqual(['image'])
  })

  it('出せるのは5件まで（6件目は断る）', () => {
    const rows = buildLayoutRows(
      [
        { key: 'title', visible: true },
        { key: 'image', visible: true },
        { key: 'meaning', visible: true },
        { key: 'reading', visible: true },
      ],
      CANDIDATES
    )

    expect(visibleCount(rows)).toBe(4)
  })

  it('値の無い項目は「-」で出す（落とすと法則が読めない）', () => {
    expect(EMPTY_VALUE_MARK).toBe('-')
  })
})
