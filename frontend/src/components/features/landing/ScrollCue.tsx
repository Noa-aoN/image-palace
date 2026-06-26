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
export function ScrollCue({ targetId, label = '詳細はスクロール', className }: ScrollCueProps) {
  const onClick = () => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <button type="button" onClick={onClick} className={cn('scroll-cue', className)} aria-label={label}>
      <span className="scroll-cue__label">{label}</span>
      <ChevronDown size={18} className="scroll-cue__chevron" aria-hidden />
    </button>
  )
}
