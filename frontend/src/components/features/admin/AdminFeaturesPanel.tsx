'use client'

import { useEffect, useState } from 'react'
import { FlaskConical, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  getAdminFeatureFlags,
  updateAdminFeatureFlag,
  resetAdminFeatureFlag,
} from '@/lib/api/admin'
import type { AdminFeatureFlag } from '@/types/admin'

/**
 * 作りかけの機能を、どこまで見せるかの切り替え。
 *
 * これまでは画面ごとに「準備中」をベタ書きしていたため、外すのにデプロイが要り、
 * 戻すのにもデプロイが要った。ここで切り替えれば、次の読み込みから反映される。
 *
 * 段階を4つに分けているのは、「隠す」と「公開」の間が要るため。
 * 予告として見せたいだけの段階と、触ってもらいたいが粗い段階は別物。
 */
export function AdminFeaturesPanel() {
  const [features, setFeatures] = useState<AdminFeatureFlag[]>([])
  const [stages, setStages] = useState<{ value: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAdminFeatureFlags()
      .then((page) => {
        setFeatures(page.features)
        setStages(page.stages)
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
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <FlaskConical size={18} style={{ color: 'var(--palace)' }} />
        <h2 className="text-lg font-semibold">機能の見せ方</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        作りかけの機能を、どこまで出すかを決めます。変更はデプロイなしで、次の読み込みから効きます。
      </p>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size={14} /> 読み込み中…
        </p>
      ) : (
        <ul className="space-y-3">
          {features.map((feature) => (
            <li key={feature.key} className="space-y-2 border-t border-border pt-3 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{feature.label}</p>
                  <p className="text-xs text-muted-foreground">{feature.key}</p>
                </div>
                {feature.customized && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => reset(feature.key)}
                    disabled={saving === feature.key}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <RotateCcw size={13} />
                    既定（{stageLabel(stages, feature.default_stage)}）へ戻す
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {stages.map((stage) => (
                  <button
                    key={stage.value}
                    type="button"
                    onClick={() => change(feature.key, stage.value)}
                    disabled={saving === feature.key}
                    aria-pressed={feature.stage === stage.value}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-60 ${
                      feature.stage === stage.value
                        ? 'border-transparent text-white'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                    style={feature.stage === stage.value ? { backgroundColor: 'var(--palace)' } : undefined}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{STAGE_HELP[feature.stage] ?? ''}</p>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  )
}

// 押した結果どう見えるかを、押す前に分かるようにする
const STAGE_HELP: Record<string, string> = {
  hidden: '入口ごと出しません。存在を知らせたくないときに。',
  development: '「準備中」と出しますが、触れません。予告として見せるときに。',
  prototype: '触れます。「プロトタイプ版」と印を付けて、粗さを了解してもらいます。',
  released: '普通の機能として出します。印は付きません。',
}

function stageLabel(stages: { value: string; label: string }[], value: string): string {
  return stages.find((s) => s.value === value)?.label ?? value
}
