'use client'

import { useState } from 'react'
import { Check, Loader2, Pencil, X } from 'lucide-react'
import { updateProfile } from '@/lib/api/account'
import { useAuthStore } from '@/stores/auth'
import { defaultDisplayName } from '@/lib/display-name'
import { isSubmitEnter } from '@/lib/enter-key'

const MAX_LENGTH = 50

/**
 * 表示名の編集。
 *
 * 外部アカウント（Google 等）の名前は登録時の初期値として入っているだけで、
 * 以後は本人が自由に変えられる。ニックネーム欄を別に設けないのは、
 * 「どちらが表に出るのか」を利用者に考えさせないため。
 * 空にすると未設定へ戻り、メールのローカル部から作った既定名が使われる。
 */
export function DisplayNameEditor() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = user?.name?.trim() ?? ''
  const shown = current || defaultDisplayName(user?.email)

  function start() {
    setValue(current)
    setError(null)
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const profile = await updateProfile({ name: value })
      updateUser({ name: profile.name })
      setEditing(false)
    } catch (e) {
      const messages = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors
      setError(messages?.join(' / ') ?? '保存できませんでした')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-4">
        <dt className="text-muted-foreground">表示名</dt>
        <dd className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{shown}</span>
          {!current && <span className="shrink-0 text-xs text-muted-foreground">既定</span>}
          <button
            type="button"
            onClick={start}
            aria-label="表示名を変更する"
            className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Pencil size={14} />
          </button>
        </dd>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="display-name" className="text-muted-foreground">
          表示名
        </label>
        <div className="flex items-center gap-1.5">
          <input
            id="display-name"
            value={value}
            maxLength={MAX_LENGTH}
            autoFocus
            disabled={saving}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (isSubmitEnter(e)) save()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="w-48 rounded-lg border border-border bg-background px-2 py-1"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            aria-label="保存する"
            className="rounded-lg border border-border p-1.5 hover:bg-accent disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={saving}
            aria-label="やめる"
            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {error && <p className="text-right text-xs text-destructive">{error}</p>}
      <p className="text-right text-xs text-muted-foreground">
        空にすると既定の名前（{defaultDisplayName(user?.email)}）に戻ります・{MAX_LENGTH}文字まで
      </p>
    </div>
  )
}
