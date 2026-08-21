'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Globe, Trash2, AlertTriangle, IdCard, UserCog, ShieldCheck, House } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategorySections, type CategorySection } from '@/components/features/myroom/CategorySections'
import { ComingSoon } from '@/components/features/myroom/ComingSoon'
import { AvatarGenerator } from '@/components/features/account/AvatarGenerator'
import { PasswordEditor } from '@/components/features/account/PasswordEditor'
import { DisplayNameEditor } from '@/components/features/account/DisplayNameEditor'
import { SecuritySettings } from '@/components/features/account/SecuritySettings'
import { needsStrongAuth } from '@/lib/auth/capabilities'
import { PalaceNameEditor } from '@/components/features/account/PalaceNameEditor'
import { deleteAccount } from '@/lib/api/account'
import { useAdminStore } from '@/stores/admin'
import { useAuthStore } from '@/stores/auth'
import { useItemsStore } from '@/stores/items'
import { bodyFor } from '@/lib/page-help'

type TabKey = 'info' | 'palace' | 'basic' | 'public' | 'security' | 'withdraw'

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

  // セキュリティの項目を出すかどうかの判断にだけ使う。
  // 出し分けは見た目の話で、守りはサーバー側にある
  // **役割ではなく、できることの名前で決める。**
  // 執務室と工房のどちらかに入れる人には、本人確認の設定が要る
  const showSecurity = needsStrongAuth(useAdminStore((s) => s.session))

  const sections: CategorySection<TabKey>[] = [
    {
      key: 'info',
      label: '登録情報',
      icon: <IdCard size={16} />,
      content: (
        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <dl className="grid gap-3 text-sm">
            <DisplayNameEditor />
            <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
              <dt className="text-muted-foreground">メールアドレス</dt>
              <dd className="font-medium break-all">{user?.email ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
              <dt className="text-muted-foreground">ログイン連携</dt>
              <dd className="font-medium">{providerLabel(user?.provider)}</dd>
            </div>
            {/* パスワードを持つのはメールで登録した人だけ。
                Google などで入っている人には出さない（変えるものが無い） */}
            {user?.provider === 'email' && <PasswordEditor />}
          </dl>
          <p className="text-xs text-muted-foreground">
            メールアドレスの変更とログイン連携の追加は、まだご利用いただけません。
          </p>
        </section>
      ),
    },
    {
      // 宮殿の名前は「見え方の好み」ではなく自分の名乗り。呼び名と同じ性質なので、
      // 表示・操作の設定ではなくアカウントに置く
      key: 'palace',
      label: '宮殿の名前',
      icon: <House size={16} />,
      content: <PalaceNameEditor />,
    },
    {
      key: 'basic',
      label: '基本プロフィール',
      icon: <User size={16} />,
      content: (
        <div className="space-y-4">
          <AvatarGenerator />
          <ComingSoon
            description="言語設定やログイン連携などは順次対応予定です。呼び名とパスワードは「登録情報」で変えられます。"
            items={['言語 / タイムゾーン', '学習目的 / デフォルト学習ジャンル', '自分用メモ', 'ログイン連携（Google / Apple）', 'メールアドレス変更']}
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
    // 退会の直前に置く。どちらも「アカウントそのもの」を扱う項目で、
    // 見え方や公開範囲の設定とは性質が違う。
    //
    // 中身（パスキー・二要素認証）が運営・制作の運用のためのものなので、
    // 一般の人には見出しごと出さない。**空の項目を置くと、
    // 何か設定し忘れているのかと考えさせてしまう。**
    //
    // **役割では決めない。** 工房は役割が `user` の口座も使うので、
    // 役割で見ていると設定できないまま閉め出される
    // ログイン方法とメールアドレスは「登録情報」にある
    ...(showSecurity
      ? [
          {
            key: 'security' as const,
            label: 'セキュリティ',
            icon: <ShieldCheck size={16} />,
            content: <SecuritySettings />,
          },
        ]
      : []),
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
      <div className="space-y-8">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            <UserCog size={26} style={{ color: 'var(--palace)' }} />
            アカウント管理
          </h1>
          <p className="mt-2 text-muted-foreground">{bodyFor('/account')}</p>
        </div>

        <CategorySections sections={sections} ariaLabel="アカウント管理カテゴリ" />
      </div>
    </div>
  )
}
