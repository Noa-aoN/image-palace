import { itemTypeMark } from '@/lib/items/item-type-mark'
import type { ItemType } from '@/types/item'

/**
 * 種別の印。**見出しの右に、一文字だけ。**
 *
 * トレーディングカードの属性表示と同じ考え方で、一覧を眺めているときに
 * 「これは人物か、出来事か」が絵と見出しだけでは分からない場面を埋める
 * （「アポロ」は人物にも計画にもなる）。
 *
 * **色だけに頼らない。** 一文字が読めれば、色を見分けられなくても分かる。
 * 呼び名は `title` で読める（印だけでは初めての人に伝わらない）。
 *
 * ここは**札の部品**として作ってある。カードの見た目をまとめて作り直すときに、
 * そのまま新しい札へ載せ替えられる。
 */
export function ItemTypeMark({ type, className = '' }: { type?: ItemType | null; className?: string }) {
  const mark = itemTypeMark(type)
  if (!mark) return null

  return (
    <span
      title={mark.label}
      aria-label={`種別: ${mark.label}`}
      className={`inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] text-3xs font-bold leading-none ${className}`}
      style={{
        color: mark.color,
        // 地は色を薄く敷くだけ。塗り潰すと、見出しより印のほうが目立つ
        backgroundColor: `color-mix(in srgb, ${mark.color} 14%, transparent)`,
      }}
    >
      {mark.char}
    </span>
  )
}
