import { cn } from '@/lib/utils'
import { isGenerating, STATUS_ICON } from '@/lib/item-status'
import type { GenerationStatus } from '@/types/item'

type Props = {
  status: GenerationStatus
  /** 枠内に表示する文言（呼び出し側でエラー/ステータスに応じて解決して渡す） */
  label: string
  /** コンテナのサイズ・角丸など（呼び出し側の枠に合わせる） */
  className?: string
  /** 縦横比など、外側の枠の見た目を親から指定する */
  style?: React.CSSProperties
  /** ラベルの文字サイズ・色 */
  textClassName?: string
  /**
   * 補足（失敗の理由など）。指を乗せれば読める形にしておく。
   * 一覧に本文を出すと1枚が縦に伸びるが、理由が分からないままだと
   * 「また押す」以外の手が思いつかない
   */
  title?: string
}

// 画像が未生成の枠に、ステータス文言＋（生成中は）左→右に流れるシマーを重ねる共通オーバーレイ。
// 一覧カード・詳細で共通利用する。挙動は変えず、従来の静的 pulse をシマーへ置き換える演出向上。
/**
 * 絵がまだ無い枠。
 *
 * **ここが状態の置き場所そのもの。** 絵が無いときの枠は空いた面ではなく、
 * 「まだ絵が無い」ことを言うための面。だから印と言葉を**まとめて中央に置く**。
 *
 * 別に小さなバッジを重ねない。同じことを2か所で言うと、
 * 目が2回止まるだけで、分かることは増えない。
 */
export function GeneratingOverlay({ status, label, className, textClassName, style, title }: Props) {
  const Icon = STATUS_ICON[status]

  return (
    <div
      className={cn('relative flex items-center justify-center overflow-hidden bg-muted', className)}
      style={style}
      title={title}
    >
      {isGenerating(status) && <div aria-hidden className="animate-shimmer pointer-events-none absolute inset-0" />}
      <span className={cn('relative z-10 flex flex-col items-center gap-1 px-2 text-center', textClassName)}>
        {Icon && (
          <Icon
            size={20}
            aria-hidden
            className={status === 'processing' ? 'animate-spin' : undefined}
          />
        )}
        {label}
      </span>
    </div>
  )
}
