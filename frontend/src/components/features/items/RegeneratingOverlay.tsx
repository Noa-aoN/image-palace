import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  /** 小さいカードでは文言を出さず、回転だけにする */
  compact?: boolean
  className?: string
}

/**
 * 作り直し中の画像に重ねる幕。
 *
 * 前の画像を消さずに作り直すので、そのままだと完成した画像が出たままで
 * 「押したのに何も起きていない」ように見える。前の画像は残しつつ（何を作り直しているか
 * 分かるように）、色を落として回転を重ね、いま入れ替わろうとしていることを示す。
 *
 * 画像側の色落としは呼び出し側で当てる（`REGENERATING_IMAGE_CLASS`）。
 * 幕そのものを濃くして隠すのではなく画像を灰色にするのは、
 * 幕だけだと元画像の色が透けて「ただ暗いだけ」に見えるため。
 */
export function RegeneratingOverlay({ compact = false, className }: Props) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/40',
        className
      )}
      role="status"
      aria-label="画像を作り直しています"
    >
      <Loader2
        size={compact ? 20 : 28}
        strokeWidth={2}
        className="animate-spin text-foreground/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
      />
      {!compact && (
        <span className="text-sm font-medium text-foreground/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
          作り直しています
        </span>
      )}
    </div>
  )
}

/** 作り直し中の画像に当てる見た目。色を落として、これから差し替わることを示す */
export const REGENERATING_IMAGE_CLASS = 'grayscale opacity-60 transition-[filter,opacity]'
