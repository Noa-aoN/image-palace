'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ViewEdgeStyle, EdgeMarker, EdgeLineStyle, EdgeCurve } from '@/types/view'
import { resolveLineStyle, DEFAULT_CURVE_RADIUS } from '@/lib/edge-path'

const MARKERS: { label: string; value: EdgeMarker }[] = [
  { label: 'なし', value: 'none' },
  { label: '矢印', value: 'arrow' },
]

type SwatchOption = { label: string; value: string; swatch?: string; none?: boolean }

// 線の色（既定＝黒）
const COLORS: SwatchOption[] = [
  { label: '既定（黒）', value: '', swatch: '#1a1a1a' },
  { label: '赤', value: '#e5484d' },
  { label: '青', value: '#3b82f6' },
  { label: '緑', value: '#22a06b' },
  { label: '灰', value: '#8b8b8b' },
]
// ラベル文字色（既定＝黒。白も選べる）
const LABEL_TEXT_COLORS: SwatchOption[] = [
  { label: '既定（黒）', value: '', swatch: '#111111' },
  { label: '白', value: '#ffffff' },
  { label: '赤', value: '#e5484d' },
  { label: '青', value: '#3b82f6' },
  { label: '緑', value: '#22a06b' },
  { label: '灰', value: '#8b8b8b' },
]
// ラベル背景（なし＝透明。蛍光マーカー系の淡色）
const LABEL_BGS: SwatchOption[] = [
  { label: 'なし', value: '', none: true },
  { label: '白', value: '#ffffff' },
  { label: '黒', value: '#111111' },
  { label: '黄', value: '#fde68a' },
  { label: '赤', value: '#e5484d' },
  { label: '青', value: '#3b82f6' },
  { label: '緑', value: '#22a06b' },
]

// 選択式の丸スウォッチ列
function Swatches({
  options,
  active,
  onSelect,
}: {
  options: SwatchOption[]
  active: string
  onSelect: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value || 'default'}
          type="button"
          onClick={() => onSelect(o.value)}
          aria-label={o.label}
          className={cn(
            'relative h-7 w-7 overflow-hidden rounded-full border-2 transition-colors',
            active === o.value ? 'border-foreground' : 'border-border'
          )}
          style={{ backgroundColor: o.none ? '#ffffff' : o.swatch ?? o.value ?? 'var(--muted)' }}
        >
          {o.none && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top right, transparent calc(50% - 1px), #e5484d calc(50% - 1px), #e5484d calc(50% + 1px), transparent calc(50% + 1px))',
              }}
            />
          )}
        </button>
      ))}
    </div>
  )
}

// 数値入力（px / % など単位付き）— カード幅入力などにも流用するため export する
export function NumberField({
  label,
  value,
  min,
  max,
  unit = 'px',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  unit?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, Math.round(n))))
          }}
          aria-label={label}
          className="w-20 rounded-lg border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  )
}

// 選択式のセグメントボタン列
function Segmented<T extends string | number>({
  options,
  active,
  onSelect,
}: {
  options: { label: string; value: T }[]
  active: T | undefined
  onSelect: (v: T) => void
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <Button key={String(o.value)} variant={active === o.value ? 'default' : 'outline'} size="sm" onClick={() => onSelect(o.value)}>
          {o.label}
        </Button>
      ))}
    </div>
  )
}

// 接続線スタイル（ラベル書式・線）の共通コントロール。
// 単一編集（value=現在のスタイル）と一括編集（value 省略＝active 非表示）の両方で使う。
// labelSlot にラベル文字入力（単一編集時のみ）を差し込める。
export function EdgeStyleControls({
  value,
  onChange,
  labelSlot,
}: {
  value?: ViewEdgeStyle
  onChange: (partial: Partial<ViewEdgeStyle>) => void
  labelSlot?: ReactNode
}) {
  const s = value ?? {}
  return (
    <>
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground">ラベル</h3>
        {labelSlot}
        <NumberField label="文字サイズ" value={s.label_size ?? 13} min={8} max={48} onChange={(v) => onChange({ label_size: v })} />
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">文字色</span>
          <Swatches options={LABEL_TEXT_COLORS} active={s.label_color ?? ''} onSelect={(v) => onChange({ label_color: v || undefined })} />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">背景色</span>
          <Swatches options={LABEL_BGS} active={s.label_bg ?? ''} onSelect={(v) => onChange({ label_bg: v || undefined })} />
        </div>
        <NumberField label="不透明度" value={s.label_opacity ?? 100} min={0} max={100} unit="%" onChange={(v) => onChange({ label_opacity: v })} />
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">向き</span>
          <Segmented
            options={[
              { label: '横書き', value: 'h' },
              { label: '縦書き', value: 'v' },
            ]}
            active={s.label_vertical ? 'v' : 'h'}
            onSelect={(v) => onChange({ label_vertical: v === 'v' })}
          />
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-4">
        <h3 className="text-xs font-semibold text-muted-foreground">線</h3>
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">色</span>
          <Swatches options={COLORS} active={s.color ?? ''} onSelect={(v) => onChange({ color: v || undefined })} />
        </div>
        <NumberField label="太さ" value={s.width ?? 2} min={1} max={12} onChange={(v) => onChange({ width: v })} />
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">線種</span>
          <Segmented
            options={[
              { label: '実線', value: 'solid' },
              { label: '破線', value: 'dashed' },
              { label: '点線', value: 'dotted' },
              { label: '二重', value: 'double' },
            ]}
            active={resolveLineStyle(s)}
            // 旧データは dashed（真偽値）で持っている。両方を書いて、
            // 古い画面で開いても線種が消えないようにする
            onSelect={(v) => onChange({ line_style: v as EdgeLineStyle, dashed: v === 'dashed' })}
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">折れ点のつなぎ方</span>
          <Segmented
            options={[
              { label: '角ばる', value: 'sharp' },
              { label: '角を丸める', value: 'round' },
              { label: 'なめらか', value: 'smooth' },
            ]}
            active={s.curve ?? 'sharp'}
            onSelect={(v) => onChange({ curve: v as EdgeCurve })}
          />
          <p className="text-[11px] leading-snug text-muted-foreground">
            線を掴んで折れ点を足すと効きます（折れ点が無い線は自動でつながります）。
          </p>
        </div>
        {(s.curve ?? 'sharp') === 'round' && (
          <NumberField
            label="角の丸み"
            value={s.curve_radius ?? DEFAULT_CURVE_RADIUS}
            min={2}
            max={80}
            unit="px"
            onChange={(v) => onChange({ curve_radius: v })}
          />
        )}
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">始端</span>
          <Segmented options={MARKERS} active={s.marker_start ?? 'none'} onSelect={(v) => onChange({ marker_start: v })} />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">終端</span>
          <Segmented options={MARKERS} active={s.marker_end ?? 'arrow'} onSelect={(v) => onChange({ marker_end: v })} />
        </div>
        <NumberField label="不透明度" value={s.opacity ?? 100} min={0} max={100} unit="%" onChange={(v) => onChange({ opacity: v })} />
      </section>
    </>
  )
}
