'use client'

import { useEffect, useState } from 'react'
import { Cpu, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { PeriodSelect } from './PeriodSelect'
import {
  getAdminAiModels,
  createAdminAiModel,
  updateAdminAiModel,
  deleteAdminAiModel,
} from '@/lib/api/admin'
import type { AdminAiModel, AdminAiModelsPage } from '@/types/admin'

/**
 * AI モデルの登録簿。
 *
 * これまでモデルの情報は3か所（コードの定数・cost_parameters・課金の定数）に散っていて、
 * 「1枚いくらで、いくら貰っていて、誰に見せているか」を一度に見られなかった。
 * 1行に並べて、粗利が合っているかをその場で確かめられるようにする。
 *
 * **有効と、実際に使えるかは別**。鍵が入っていなければ有効にしても使えないので、
 * 状態の列で分けて出す。ここが分からないと「有効なのに出てこない」と見える。
 */
export function AdminAiModelsPanel() {
  const [page, setPage] = useState<AdminAiModelsPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [period, setPeriod] = useState('30d')

  useEffect(() => {
    getAdminAiModels({ period })
      .then(setPage)
      .catch(() => setError('読み込めませんでした。'))
  }, [period])

  const replace = (updated: AdminAiModel) =>
    setPage((p) => (p ? { ...p, models: p.models.map((m) => (m.id === updated.id ? updated : m)) } : p))

  const patch = async (model: AdminAiModel, changes: Partial<AdminAiModel>) => {
    setBusy(model.id)
    setError(null)
    try {
      replace(await updateAdminAiModel(model.id, changes))
      // 既定は1つだけなので、他の行の印を落とす
      if (changes.default_for_kind) {
        setPage((p) =>
          p
            ? {
                ...p,
                models: p.models.map((m) =>
                  m.kind === model.kind && m.id !== model.id ? { ...m, default_for_kind: false } : m
                ),
              }
            : p
        )
      }
    } catch (e) {
      setError(errorMessage(e, '保存できませんでした。'))
    } finally {
      setBusy(null)
    }
  }

  const remove = async (model: AdminAiModel) => {
    setBusy(model.id)
    setError(null)
    try {
      await deleteAdminAiModel(model.id)
      setPage((p) => (p ? { ...p, models: p.models.filter((m) => m.id !== model.id) } : p))
    } catch (e) {
      setError(errorMessage(e, '削除できませんでした。'))
    } finally {
      setBusy(null)
    }
  }

  if (error && !page) return <p className="text-sm text-destructive">{error}</p>
  if (!page) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size={14} /> 読み込み中…
      </p>
    )
  }

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cpu size={18} style={{ color: 'var(--palace)' }} />
          <h2 className="text-lg font-semibold">AIモデル</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAdding((v) => !v)} className="flex items-center gap-1.5">
          <Plus size={14} />
          モデルを足す
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        原価と消費クレジットを並べています。原価の高いモデルを足すときは、
        消費クレジットも一緒に上げてください（上げ忘れると粗利だけ減ります）。
        使用率は下で選んだ期間の実績です。
      </p>

      {/* 期間は概要・収支と同じ部品。「直近30日」に固定していると、
          入れ替えた直後のモデルが使われているのか判断できない */}
      <PeriodSelect period={page.period} value={period} onChange={setPeriod} />

      {adding && (
        <NewModelForm
          page={page}
          onCreated={(model) => {
            setPage((p) => (p ? { ...p, models: [...p.models, model] } : p))
            setAdding(false)
          }}
          onError={setError}
        />
      )}

      {(['image', 'text'] as const).map((kind) => (
        <div key={kind} className="space-y-2">
          <h3 className="text-sm font-medium">{kind === 'image' ? '画像' : '文章'}</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3">表示名 / キー</th>
                  <th className="py-2 pr-3">モデル</th>
                  <th className="py-2 pr-3 text-right">原価</th>
                  <th className="py-2 pr-3 text-right">消費</th>
                  <th className="py-2 pr-3 text-right">1日の上限</th>
                  <th className="py-2 pr-3">使用率</th>
                  <th className="py-2 pr-3">用途</th>
                  <th className="py-2 pr-3">状態</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {page.models
                  .filter((m) => m.kind === kind)
                  .map((model) => (
                    <tr key={model.id} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{model.label}</div>
                        <div className="text-xs text-muted-foreground">{model.key}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="font-mono text-xs">{model.model_id}</div>
                        <div className="text-xs text-muted-foreground">{model.provider}</div>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <NumberCell
                          value={model.unit_cost_usd}
                          suffix={kind === 'image' ? ' $/枚' : ' $/1M'}
                          onSave={(v) => patch(model, { unit_cost_usd: v })}
                          disabled={busy === model.id}
                        />
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <NumberCell
                          value={model.credit_points}
                          suffix=" pt"
                          onSave={(v) => patch(model, { credit_points: v })}
                          disabled={busy === model.id}
                          hint={
                            model.credit_points != null
                              ? `${(model.credit_points / page.points_per_credit).toFixed(2)} cr`
                              : undefined
                          }
                        />
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <NumberCell
                          value={model.daily_limit}
                          suffix=" 回"
                          placeholder="なし"
                          onSave={(v) => patch(model, { daily_limit: v })}
                          disabled={busy === model.id}
                          hint={model.used_today != null ? `今日 ${model.used_today}` : undefined}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <UsageCell model={model} days={page.usage_days} />
                      </td>
                      <td className="py-2 pr-3">
                        {kind === 'image' ? (
                          <PurposePicker
                            model={model}
                            purposes={page.purposes}
                            onChange={(purposes) => patch(model, { purposes })}
                            disabled={busy === model.id}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <StateCell model={model} onPatch={(c) => patch(model, c)} disabled={busy === model.id} />
                      </td>
                      <td className="py-2 text-right">
                        {!model.builtin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(model)}
                            disabled={busy === model.id}
                            aria-label="削除"
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  )
}

/**
 * どれくらい使われているか。
 *
 * 回数だけだと「よく使われている」かが読み取れないので割合も出す。
 * まだ一度も使われていない種類は割合を出さない（0% と書くと、使われていないのか
 * 分母が無いのかが分からない）。
 */
function UsageCell({ model, days }: { model: AdminAiModel; days: number }) {
  if (model.used_recently === 0) {
    return <span className="text-xs text-muted-foreground">{days}日間なし</span>
  }

  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-1.5 text-xs">
        <span className="tabular-nums">{model.used_recently.toLocaleString()} 回</span>
        {model.share != null && (
          <span className="text-muted-foreground">{Math.round(model.share * 100)}%</span>
        )}
      </div>
      {model.share != null && (
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{ width: `${model.share * 100}%`, backgroundColor: 'var(--palace)' }}
          />
        </div>
      )}
      {model.cached_recently ? (
        <p className="text-[11px] text-muted-foreground">うち {model.cached_recently} 回はキャッシュ</p>
      ) : null}
    </div>
  )
}

/**
 * 有効・表示・既定と、実際に使えるか。
 *
 * 「有効」と「使える」を分けて出す。鍵が入っていなければ有効にしても使えず、
 * 分けないと「有効なのに出てこない」と見える。
 */
function StateCell({
  model,
  onPatch,
  disabled,
}: {
  model: AdminAiModel
  onPatch: (changes: Partial<AdminAiModel>) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1 text-xs">
      <div className="flex flex-wrap gap-1">
        <Toggle on={model.enabled} label="有効" onClick={() => onPatch({ enabled: !model.enabled })} disabled={disabled} />
        <Toggle
          on={model.visible}
          label="利用者に見せる"
          onClick={() => onPatch({ visible: !model.visible })}
          disabled={disabled}
        />
        <Toggle
          on={model.default_for_kind}
          label="既定"
          onClick={() => onPatch({ default_for_kind: !model.default_for_kind })}
          disabled={disabled}
        />
      </div>
      {!model.available && (
        <p className="text-muted-foreground">
          {model.requires_env ? `${model.requires_env} が未設定のため使えません` : '使えません'}
        </p>
      )}
    </div>
  )
}

function Toggle({
  on,
  label,
  onClick,
  disabled,
}: {
  on: boolean
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`rounded-full border px-2 py-0.5 transition-colors disabled:opacity-60 ${
        on ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
      }`}
      style={on ? { backgroundColor: 'var(--palace)' } : undefined}
    >
      {label}
    </button>
  )
}

function PurposePicker({
  model,
  purposes,
  onChange,
  disabled,
}: {
  model: AdminAiModel
  purposes: string[]
  onChange: (purposes: string[]) => void
  disabled?: boolean
}) {
  const labels: Record<string, string> = { item: 'カード', avatar: 'プロフィール', cover: 'ヘッダー', point: '点' }
  const toggle = (purpose: string) => {
    const next = model.purposes.includes(purpose)
      ? model.purposes.filter((p) => p !== purpose)
      : [...model.purposes, purpose]
    onChange(next)
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {purposes.map((purpose) => (
          <Toggle
            key={purpose}
            on={model.purposes.includes(purpose)}
            label={labels[purpose] ?? purpose}
            onClick={() => toggle(purpose)}
            disabled={disabled}
          />
        ))}
      </div>
      {model.purposes.length === 0 && <p className="text-xs text-muted-foreground">すべての用途に使えます</p>}
    </div>
  )
}

/** 数値の入れ替え。触ったときだけ編集に切り替える（表が入力欄だらけにならないように） */
function NumberCell({
  value,
  suffix,
  hint,
  placeholder,
  onSave,
  disabled,
}: {
  value: number | null
  suffix?: string
  hint?: string
  placeholder?: string
  onSave: (value: number | null) => void
  disabled?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (editing) {
    return (
      <div className="flex justify-end gap-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSave(draft.trim() === '' ? null : Number(draft))
              setEditing(false)
            }
            if (e.key === 'Escape') setEditing(false)
          }}
          onBlur={() => setEditing(false)}
          autoFocus
          inputMode="decimal"
          className="h-7 w-24 text-right"
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value == null ? '' : String(value))
        setEditing(true)
      }}
      disabled={disabled}
      className="w-full text-right tabular-nums transition-colors hover:text-[var(--palace)] disabled:opacity-60"
    >
      {value == null ? <span className="text-muted-foreground">{placeholder ?? '未設定'}</span> : `${value}${suffix ?? ''}`}
      {hint && <span className="ml-1 text-xs text-muted-foreground">({hint})</span>}
    </button>
  )
}

