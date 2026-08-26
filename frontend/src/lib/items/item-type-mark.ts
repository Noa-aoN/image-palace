import type { ItemType } from '@/types/item'

/**
 * 種別の印。**札の見出しの右に、一文字だけ出す。**
 *
 * トレーディングカードの属性表示と同じ考え方。
 * 一覧を眺めているとき、そのカードが「単語」なのか「人物」なのか「出来事」なのかは、
 * **絵と見出しだけでは分からない**ことがある（「アポロ」は人物にも計画にもなる）。
 *
 * 名前を full で出すと見出しの場所を食うので、一文字と色で表す。
 * **色だけに頼らない**（一文字が読めれば、色が見分けられなくても分かる）。
 */

/** 印の見た目。**色は既にある札の色と揃える**（新しい色を増やさない） */
const MARKS: Record<string, { char: string; color: string }> = {
  term: { char: '単', color: 'var(--palace)' },
  concept: { char: '概', color: '#9a6dd7' },
  entity: { char: '実', color: '#4a7fb5' },
  person: { char: '人', color: '#c96b96' },
  place: { char: '場', color: '#5b8c5a' },
  event: { char: '出', color: '#c05a4e' },
  organization: { char: '組', color: '#6b7280' },
  work: { char: '作', color: '#d08a3e' },
  record: { char: '記', color: 'var(--gold-ink)' },
  task: { char: 'タ', color: '#3f8a80' },
}

/**
 * 種別から印を引く。
 *
 * **知らない種別でも印を出す。** 種別は増えうるので、対応表に無いものは
 * 呼び名の一文字目を借りる（出ないより、何かが出ているほうが読める）。
 * 色だけは決め打ちにせず、既定の金に倒す。
 *
 * 種別が付いていなければ null（印を出さない）。
 */
export function itemTypeMark(type?: ItemType | null): { char: string; color: string; label: string } | null {
  if (!type) return null

  const known = MARKS[type.name]
  if (known) return { ...known, label: type.label }

  const fallback = (type.label ?? type.name ?? '').trim().charAt(0)
  if (!fallback) return null

  return { char: fallback, color: 'var(--palace)', label: type.label ?? type.name }
}
