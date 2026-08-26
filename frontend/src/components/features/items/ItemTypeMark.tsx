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
      // **大きさは見出し語に合わせる。**
      //
      // px で決め打ちしていたころは 16px 固定で、見出しが大きい場所
      // （詳細・大きい札）に置くと印だけが取り残された。
      // `em` で持てば、置いた先の字の大きさにそのまま従う。
      //
      // 1.35em … 見出しの文字より少し高い。並べたときに字と同じ「行のもの」に見える高さ
      className={`inline-flex shrink-0 items-center justify-center rounded-[3px] font-bold leading-none ${className}`}
      style={{
        width: '1.35em',
        height: '1.35em',
        color: mark.color,
        // 地は色を薄く敷くだけ。塗り潰すと、見出しより印のほうが目立つ
        backgroundColor: `color-mix(in srgb, ${mark.color} 14%, transparent)`,
      }}
    >
      {/* 字は枠より一回り小さく。枠いっぱいだと窮屈で、一文字が読み取れない */}
      <span style={{ fontSize: '0.8em' }}>{mark.char}</span>
    </span>
  )
}