function NewModelForm({
  page,
  onCreated,
  onError,
}: {
  page: AdminAiModelsPage
  onCreated: (model: AdminAiModel) => void
  onError: (message: string) => void
}) {
  const [form, setForm] = useState({
    key: '',
    kind: 'image',
    provider: page.providers[0] ?? 'openai',
    model_id: '',
    label: '',
    credit_points: '100',
    unit_cost_usd: '',
    requires_env: '',
  })
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      onCreated(
        await createAdminAiModel({
          key: form.key.trim(),
          kind: form.kind,
          provider: form.provider,
          model_id: form.model_id.trim(),
          label: form.label.trim(),
          credit_points: form.credit_points ? Number(form.credit_points) : null,
          unit_cost_usd: form.unit_cost_usd ? Number(form.unit_cost_usd) : null,
          requires_env: form.requires_env.trim() || null,
        })
      )
    } catch (e) {
      onError(errorMessage(e, '登録できませんでした。'))
    } finally {
      setBusy(false)
    }
  }

  const field = (name: keyof typeof form, label: string, placeholder?: string) => (
    <div className="space-y-1">
      <Label htmlFor={`ai-model-${name}`}>{label}</Label>
      <Input
        id={`ai-model-${name}`}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        placeholder={placeholder}
      />
    </div>
  )

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4">
      {field('label', '表示名', 'きれい')}
      {field('key', 'キー', 'flux-pro')}
      <div className="space-y-1">
        <Label htmlFor="ai-model-kind">種類</Label>
        <select
          id="ai-model-kind"
          value={form.kind}
          onChange={(e) => setForm({ ...form, kind: e.target.value })}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {page.kinds.map((k) => (
            <option key={k} value={k}>
              {k === 'image' ? '画像' : '文章'}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ai-model-provider">プロバイダ</Label>
        <select
          id="ai-model-provider"
          value={form.provider}
          onChange={(e) => setForm({ ...form, provider: e.target.value })}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {page.providers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      {field('model_id', 'モデル名', 'fal-ai/flux-pro')}
      {field('credit_points', '消費（pt）', '100')}
      {field('unit_cost_usd', '原価（USD）', '0.04')}
      {field('requires_env', '必要な環境変数', 'FAL_API_KEY')}
      <div className="flex items-end">
        <Button onClick={submit} disabled={busy || !form.key.trim() || !form.label.trim() || !form.model_id.trim()}>
          {busy ? <Spinner size={14} /> : '登録'}
        </Button>
      </div>
    </div>
  )
}

function errorMessage(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { error?: string; errors?: string[] } } })?.response?.data
  return detail?.error || detail?.errors?.join('・') || fallback
}
