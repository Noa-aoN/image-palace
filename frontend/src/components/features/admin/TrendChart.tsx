'use client'

import type { AdminSeriesPoint } from '@/types/admin'

/**
 * 日ごとの推移を折れ線で見せる。
 *
 * 外部の作図ライブラリは入れない。線1本を描くのに数百KB を配るのは割に合わないし、
 * 配信元を増やすと CSP も緩めることになる。SVG を素で書けば足りる。
 */
export function TrendChart({
  points,
  label,
  color = 'var(--palace)',
}: {
  points: AdminSeriesPoint[]
  label: string
  color?: string
}) {
  const width = 600
  const height = 120
  const max = Math.max(1, ...points.map((p) => p.count))
  const total = points.reduce((sum, p) => sum + p.count, 0)

  // 点が1つしか無いと 0 除算になるので、その場合は左端に置く
  const step = points.length > 1 ? width / (points.length - 1) : 0
  const coords = points.map((p, i) => ({
    x: i * step,
    y: height - (p.count / max) * height,
  }))
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const area = coords.length ? `${line} L${width},${height} L0,${height} Z` : ''

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{label}</h3>
        <p className="text-xs text-muted-foreground">
          直近{points.length}日で {total.toLocaleString()}（最大 {max.toLocaleString()}/日）
        </p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-28 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}の推移`}
      >
        {area && <path d={area} fill={color} opacity={0.12} />}
        {line && <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  )
}
