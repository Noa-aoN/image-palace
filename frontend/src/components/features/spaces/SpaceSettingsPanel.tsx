'use client'

import { FileText } from 'lucide-react'
import { InfoPopover } from '@/components/features/shared/InfoPopover'
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
function Field({
  label,
  value,
  action,
  children,
}: {
  label: string
  value?: string
  /** 行ごとの操作（軸ごとのリセットなど） */
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-2xs text-muted-foreground">
        <span>{label}</span>
        <span className="flex items-baseline gap-2">
          {action}
          {value && <span className="tabular-nums">{value}</span>}
        </span>
      </div>
      {children}
    </div>
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

/**
 * 「効く範囲」で設定を2つに分けている。
 *
 *   全体設定 … この部屋のポイント全部に効く（表示サイズなど）
 *   個別設定 … いま選んでいるポイント1つだけに効く（向きなど）
 *
 * 同じパネルに混ぜていた頃は、スライダーを動かしたときに
 * 全部が変わるのか1つだけ変わるのかが分からなかった。
 * 説明文もこの2つの言い方で揃えている。
 */
const SCOPE_ALL = 'この部屋のポイント全部に効きます。'
const SCOPE_ONE = 'いま選んでいるポイント1つだけに効きます。'

/**
 * この記憶資産の絵が、どんな指示から作られたかを見せる。
 *
 * 点は名前をそのまま画像の指示に使う。思った絵にならないとき、
 * 名前の付け方が効いていることが分かるようにしておく。
 * カード詳細の「プロンプト情報」と同じ形にして、置き場所が違っても迷わないようにする。
 */
function PointPromptInfo({ point }: { point: SpacePoint }) {
  const prompt = point.prompt ?? point.name
  if (!prompt) return null

  return (
    <InfoPopover label="プロンプト情報" icon={<FileText size={14} />} width="w-72">
      <div>
        <p className="mb-0.5 text-xs font-medium text-muted-foreground">画像への指示</p>
        <p className="whitespace-pre-wrap font-mono text-2xs leading-relaxed">{prompt}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        記憶資産は、点の名前をそのまま画像の指示に使います。名前を変えて作り直すと絵が変わります。
      </p>
      {point.revised_prompt && (
        <div className="border-t border-border/60 pt-2">
          <p className="text-xs text-muted-foreground">revised_prompt（生成時にAIが補正した指示）</p>
          <p className="mt-0.5 max-h-28 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed">
            {point.revised_prompt}
          </p>
        </div>
      )}
    </InfoPopover>
  )
}

/** ポイントの全体設定（この部屋のポイント全部に効く） */
export function PointCommonSettingsPanel({
  space,
  autoScale,
  onAutoScaleChange,
  onSpaceSetting,
}: {
  space: SpaceDetail
  autoScale: boolean
  onAutoScaleChange: (value: boolean) => void
  onSpaceSetting: (patch: Partial<SpaceDetail>) => void
}) {
  return (
    <div className="space-y-5 p-4">
      <p className="text-2xs text-muted-foreground">{SCOPE_ALL}</p>

      <Section title="表示">
        <Field label="表示サイズ" value={`×${space.point_scale.toFixed(1)}`}>
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
        <label className="flex items-center justify-between gap-2 text-2xs text-muted-foreground">
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
    </div>
  )
}

/** ポイントの個別設定（いま選んでいる1つだけに効く） */
export function PointDetailSettingsPanel({
  selectedPoint,
  onRotate,
  onRotateCommit,
}: {
  selectedPoint: SpacePoint | null
  onRotate: (pointId: string, axis: 'x' | 'y' | 'z', deg: number) => void
  onRotateCommit: (pointId: string, patch: Record<string, number>) => void
}) {
  if (!selectedPoint) {
    return (
      <div className="space-y-2 p-4">
        <p className="text-2xs text-muted-foreground">{SCOPE_ONE}</p>
        <p className="text-2xs text-muted-foreground">
          2D / 3D のポイントをクリックして選ぶと、ここで調整できます。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4">
      {/* どのポイントを触っているかを最初に出す。ここが分からないと、
          スライダーが何に効いているのか分からない */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{selectedPoint.name || '未命名'}</span>
          <PointPromptInfo point={selectedPoint} />
        </div>
        <p className="text-2xs text-muted-foreground">{SCOPE_ONE}</p>
      </div>

      <Section title="向き">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              ROTATION_AXES.forEach(({ axis }) => onRotate(selectedPoint.id, axis, 0))
              onRotateCommit(selectedPoint.id, { rotation_x: 0, rotation_y: 0, rotation_z: 0 })
            }}
            className="shrink-0 text-2xs text-muted-foreground underline hover:text-foreground"
          >
            すべて戻す
          </button>
        </div>
        {ROTATION_AXES.map(({ axis, label }) => {
            const value =
              axis === 'x'
                ? selectedPoint.rotation_x
                : axis === 'y'
                  ? selectedPoint.rotation_y
                  : selectedPoint.rotation_z
            const changed = Math.round(value ?? 0) !== 0
            return (
              <Field
                key={axis}
                label={label}
                value={`${Math.round(value ?? 0)}°`}
                action={
                  changed ? (
                    <button
                      type="button"
                      onClick={() => {
                        onRotate(selectedPoint.id, axis, 0)
                        onRotateCommit(selectedPoint.id, { [`rotation_${axis}`]: 0 })
                      }}
                      className="underline hover:text-foreground"
                      aria-label={`${label}をリセット`}
                    >
                      リセット
                    </button>
                  ) : undefined
                }
              >
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
        <p className="text-2xs text-muted-foreground">2D では、傾きを遠近で近似して表示します。</p>
      </Section>
    </div>
  )
}
