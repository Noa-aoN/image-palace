'use client'

import { useState } from 'react'

export interface SeriesPoint {
  date: string
  count: number
}

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
  unit = '',
  showDots,
}: {
  points: SeriesPoint[]
  label: string
  color?: string
  /** 合計に添える単位（cr など） */
  unit?: string
  /** 1日ごとに点を打つ。日数が少ないときは区切りが分かりやすくなる */
  showDots?: boolean
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
  // 日数が多いと点が潰れて読めなくなるので、少ないときだけ打つ
  const dots = showDots ?? points.length <= 45

  // ホバーしている日。値は目で読めないので、載せた日だけ数字を出す
  const [hovered, setHovered] = useState<number | null>(null)
  const active = hovered !== null ? points[hovered] : null
  // 端の日は吹き出しが枠から出るので、寄せを切り替える
  const ratio = hovered !== null && points.length > 1 ? hovered / (points.length - 1) : 0
  const align = ratio < 0.15 ? 'left' : ratio > 0.85 ? 'right' : 'center'

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{label}</h3>
        <p className="text-xs text-muted-foreground">
          {points.length}日で {round(total).toLocaleString()}{unit}（最大 {round(max).toLocaleString()}{unit}/日）
        </p>
      </div>
      {/*
        吹き出しは SVG の外に HTML で出す。SVG は preserveAspectRatio="none" で
        横に引き伸ばしているので、中に描くと文字まで歪む。
        位置は「何日目か」の割合で置けば、引き伸ばしの影響を受けない。
      */}
      <div className="relative" onPointerLeave={() => setHovered(null)}>
        {active && (
          <div
            className="pointer-events-none absolute -top-1 z-10 -translate-y-full"
            style={{
              left: `${ratio * 100}%`,
              transform:
                align === 'center'
                  ? 'translate(-50%, -100%)'
                  : align === 'right'
                    ? 'translate(-100%, -100%)'
                    : 'translate(0, -100%)',
            }}
          >
            <span className="whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md">
              {active.date}　{round(active.count).toLocaleString()}
              {unit}
            </span>
          </div>
        )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-28 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}の推移`}
      >
        {area && <path d={area} fill={color} opacity={0.12} />}
        {line && <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />}
        {dots &&
          coords.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={2.5} fill={color} vectorEffect="non-scaling-stroke" />
          ))}
        {/* 載せている日を強調する。どこを読んでいるのか分かるように */}
        {hovered !== null && coords[hovered] && (
          <>
            <line
              x1={coords[hovered].x}
              y1={0}
              x2={coords[hovered].x}
              y2={height}
              stroke={color}
              strokeWidth={1}
              opacity={0.35}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={coords[hovered].x}
              cy={coords[hovered].y}
              r={4}
              fill={color}
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
        {/* 当たり判定は1日1本の透明な帯。点そのものは小さすぎて狙えない */}
        {points.map((p, i) => (
          <rect
            key={`hit-${p.date}-${i}`}
            x={points.length > 1 ? i * step - step / 2 : 0}
            y={0}
            width={points.length > 1 ? step : width}
            height={height}
            fill="transparent"
            onPointerEnter={() => setHovered(i)}
          />
        ))}
      </svg>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  )
}

// 小数が出るもの（クレジット）は 2 桁まで、整数はそのまま見せる
function round(value: number) {
  return Number.isInteger(value) ? value : Math.round(value * 100) / 100
}
