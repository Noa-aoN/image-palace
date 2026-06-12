'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Trash2, AlertTriangle, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportAccountData, deleteAccount } from '@/lib/api/account'
import { getSettings, updateSettings } from '@/lib/api/settings'
import { useAuthStore } from '@/stores/auth'
import { useItemsStore } from '@/stores/items'

export default function AccountPage() {
  const router = useRouter()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const resetItems = useItemsStore((s) => s.resetItems)

  const [autoMeanings, setAutoMeanings] = useState<boolean | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSettings()
      .then((s) => {
        if (!cancelled) setAutoMeanings(s.auto_generate_meanings)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const toggleAutoMeanings = async () => {
    if (autoMeanings === null || savingSettings) return
    const next = !autoMeanings
    setSavingSettings(true)
    setAutoMeanings(next)
    try {
      const s = await updateSettings({ auto_generate_meanings: next })
      setAutoMeanings(s.auto_generate_meanings)
    } catch {
      setAutoMeanings(!next) // 失敗したら元に戻す
    } finally {
      setSavingSettings(false)
    }
  }

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleExport = async () => {
    setExporting(true)
    setExportError(null)
    try {
      const data = await exportAccountData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `image-palace-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setExportError('エクスポートに失敗しました。時間を置いて再度お試しください。')
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAccount()
      resetItems()
      clearAuth()
      router.push('/signup')
    } catch {
      setDeleteError('削除に失敗しました。時間を置いて再度お試しください。')
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">
      <div>
        <h1 className="text-xl font-semibold">アカウント設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">生成オプション・データのエクスポート・アカウントの削除ができます。</p>
      </div>

      {/* 生成オプション */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Sparkles size={18} style={{ color: 'var(--palace)' }} />
          <h2 className="text-base font-semibold">生成オプション</h2>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">カード作成時に意味・説明を自動生成</p>
            <p className="mt-1 text-sm text-muted-foreground">
              ONにすると、新しいカードを作るたびに AI が意味・説明を自動生成します（生成コストがかかります）。
              OFF の場合は、各カードの詳細画面から個別に生成できます。
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoMeanings === true}
            aria-label="意味・説明の自動生成"
            disabled={autoMeanings === null || savingSettings}
            onClick={toggleAutoMeanings}
            className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              autoMeanings ? 'bg-[var(--palace)]' : 'bg-muted'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                autoMeanings ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        {savingSettings && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> 保存中…
          </p>
        )}
      </section>

      {/* データエクスポート */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Download size={18} style={{ color: 'var(--palace)' }} />
          <h2 className="text-base font-semibold">データのエクスポート</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          あなたのカード・デッキ・コレクションなどのデータを JSON 形式でダウンロードします。
        </p>
        <Button onClick={handleExport} disabled={exporting} className="flex items-center gap-1">
          <Download size={15} />
          {exporting ? 'エクスポート中…' : 'データをエクスポート'}
        </Button>
        {exportError && <p className="text-sm text-destructive">{exportError}</p>}
      </section>

      {/* アカウント削除 */}
      <section className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5">
        <div className="flex items-center gap-2">
          <Trash2 size={18} className="text-destructive" />
          <h2 className="text-base font-semibold text-destructive">アカウントの削除</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          アカウントを削除すると、すべてのカード・画像・デッキ・コレクションなどが完全に削除されます。
          この操作は取り消せません。
        </p>

        {!confirming ? (
          <Button variant="destructive" onClick={() => setConfirming(true)} className="flex items-center gap-1">
            <Trash2 size={15} />
            アカウントを削除
          </Button>
        ) : (
          <div className="space-y-3 rounded-lg border border-destructive/50 bg-background p-4">
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle size={18} className="text-destructive shrink-0 mt-0.5" />
              <span>本当に削除しますか？この操作は取り消せません。</span>
            </div>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? '削除中…' : '完全に削除する'}
              </Button>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={deleting}>
                キャンセル
              </Button>
            </div>
          </div>
        )}
        {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
      </section>
    </div>
  )
}
