import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type SpinnerProps = {
  /** アイコンサイズ（px）。既定はボタン内テキストに馴染む 14 */
  size?: number
  className?: string
  /** スクリーンリーダー向けラベル。装飾用途では省略可 */
  label?: string
}

/**
 * 処理中を示す回転スピナー。ボタンや一覧の読み込み表示で共通利用する。
 */
export function Spinner({ size = 14, className, label }: SpinnerProps) {
  return (
    <Loader2
      size={size}
      className={cn('animate-spin', className)}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}
