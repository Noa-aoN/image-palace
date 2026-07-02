import { cn } from '@/lib/utils'
import { isGenerating } from '@/lib/item-status'
import type { GenerationStatus } from '@/types/item'

type Props = {
  status: GenerationStatus
  /** 枠内に表示する文言（呼び出し側でエラー/ステータスに応じて解決して渡す） */
  label: string
  /** コンテナのサイズ・角丸など（呼び出し側の枠に合わせる） */
  className?: string
  /** ラベルの文字サイズ・色 */
  textClassName?: string
}

// 画像が未生成の枠に、ステータス文言＋（生成中は）左→右に流れるシマーを重ねる共通オーバーレイ。
// 一覧カード・詳細で共通利用する。挙動は変えず、従来の静的 pulse をシマーへ置き換える演出向上。
export function GeneratingOverlay({ status, label, className, textClassName }: Props) {
  return (
    <div className={cn('relative flex items-center justify-center overflow-hidden bg-muted', className)}>
      {isGenerating(status) && <div aria-hidden className="animate-shimmer pointer-events-none absolute inset-0" />}
      <span className={cn('relative z-10 px-2 text-center', textClassName)}>{label}</span>
    </div>
  )
}
