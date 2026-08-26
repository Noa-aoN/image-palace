'use client'

import type { DiagramMode } from '@/types/settings'

/**
 * 図の 2D / 3D を切り替える小さなトグル。カードの右上に置く。
 * ここでの選択は端末に記憶され（stores/ui の diagramOverrides）、環境設定の既定を上書きする。
 */
export function DiagramModeToggle({
  mode,
  onChange,
  label,
}: {
  mode: DiagramMode
  onChange: (mode: DiagramMode) => void
  label: string
}) {
  return (
    <div
      role="group"
      aria-label={`${label}の表示（2D / 3D）`}
      className="flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5"
    >
      {(['2d', '3d'] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={mode === value}
          className={`rounded-full px-2 py-0.5 text-2xs font-medium transition-colors ${
            mode === value ? 'text-white' : 'text-muted-foreground hover:text-foreground'
          }`}
          style={mode === value ? { backgroundColor: 'var(--palace)' } : undefined}
        >
          {value.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
