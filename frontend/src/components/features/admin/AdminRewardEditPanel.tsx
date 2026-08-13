'use client'

import { useState } from 'react'
import { deleteAdminRewardImage, generateAdminRewardImage } from '@/lib/api/admin'
import { ImageLightbox, ZoomableImage } from '@/components/ui/image-lightbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { MISSION_CADENCE_LABELS, MISSION_CADENCE_ORDER } from '@/lib/admin-rewards-grouping'
import type {
  AdminAchievementDefinition,
  AdminMissionDefinition,
  AdminMissionSeries,
  AdminRewardDefinition,
} from '@/lib/api/admin'

export const REWARD_EDIT_PANEL_KEY = 'admin-reward-edit'

/** いま何を編集しているか。3つは項目が違うので、器は同じでも中身を分ける */
export type EditTarget =
  | { type: 'reward'; row: AdminRewardDefinition }
  | { type: 'achievement'; row: AdminAchievementDefinition }
  | { type: 'mission'; row: AdminMissionDefinition }

/**
 * 獲得物・実績・ミッションの編集。
 *
 * **一覧は見る場所、ここは直す場所**として分ける。表の中で直接編集していたころは、
 * 行の中に入力欄と釦が並び、どこまでが1件なのか目で追いにくかった。
 * 種別ごとに項目が違うのに、列を揃えるために無理をしていたのもここが理由。
 *
 * 変えられるのは、いまサーバーが受け付ける項目だけ。画面に出しても
 * 保存されない欄があると、直したつもりで直っていない事故になる。
 *
 * 別の行を選び直したときは、`key` に id を渡して**作り直す**。
 * 効果で入れ直すと、書きかけの中身が一瞬だけ前の行のまま見える。
 */
export function AdminRewardEditPanel({
  target,
  series,
  busy,
  onSaveReward,
  onSaveAchievement,
  onSaveMission,
  onRewardImageChanged,
}: {
  target: EditTarget | null
  series: AdminMissionSeries[]
  busy: boolean
  onSaveReward: (id: string, patch: Record<string, unknown>) => Promise<void>
  /** 絵を作り直したときに、一覧へ反映する */
  onRewardImageChanged: (reward: AdminRewardDefinition) => void
  onSaveAchievement: (id: string, patch: Record<string, unknown>) => Promise<void>
  onSaveMission: (id: string, patch: Record<string, unknown>) => Promise<void>
}) {
  return (
    <PanelSlotContent sectionKey={REWARD_EDIT_PANEL_KEY}>
      {target === null ? (
        <p className="text-sm text-muted-foreground">選んでください。</p>
      ) : target.type === 'reward' ? (
        <RewardForm key={target.row.id} row={target.row} busy={busy} onSave={onSaveReward} onImageChanged={onRewardImageChanged} />
      ) : target.type === 'achievement' ? (
        <AchievementForm key={target.row.id} row={target.row} busy={busy} onSave={onSaveAchievement} />
      ) : (
        <MissionForm key={target.row.id} row={target.row} series={series} busy={busy} onSave={onSaveMission} />
      )}
    </PanelSlotContent>
  )
}

/** 識別名と組み込みかどうか。どちらも直せないが、どれを触っているかの手がかりになる */
function Head({ label, builtin }: { label: string; builtin: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <code className="rounded bg-muted px-1.5 py-0.5">{label}</code>
      {builtin && <span>組み込み（消せません）</span>}
    </p>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
  hint?: string
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  )
}

const TEXTAREA =
  'w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const SELECT =
  'h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function SaveRow({ busy, dirty, onSave }: { busy: boolean; dirty: boolean; onSave: () => void }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Button size="sm" onClick={onSave} disabled={busy || !dirty} className="flex items-center gap-1.5">
        {busy && <Spinner size={13} />}
        保存する
      </Button>
      {dirty && !busy && <span className="text-xs text-muted-foreground">未保存の変更があります</span>}
    </div>
  )
}

