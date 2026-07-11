import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'

/**
 * 「〜を作成」系のアイコンに小さな「＋」バッジを重ね、作成のニュアンスを添える。
 * 既存のアイコン（<Box size={20} /> 等）をそのまま children として包む。
 */
export function CreateIcon({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-flex">
      {children}
      <span
        aria-hidden
        className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full ring-2 ring-[var(--ivory)]"
        style={{ backgroundColor: 'var(--palace)', color: '#fff', width: 11, height: 11 }}
      >
        <Plus size={8} strokeWidth={3.5} />
      </span>
    </span>
  )
}
