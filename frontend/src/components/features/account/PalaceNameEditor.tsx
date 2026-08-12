'use client'

import { useEffect, useState } from 'react'
import { House, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getSettings, updateSettings } from '@/lib/api/settings'
import { isSubmitEnter } from '@/lib/enter-key'

/**
 * 宮殿の名前。
 *
 * 「表示・操作」の設定に置いていたが、これは**見え方の好みではなく、
 * 自分の名乗り**。呼び名（表示名）と同じ性質なので、アカウントに置く。
 */
export function PalaceNameEditor() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSettings()
      .then((s) => setName(s.palace_name ?? ''))
      .catch(() => setError('読み込めませんでした'))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const result = await updateSettings({ palace_name: name.trim() })
      setName(result.palace_name ?? '')
      setSaved(true)
    } catch {
      setError('保存できませんでした')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <House size={18} style={{ color: 'var(--palace)' }} />
        <h2 className="text-lg font-semibold">宮殿の名前</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        エントランスに出る、あなたの宮殿の呼び名です。空のままなら「◯◯の宮殿」と出ます。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setSaved(false)
          }}
          onKeyDown={(e) => {
            if (isSubmitEnter(e)) {
              e.preventDefault()
              void save()
            }
          }}
          placeholder="記憶の宮殿"
          maxLength={30}
          disabled={loading || saving}
          className="w-64"
        />
        <Button onClick={save} disabled={loading || saving}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : '保存'}
        </Button>
        {saved && <span className="text-xs text-muted-foreground">保存しました</span>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  )
}