function RewardForm({
  row,
  busy,
  onSave,
  onImageChanged,
}: {
  row: AdminRewardDefinition
  busy: boolean
  onSave: (id: string, patch: Record<string, unknown>) => Promise<void>
  /** 絵を作り直したら、一覧の側にも反映する（開いたままでも古い絵が残らない） */
  onImageChanged: (reward: AdminRewardDefinition) => void
}) {
  const [name, setName] = useState(row.name)
  const [description, setDescription] = useState(row.description ?? '')
  const [published, setPublished] = useState(row.published)
  const [imageKey, setImageKey] = useState(row.image_path ?? '')
  const [zoomed, setZoomed] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)

  const generateImage = async () => {
    setImageBusy(true)
    setImageError(null)
    try {
      onImageChanged((await generateAdminRewardImage(row.id)).reward)
    } catch (e) {
      const detail = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors
      setImageError(detail?.[0] ?? '絵を作れませんでした')
    } finally {
      setImageBusy(false)
    }
  }

  const removeImage = async () => {
    setImageBusy(true)
    setImageError(null)
    try {
      onImageChanged((await deleteAdminRewardImage(row.id)).reward)
    } catch {
      setImageError('外せませんでした')
    } finally {
      setImageBusy(false)
    }
  }


  const dirty =
    name !== row.name ||
    description !== (row.description ?? '') ||
    published !== row.published ||
    imageKey !== (row.image_path ?? '')

  return (
    <div className="space-y-3">
      <Head label={row.key} builtin={row.builtin} />

      <Field label="名前">
        <Input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
      </Field>

      <Field label="説明">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} rows={3} className={TEXTAREA} />
      </Field>

      {/* 絵。作る・確かめる・外す。作り直しは「作る」を押し直せばよい
          （同じ獲得物の絵は1つしか持たない） */}
      <Field label="絵" hint="AI に描かせます。押すと少し待ちます">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {row.image_url ? (
              <ZoomableImage url={row.image_url} alt={`${row.name}の絵`} onOpen={() => setZoomed(true)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- CDN 配信。最適化は経由させない */}
                <img
                  src={row.image_url}
                  alt=""
                  className="size-16 rounded-lg border border-border bg-muted object-contain"
                />
              </ZoomableImage>
            ) : (
              <div className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border text-[11px] text-muted-foreground">
                なし
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={busy || imageBusy} onClick={generateImage}>
                {imageBusy ? '作っています…' : row.image_url ? '作り直す' : '絵を作る'}
              </Button>
              {row.image_url && (
                <Button variant="ghost" size="sm" disabled={busy || imageBusy} onClick={removeImage}>
                  外す
                </Button>
              )}
            </div>
          </div>

          {imageError && <p className="text-xs text-destructive">{imageError}</p>}

          <ImageLightbox
            url={row.image_url}
            alt={`${row.name}の絵`}
            open={zoomed}
            onClose={() => setZoomed(false)}
          />
        </div>
      </Field>

      {/* 鍵は既に置いてある絵を指すための逃げ道。ふだんは触らない */}
      <Field label="画像の名前（上級）" hint="R2 に置いた絵を直に指すとき用">
        <Input value={imageKey} onChange={(e) => setImageKey(e.target.value)} disabled={busy} placeholder="例: o18zg7f5u2w1m2ga…" />
      </Field>

      <Toggle label="公開する" checked={published} onChange={setPublished} hint="外すと、まだ持っていない人には出なくなります" />

      <SaveRow
        busy={busy}
        dirty={dirty}
        onSave={() =>
          onSave(row.id, {
            name,
            description: description.trim() || null,
            published,
            image_key: imageKey.trim() || null,
          })
        }
      />

      <p className="text-xs text-muted-foreground">
        いま {row.owned_count} 人が持っています
        {row.granted_total > row.owned_count && `（配った総数 ${row.granted_total} 個）`}。
        {row.stackable && ' この種別は同じものを複数持てます。'}
      </p>
    </div>
  )
}

