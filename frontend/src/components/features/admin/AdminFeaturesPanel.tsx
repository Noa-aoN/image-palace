'use client'

import { useEffect, useState } from 'react'
import { FlaskConical, RotateCcw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { isSubmitEnter } from '@/lib/enter-key'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { getAdminFeatureFlags, updateAdminFeatureFlag, resetAdminFeatureFlag } from '@/lib/api/admin'
import type { AdminFeatureFlag } from '@/types/admin'
import { useCanOperate } from '@/hooks/useAdminPermissions'
import { ReadOnlyNotice } from '@/components/features/admin/ReadOnlyNotice'

/**
 * ページをどこまで見せるかの切り替え。
 *
 * 単位はページ（サイドバーの1項目）にしてある。機能ごとの細かいキーにすると、
 * どこを触れば何が消えるのかが分からない。**サイドバーと同じ並び**で出すことで、
 * 押す前に結果が読めるようにする。
 *
 * 段階を4つに分けているのは、「隠す」と「公開」の間が要るため。
 * 予告として見せたいだけの段階と、触ってもらいたいが粗い段階は別物。
 */
export function AdminFeaturesPanel() {
  const canWrite = useCanOperate()
  const [features, setFeatures] = useState<AdminFeatureFlag[]>([])
  const [stages, setStages] = useState<{ value: string; label: string }[]>([])
  const [groups, setGroups] = useState<{ key: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAdminFeatureFlags()
      .then((page) => {
        setFeatures(page.features)
        setStages(page.stages)
        setGroups(page.groups)
      })
      .catch(() => setError('読み込めませんでした。'))
      .finally(() => setLoading(false))
  }, [])

  const replace = (updated: AdminFeatureFlag) =>
    setFeatures((rows) => rows.map((row) => (row.key === updated.key ? updated : row)))

  const change = async (key: string, stage: string) => {
    setSaving(key)
    setError(null)
    try {
      replace(await updateAdminFeatureFlag(key, { stage }))
    } catch {
      setError('保存できませんでした。')
    } finally {
      setSaving(null)
    }
  }

  // なぜ準備中かの一言。**利用者にそのまま出る**ので、運営向けの覚え書きとは分ける
  const saveNote = async (key: string, notes: string) => {
    setSaving(key)
    setError(null)
    try {
      replace(await updateAdminFeatureFlag(key, { notes }))
    } catch {
      setError('保存できませんでした。')
    } finally {
      setSaving(null)
    }
  }

  const reset = async (key: string) => {
    setSaving(key)
    setError(null)
    try {
      replace(await resetAdminFeatureFlag(key))
    } catch {
      setError('戻せませんでした。')
    } finally {
      setSaving(null)
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <FlaskConical size={18} style={{ color: 'var(--palace)' }} />
        <h2 className="text-lg font-semibold">ページの見せ方</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        サイドバーの項目ごとに、どこまで出すかを決めます。変更はデプロイなしで、次の読み込みから効きます。
        <br />
        <strong className="text-foreground">「表示しない」はページ本体にも効きます</strong>
        （URL を直に叩いても開けません）。
      </p>

      <div className="flex flex-wrap gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {stages.map((stage) => (
          <span key={stage.value}>
            <strong className="text-foreground">{stage.label}</strong>：{STAGE_HELP[stage.value]}
          </span>
        ))}
      </div>

      {!canWrite && <ReadOnlyNotice what="公開段階の変更" />}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size={14} /> 読み込み中…
        </p>
      ) : (
        groups.map((group) => {
          const rows = features.filter((f) => f.group === group.key)
          if (rows.length === 0) return null

          return (
            <div key={group.key} className="space-y-2">
              <h3 className="text-sm font-medium">{group.label}</h3>
              {/* 書き込みの釦はまとめて囲って止める。1つずつ disabled を書くと、
                  あとから釦を足したときに付け忘れる（付け忘れると押せてしまう） */}
              <fieldset disabled={!canWrite} className="contents">
              <ul className="divide-y divide-border rounded-lg border border-border">
                {rows.map((feature) => (
                  <li key={feature.key} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{feature.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {feature.path ?? feature.note ?? feature.key}
                      </p>
                      {/* 準備中・非公開のときだけ、理由を書ける。
                          出していない機能の理由は、利用者の目に触れない */}
                      {(feature.stage === 'development' || feature.stage === 'hidden') && (
                        <NoteField
                          value={feature.notes ?? ''}
                          busy={saving === feature.key}
                          onSave={(next) => saveNote(feature.key, next)}
                        />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {stages.map((stage) => (
                        <button
                          key={stage.value}
                          type="button"
                          onClick={() => change(feature.key, stage.value)}
                          disabled={saving === feature.key}
                          aria-pressed={feature.stage === stage.value}
                          className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors disabled:opacity-60 ${
                            feature.stage === stage.value
                              ? 'border-transparent text-white'
                              : 'border-border text-muted-foreground hover:bg-muted'
                          }`}
                          style={feature.stage === stage.value ? { backgroundColor: 'var(--palace)' } : undefined}
                        >
                          {stage.label}
                        </button>
                      ))}
                      {feature.customized && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => reset(feature.key)}
                          disabled={saving === feature.key}
                          className="flex items-center gap-1 text-xs"
                          aria-label="既定へ戻す"
                        >
                          <RotateCcw size={12} />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              </fieldset>
            </div>
          )
        })
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  )
}

// 押した結果どう見えるかを、押す前に分かるようにする
const STAGE_HELP: Record<string, string> = {
  hidden: 'サイドバーから消し、ページも開けない',
  development: 'サイドバーに「準備中」と出るが、中身は出ない',
  prototype: '使える。「試作」の印が付く',
  released: '普通に出す',
}

/**
 * 準備中の理由。**利用者にそのまま出る**ので、運営向けの覚え書きとは分ける。
 *
 * 押したときだけ保存する（打つたびに送ると、書きかけが利用者に出る）。
 */
function NoteField({
  value,
  busy,
  onSave,
}: {
  value: string
  busy: boolean
  onSave: (next: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const dirty = draft !== value

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="なぜ準備中か（利用者に出ます）"
        className="h-8 text-xs"
        onKeyDown={(e) => {
          if (isSubmitEnter(e) && dirty) onSave(draft)
        }}
      />
      {dirty && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onSave(draft)}>
          保存
        </Button>
      )}
    </div>
  )
}
