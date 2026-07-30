'use client'

import type { SpaceDetail, SpacePoint } from '@/types/space'
import { RoomStyleSettings } from '@/components/features/views/RoomStyleSettings'

// 部屋の寸法（グリッド単位＝整数。1マス=1m の床グリッドと一致）
const ROOM_DIMS: { key: 'width' | 'depth' | 'height'; label: string; min: number; max: number }[] = [
  { key: 'width', label: '幅', min: 2, max: 10 },
  { key: 'depth', label: '奥行き', min: 2, max: 10 },
  { key: 'height', label: '高さ', min: 2, max: 6 },
]

const ROTATION_AXES = [
  { axis: 'x', label: '縦の傾き' },
  { axis: 'y', label: '横の傾き' },
  { axis: 'z', label: '面内の回転' },
] as const

/**
 * パネルは幅 300〜560px と狭いので、ラベルは行の上に置き、操作は横幅いっぱいに使う。
 * 値は右肩に小さく出す（横並びにすると狭い幅で潰れるため）。
 */
function Field({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{label}</span>
        {value && <span className="tabular-nums">{value}</span>}
      </span>
      {children}
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-xs font-semibold">{title}</h3>
      {children}
    </section>
  )
}

/** 部屋の設定（サイズ・スタイル） */
export function RoomSettingsPanel({
  space,
  onSpaceSetting,
}: {
  space: SpaceDetail
  onSpaceSetting: (patch: Partial<SpaceDetail>) => void
}) {
  return (
    <div className="space-y-5 p-4">
      <Section title="サイズ">
        {ROOM_DIMS.map((d) => {
          const val = Math.round(space[d.key])
          const setDim = (raw: number) => {
            if (Number.isNaN(raw)) return
            onSpaceSetting({ [d.key]: Math.round(Math.min(d.max, Math.max(d.min, raw))) })
          }
          return (
            <Field key={d.key} label={d.label} value={`${val} マス`}>
              <input
                type="range"
                min={d.min}
                max={d.max}
                step={1}
                value={val}
                onChange={(e) => setDim(Number(e.target.value))}
                className="w-full accent-[var(--palace)]"
                aria-label={`部屋の${d.label}`}
              />
            </Field>
          )
        })}
      </Section>

      <Section title="スタイル">
        <RoomStyleSettings roomStyle={space.room_style} overrides={space.style_overrides} onChange={onSpaceSetting} />
      </Section>
    </div>
  )
}

/** ポイントの設定（表示サイズ・選んだ点の向き） */
export function PointSettingsPanel({
  space,
  selectedPoint,
  autoScale,
  onAutoScaleChange,
  onSpaceSetting,
  onRotate,
  onRotateCommit,
}: {
  space: SpaceDetail
  selectedPoint: SpacePoint | null
  autoScale: boolean
  onAutoScaleChange: (value: boolean) => void
  onSpaceSetting: (patch: Partial<SpaceDetail>) => void
  onRotate: (pointId: string, axis: 'x' | 'y' | 'z', deg: number) => void
  onRotateCommit: (pointId: string, patch: Record<string, number>) => void
}) {
  return (
    <div className="space-y-5 p-4">
      <Section title="表示">
        <Field label="表示サイズ（全体）" value={`×${space.point_scale.toFixed(1)}`}>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={space.point_scale}
            onChange={(e) => onSpaceSetting({ point_scale: Number(e.target.value) })}
            className="w-full accent-[var(--palace)]"
            aria-label="ポイント表示サイズ"
          />
        </Field>
        <label className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>部屋サイズに自動追従</span>
          <input
            type="checkbox"
            checked={autoScale}
            onChange={(e) => onAutoScaleChange(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--palace)]"
            aria-label="部屋サイズ自動追従"
          />
        </label>
      </Section>

      <Section title="選んだポイントの向き">
        {selectedPoint ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium">{selectedPoint.name || '未命名'}</span>
              <button
                type="button"
                onClick={() => {
                  ROTATION_AXES.forEach(({ axis }) => onRotate(selectedPoint.id, axis, 0))
                  onRotateCommit(selectedPoint.id, { rotation_x: 0, rotation_y: 0, rotation_z: 0 })
                }}
                className="shrink-0 text-[11px] text-muted-foreground underline hover:text-foreground"
              >
                戻す
              </button>
            </div>
            {ROTATION_AXES.map(({ axis, label }) => {
              const value =
                axis === 'x'
                  ? selectedPoint.rotation_x
                  : axis === 'y'
                    ? selectedPoint.rotation_y
                    : selectedPoint.rotation_z
              return (
                <Field key={axis} label={label} value={`${Math.round(value ?? 0)}°`}>
                  <input
                    type="range"
                    min={-180}
                    max={179}
                    step={1}
                    value={value ?? 0}
                    onChange={(e) => onRotate(selectedPoint.id, axis, Number(e.target.value))}
                    onPointerUp={(e) =>
                      onRotateCommit(selectedPoint.id, {
                        [`rotation_${axis}`]: Number((e.target as HTMLInputElement).value),
                      })
                    }
                    className="w-full accent-[var(--palace)]"
                    aria-label={`${label}（度）`}
                  />
                </Field>
              )
            })}
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            2D / 3D でポイントを選ぶと、向きを調整できます。2D は傾きを遠近で近似表示します。
          </p>
        )}
      </Section>
    </div>
  )
}
