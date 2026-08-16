'use client'

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScrollCueProps {
  /** スクロール先セクションの id */
  targetId: string
  label?: string
  className?: string
}

// 各セクション下部のスクロール誘導。クリックで次セクションへスムーズスクロール。
//
// 足跡は道の演出（road-intro の足跡）と同じ合図。「進む」ことを絵で言う。
// 読み上げには渡さない（「あしあと」と読まれても意味が伝わらない）ので、
// aria-label は字だけにする。
export function ScrollCue({ targetId, label = '詳細へすすむ', className }: ScrollCueProps) {
  const onClick = () => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <button type="button" onClick={onClick} className={cn('scroll-cue', className)} aria-label={label}>
      <span className="scroll-cue__label">
        <span aria-hidden>👣 </span>
        {label}
      </span>
      <ChevronDown size={15} className="scroll-cue__chevron" aria-hidden />
    </button>
  )
}