function AchievementForm({
  row,
  busy,
  onSave,
}: {
  row: AdminAchievementDefinition
  busy: boolean
  onSave: (id: string, patch: Record<string, unknown>) => Promise<void>
}) {
  const [name, setName] = useState(row.name)
  const [description, setDescription] = useState(row.description ?? '')
  const [target, setTarget] = useState(String(row.condition_target))
  const [position, setPosition] = useState(String(row.position))
  const [enabled, setEnabled] = useState(row.enabled)
  const [published, setPublished] = useState(row.published)


  const validNumbers = /^\d+$/.test(target) && Number(target) >= 1 && /^-?\d+$/.test(position)
  const dirty =
    name !== row.name ||
    description !== (row.description ?? '') ||
    target !== String(row.condition_target) ||
    position !== String(row.position) ||
    enabled !== row.enabled ||
    published !== row.published

  return (
    <div className="space-y-3">
      <Head label={row.key} builtin={row.builtin} />

      <Field label="名前">
        <Input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
      </Field>

      <Field label="説明">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} rows={3} className={TEXTAREA} />
      </Field>

      {/* 条件の種類そのものは登録簿が持つ。数えられない条件を画面から作れてしまわないように */}
      <Field label="条件" hint={`数え方は「${row.condition_type}」で固定。ここで変えられるのは目標の数だけです`}>
        <Input value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy} inputMode="numeric" />
      </Field>

      <Field label="並び順" hint="小さいほど先に出ます">
        <Input value={position} onChange={(e) => setPosition(e.target.value)} disabled={busy} inputMode="numeric" />
      </Field>

      <Toggle label="有効にする" checked={enabled} onChange={setEnabled} hint="外すと、新しく達成されなくなります" />
      <Toggle label="公開する" checked={published} onChange={setPublished} />

      <SaveRow
        busy={busy}
        dirty={dirty && validNumbers}
        onSave={() =>
          onSave(row.id, {
            name,
            description: description.trim() || null,
            condition_target: Number(target),
            position: Number(position),
            enabled,
            published,
          })
        }
      />

      <p className="text-xs text-muted-foreground">いま {row.completed_count} 人が達成しています。</p>
    </div>
  )
}

function MissionForm({
  row,
  series,
  busy,
  onSave,
}: {
  row: AdminMissionDefinition
  series: AdminMissionSeries[]
  busy: boolean
  onSave: (id: string, patch: Record<string, unknown>) => Promise<void>
}) {
  const [name, setName] = useState(row.name)
  const [description, setDescription] = useState(row.description ?? '')
  const [cadence, setCadence] = useState(row.cadence)
  const [target, setTarget] = useState(String(row.condition_target))
  const [position, setPosition] = useState(String(row.position))
  const [seriesId, setSeriesId] = useState(row.mission_series_id ?? '')
  const [step, setStep] = useState(String(row.series_step))
  const [enabled, setEnabled] = useState(row.enabled)
  const [published, setPublished] = useState(row.published)


  const validNumbers =
    /^\d+$/.test(target) && Number(target) >= 1 && /^-?\d+$/.test(position) && /^\d+$/.test(step)
  const dirty =
    name !== row.name ||
    description !== (row.description ?? '') ||
    cadence !== row.cadence ||
    target !== String(row.condition_target) ||
    position !== String(row.position) ||
    seriesId !== (row.mission_series_id ?? '') ||
    step !== String(row.series_step) ||
    enabled !== row.enabled ||
    published !== row.published

  return (
    <div className="space-y-3">
      <Head label={row.key} builtin={row.builtin} />

      <Field label="名前">
        <Input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
      </Field>

      <Field label="説明">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} rows={3} className={TEXTAREA} />
      </Field>

      <Field label="繰り返し">
        <select value={cadence} onChange={(e) => setCadence(e.target.value)} disabled={busy} className={SELECT}>
          {MISSION_CADENCE_ORDER.map((value) => (
            <option key={value} value={value}>
              {MISSION_CADENCE_LABELS[value]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="条件" hint={`数え方は「${row.condition_type}」で固定。ここで変えられるのは目標の数だけです`}>
        <Input value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy} inputMode="numeric" />
      </Field>

      {/* 段は前の段が済むまで開かない。シリーズを外すと単発のミッションになる */}
      <Field label="シリーズ" hint="続きもののときだけ。外すと単発になります">
        <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)} disabled={busy} className={SELECT}>
          <option value="">（単発）</option>
          {series.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      {seriesId && (
        <Field label="段" hint="小さいほど先。前の段が済むまで開きません">
          <Input value={step} onChange={(e) => setStep(e.target.value)} disabled={busy} inputMode="numeric" />
        </Field>
      )}

      <Field label="並び順" hint="小さいほど先に出ます">
        <Input value={position} onChange={(e) => setPosition(e.target.value)} disabled={busy} inputMode="numeric" />
      </Field>

      <Toggle label="有効にする" checked={enabled} onChange={setEnabled} />
      <Toggle label="公開する" checked={published} onChange={setPublished} />

      <SaveRow
        busy={busy}
        dirty={dirty && validNumbers}
        onSave={() =>
          onSave(row.id, {
            name,
            description: description.trim() || null,
            cadence,
            condition_target: Number(target),
            position: Number(position),
            mission_series_id: seriesId || null,
            series_step: Number(step),
            enabled,
            published,
          })
        }
      />
    </div>
  )
}
