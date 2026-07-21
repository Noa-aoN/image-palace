'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Globe, Trash2, AlertTriangle, IdCard, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategorySections, type CategorySection } from '@/components/features/myroom/CategorySections'
import { ComingSoon } from '@/components/features/myroom/ComingSoon'
import { AvatarGenerator } from '@/components/features/account/AvatarGenerator'
import { deleteAccount } from '@/lib/api/account'
import { useAuthStore } from '@/stores/auth'
import { useItemsStore } from '@/stores/items'

type TabKey = 'info' | 'basic' | 'public' | 'withdraw'

// 認証プロバイダ（devise-token-auth の provider 値）を日本語表記にする。
const PROVIDER_LABELS: Record<string, string> = {
  email: 'メールアドレス',
  google_oauth2: 'Google',
  apple: 'Apple',
  github: 'GitHub',
}

function providerLabel(provider?: string): string {
  if (!provider) return '—'
  return PROVIDER_LABELS[provider] ?? provider
}

export default function AccountPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const resetItems = useItemsStore((s) => s.resetItems)

  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  const sections: CategorySection<TabKey>[] = [
    {
      key: 'info',
      label: '登録情報',
      icon: <IdCard size={16} />,
      content: (
        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <dl className="grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">表示名</dt>
              <dd className="font-medium">{user?.name?.trim() ? user.name : '未設定'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
              <dt className="text-muted-foreground">メールアドレス</dt>
              <dd className="font-medium break-all">{user?.email ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
              <dt className="text-muted-foreground">ログイン連携</dt>
              <dd className="font-medium">{providerLabel(user?.provider)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            メールアドレス・パスワード・ログイン連携の編集は順次対応予定です。
          </p>
        </section>
      ),
    },
    {
      key: 'basic',
      label: '基本プロフィール',
      icon: <User size={16} />,
      content: (
        <div className="space-y-4">
          <AvatarGenerator />
          <ComingSoon
            description="言語設定、ログイン連携、パスワード変更などは順次対応予定です。"
            items={['アプリ内の呼び名', '言語 / タイムゾーン', '学習目的 / デフォルト学習ジャンル', '自分用メモ', 'ログイン連携（Google / GitHub / Apple）', 'メールアドレス変更', 'パスワード / 二要素認証']}
          />
        </div>
      ),
    },
    {
      key: 'public',
      label: '公開プロフィール',
      icon: <Globe size={16} />,
      content: (
        <ComingSoon
          description="他のユーザーへ見せる公開ページの設定は順次対応予定です。"
          items={['公開名 / 公開アイコン', '自己紹介', 'SNS / 外部リンク', '公開プロフィール URL', '公開ボックス / 公開トロフィー', '公開 / 非公開の切り替え']}
        />
      ),
    },
    {
      key: 'withdraw',
      label: '退会',
      icon: <Trash2 size={16} />,
      content: (
        <section className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5">
          <div className="flex items-center gap-2">
            <Trash2 size={18} className="text-destructive" />
            <h2 className="text-lg font-semibold text-destructive">退会（アカウントの削除）</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            アカウントを削除すると、すべてのカード・画像・デッキ・ボックスなどが完全に削除されます。
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
      ),
    },
  ]

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            <UserCog size={26} style={{ color: 'var(--palace)' }} />
            アカウント設定
          </h1>
          <p className="mt-2 text-muted-foreground">
            プロフィール・ログイン情報・退会など、アカウント本体に関する設定です。
          </p>
        </div>

        <CategorySections sections={sections} ariaLabel="アカウント設定カテゴリ" />
      </div>
    </div>
  )
}
