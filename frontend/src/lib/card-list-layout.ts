/**
 * 一覧のカードに何をどの順で出すか。
 *
 * **表示の有無と並び順を1つの並びで持つ。** 分かれていると並び替えができず、
 * 名前と下の項目の関係も決められなかった（旧: card_headline_key / card_list_fields）。
 *
 * 計算そのものは軽いが、ここが崩れると一覧の見え方が丸ごと変わる。
 * 純粋な関数として切り出して、画面を動かさずに確かめられるようにしてある。
 */

export interface LayoutRow {
  key: string
  visible: boolean
}

export interface LayoutCandidate {
  key: string
  label: string
  /** 組み込み（見出し語・イメージ・意味）か、利用者が作った項目か */
  builtin: boolean
}

/** 出す指定にできる数。**隠した項目は何件あってもよい** */
export const MAX_VISIBLE_FIELDS = 5

/**
 * 保存されている並びと、選べる候補から、画面に並べる行を作る。
 *
 * 保存されている順を先に、そこに無い候補を後ろへ（隠した状態で）足す。
 * 候補が増えても、既に決めた並びが崩れないようにするため。
 */
export function buildLayoutRows(entries: LayoutRow[], candidates: LayoutCandidate[]): LayoutRow[] {
  const known = new Set(candidates.map((c) => c.key))
  // 候補から消えた項目（利用者が項目そのものを消した場合）は並びからも落とす
  const kept = entries.filter((row) => known.has(row.key))
  const seen = new Set(kept.map((row) => row.key))

  return [...kept, ...candidates.filter((c) => !seen.has(c.key)).map((c) => ({ key: c.key, visible: false }))]
}

export function visibleCount(rows: LayoutRow[]): number {
  return rows.filter((row) => row.visible).length
}

/**
 * 表示・非表示を切り替える。
 *
 * **上限に達しているときは、黙って入れ替えない。** 押した項目ではない何かが
 * 消えると、何が起きたのか分からない。断ったことは呼び出し側が伝える。
 */
export function toggleVisible(
  rows: LayoutRow[],
  key: string
): { rows: LayoutRow[]; rejected: boolean } {
  const target = rows.find((row) => row.key === key)
  if (!target) return { rows, rejected: false }

  if (!target.visible && visibleCount(rows) >= MAX_VISIBLE_FIELDS) {
    return { rows, rejected: true }
  }

  return {
    rows: rows.map((row) => (row.key === key ? { ...row, visible: !row.visible } : row)),
    rejected: false,
  }
}

/** 並びの中で1つ動かす。範囲の外へは動かさない */
export function moveRow(rows: LayoutRow[], from: number, to: number): LayoutRow[] {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return rows

  const next = [...rows]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** 値が無い項目の見せ方。**空欄にしない**（設定が効いていないように見えるため） */
export const EMPTY_VALUE_MARK = '-'

export function displayValue(value: string | null | undefined): string {
  return value?.trim() ? value : EMPTY_VALUE_MARK
}
