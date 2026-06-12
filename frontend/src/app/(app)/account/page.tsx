'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportAccountData, deleteAccount } from '@/lib/api/account'
import { useAuthStore } from '@/stores/auth'
import { useItemsStore } from '@/stores/items'

export default function AccountPage() {
  const router = useRouter()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const resetItems = useItemsStore((s) => s.resetItems)

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
        <p className="mt-1 text-sm text-muted-foreground">データのエクスポートとアカウントの削除ができます。</p>
      </div>

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
