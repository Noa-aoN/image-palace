/**
 * 工房室での複数選び。
 *
 * **1つずつ押していくのは、数が増えると手数が増えるだけ。**
 * カードが84枚あるとき「出さない」を10枚に付けるのに10往復要る。
 *
 * 選んでからまとめて押す。ここは選び方だけを持ち、
 * 何をするかは呼ぶ側が決める（原本なら出す出さない、荷物なら届け先）。
 */
export type Selection = ReadonlySet<string>

export const EMPTY: Selection = new Set<string>()

export function toggle(selection: Selection, id: string): Selection {
  const next = new Set(selection)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/**
 * いま見えているものを、まとめて選ぶ・外す。
 *
 * **見えているものだけ**を対象にする。絞り込んだ結果を「すべて選ぶ」で
 * 選んだつもりが、隠れているものまで入っていたら事故になる。
 */
export function toggleAll(selection: Selection, visibleIds: string[]): Selection {
  const allChosen = visibleIds.length > 0 && visibleIds.every((id) => selection.has(id))
  const next = new Set(selection)

  for (const id of visibleIds) {
    if (allChosen) next.delete(id)
    else next.add(id)
  }
  return next
}

/** 見えているものが全部選ばれているか（「すべて選ぶ」の状態表示に使う） */
export function allChosen(selection: Selection, visibleIds: string[]): boolean {
  return visibleIds.length > 0 && visibleIds.every((id) => selection.has(id))
}

/**
 * 選んだもののうち、いま見えているものだけを残す。
 *
 * **絞り込みを変えたときに呼ぶ。** 見えなくなったものを選んだまま
 * まとめて操作すると、画面に出ていないものが変わる。
 */
export function keepVisible(selection: Selection, visibleIds: string[]): Selection {
  const visible = new Set(visibleIds)
  return new Set([...selection].filter((id) => visible.has(id)))
}

/** まとめて押すときの言い方。**何件に効くのかを必ず出す** */
export function bulkLabel(action: string, count: number): string {
  return `${count} 件を${action}`
}
