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
  /**
   * 言葉ではなく印だけにする。
   *
   * **同じことを2か所で言わない。** 一覧の札は絵の右上に状態のバッジを出すので、
   * 真ん中にも「失敗」と書くと、1枚の中に同じ言葉が2つ並ぶ。
   *
   * バッジを出していないとき（環境設定で切っている）は、ここが唯一の手がかりに
   * なるので言葉のまま出す。**判断は呼び出し側が持つ**（ここは出し方だけ決める）。
   */
  iconOnly?: boolean
}

// 画像が未生成の枠に、ステータス文言＋（生成中は）左→右に流れるシマーを重ねる共通オーバーレイ。
// 一覧カード・詳細で共通利用する。挙動は変えず、従来の静的 pulse をシマーへ置き換える演出向上。
export function GeneratingOverlay({ status, label, className, textClassName, style, title, iconOnly }: Props) {
  const Icon = STATUS_ICON[status]

  return (
    <div
      className={cn('relative flex items-center justify-center overflow-hidden bg-muted', className)}
      style={style}
      title={title}
    >
      {isGenerating(status) && <div aria-hidden className="animate-shimmer pointer-events-none absolute inset-0" />}
      {iconOnly && Icon ? (
        // 印だけでも、読み上げには言葉を残す（見えない人にとっては印が無いのと同じ）
        <span className={cn('relative z-10', textClassName)} role="img" aria-label={label} title={label}>
          <Icon size={22} className={status === 'processing' ? 'animate-spin' : undefined} />
        </span>
      ) : (
        <span className={cn('relative z-10 px-2 text-center', textClassName)}>{label}</span>
      )}
    </div>
  )
}
